/**
 * Environment Variables VFS Provider for Gondolin
 *
 * Exposes user-declared environment variables as read-only files at /run/env/<NAME>.
 * Variables are declared in a host-side config file:
 *
 *   MY_VAR          → propagate from process.env
 *   MY_VAR=value    → static literal
 *   MY_VAR=$OTHER   → reference, resolved from process.env at access time
 *
 * INVARIANT: process.env is NEVER exposed implicitly.
 * If no config file is set, the directory is empty.
 *
 * Config file is re-read on every guest access (live updates).
 * Secret names (set via setSecretNames) are excluded from listings and access.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ReadonlyVirtualProvider,
  ERRNO,
  createVirtualDirStats,
  normalizeVfsPath,
} from "@earendil-works/gondolin";
import type { VirtualProvider, VirtualFileHandle } from "@earendil-works/gondolin";

// ---------------------------------------------------------------------------
// Dirent helpers — gondolin always calls readdirSync with withFileTypes:true.
// VirtualDirent (from gondolin) always returns isDirectory()=true which
// causes the kernel to treat every file as a directory → hang on ls.
// ---------------------------------------------------------------------------

class FileDirent extends fs.Dirent {
  constructor(public name: string) { super(); }
  isFile()            { return true; }
  isDirectory()       { return false; }
  isSymbolicLink()    { return false; }
  isBlockDevice()     { return false; }
  isCharacterDevice() { return false; }
  isFIFO()            { return false; }
  isSocket()          { return false; }
}

function fileEntries(names: string[], withTypes: boolean): (string | fs.Dirent)[] {
  if (!withTypes) return names;
  return names.map(n => new FileDirent(n));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EnvDeclaration = {
  name: string;
  type: "propagate" | "static" | "reference";
  value?: string; // raw RHS for static/reference
};

// ---------------------------------------------------------------------------
// File handle — a simple in-memory buffer
// ---------------------------------------------------------------------------

class EnvFileHandle implements VirtualFileHandle {
  closed = false;
  readonly path: string;
  readonly flags = "r";
  readonly mode = 0o444;
  position = 0;

  constructor(path: string, private readonly data: Buffer) {
    this.path = path;
  }

  read(buf: Buffer, offset: number, length: number, pos?: number | null): Promise<{ bytesRead: number; buffer: Buffer }> {
    const bytesRead = this.readSync(buf, offset, length, pos);
    return Promise.resolve({ bytesRead, buffer: buf });
  }
  readSync(buf: Buffer, offset: number, length: number, pos?: number | null): number {
    const p = pos ?? this.position;
    const n = Math.min(length, Math.max(0, this.data.length - p));
    if (n > 0) this.data.copy(buf, offset, p, p + n);
    if (pos == null) this.position = p + n;
    return n;
  }
  write(): Promise<{ bytesWritten: number; buffer: Buffer }> { return Promise.reject(erofs()); }
  writeSync(): number { throw erofs(); }
  readFile(o?: { encoding?: BufferEncoding } | BufferEncoding): Promise<Buffer | string> {
    return Promise.resolve(this.readFileSync(o));
  }
  readFileSync(o?: { encoding?: BufferEncoding } | BufferEncoding): Buffer | string {
    const enc = typeof o === "string" ? o : o?.encoding;
    return enc ? this.data.toString(enc) : Buffer.from(this.data);
  }
  writeFile(): Promise<void> { return Promise.reject(erofs()); }
  writeFileSync(): void { throw erofs(); }
  stat(): Promise<fs.Stats> { return Promise.resolve(this.statSync()); }
  statSync(): fs.Stats { return fileStats(this.data.length); }
  truncate(): Promise<void> { return Promise.reject(erofs()); }
  truncateSync(): void { throw erofs(); }
  close(): Promise<void> { this.closed = true; return Promise.resolve(); }
  closeSync(): void { this.closed = true; }
}

// ---------------------------------------------------------------------------
// Config file parsing
// ---------------------------------------------------------------------------

/**
 * Parse the env config file. Returns declarations in order.
 * Re-reads from disk on every call (live updates).
 */
function parseEnvFile(filePath: string): EnvDeclaration[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const result: EnvDeclaration[] = [];

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) {
      // Propagate: just a name
      const name = line;
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        result.push({ name, type: "propagate" });
      }
      continue;
    }

    const name = line.slice(0, eqIdx).trim();
    if (!name || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;

    const rhs = line.slice(eqIdx + 1);

    // Check if RHS contains $VAR or ${VAR} references
    if (/\$[A-Za-z_]|\$\{[A-Za-z_]/.test(rhs)) {
      result.push({ name, type: "reference", value: rhs });
    } else {
      result.push({ name, type: "static", value: rhs });
    }
  }

  return result;
}

/**
 * Resolve a declaration to its current value.
 * Returns undefined if the value cannot be resolved (missing env var).
 */
function resolveDeclaration(decl: EnvDeclaration): string | undefined {
  switch (decl.type) {
    case "propagate": {
      const val = process.env[decl.name];
      return val !== undefined ? val : undefined;
    }
    case "static":
      return decl.value ?? "";
    case "reference": {
      if (!decl.value) return undefined;
      let resolved = decl.value;
      let allResolved = true;

      // Expand ${VAR} references
      resolved = resolved.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_m, varName) => {
        const val = process.env[varName];
        if (val === undefined) { allResolved = false; return ""; }
        return val;
      });

      // Expand $VAR references (not preceded by ${ which we already handled)
      resolved = resolved.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_m, varName) => {
        const val = process.env[varName];
        if (val === undefined) { allResolved = false; return ""; }
        return val;
      });

      return allResolved ? resolved : undefined;
    }
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class EnvironmentDirectoryProvider extends ReadonlyVirtualProvider {
  private envFilePath: string | undefined;
  private secretNames: Set<string> = new Set();

  constructor(envFilePath?: string) {
    super();
    if (envFilePath) {
      this.envFilePath = envFilePath.startsWith("~")
        ? path.join(os.homedir(), envFilePath.slice(1))
        : envFilePath;
    }
  }

  /**
   * Called by vm-builder after all secrets are registered.
   * Returns list of conflicting names (present in both envFile and secretNames).
   */
  setSecretNames(names: Set<string>): string[] {
    this.secretNames = names;

    // Detect conflicts: names in our env file that are also secret names
    if (!this.envFilePath) return [];

    const decls = parseEnvFile(this.envFilePath);
    const conflicts: string[] = [];
    for (const d of decls) {
      if (names.has(d.name)) {
        conflicts.push(d.name);
      }
    }
    return conflicts;
  }

  /**
   * Get all resolvable variable names (excluding secrets and unresolvable refs).
   * Re-reads env file on each call.
   */
  private resolvedEntries(): Array<{ name: string; value: string }> {
    if (!this.envFilePath) return [];

    const decls = parseEnvFile(this.envFilePath);
    const result: Array<{ name: string; value: string }> = [];

    for (const d of decls) {
      if (this.secretNames.has(d.name)) continue;
      const val = resolveDeclaration(d);
      if (val !== undefined) {
        result.push({ name: d.name, value: val });
      }
    }

    return result;
  }

  private resolveOne(name: string): string | undefined {
    if (this.secretNames.has(name)) return undefined;
    if (!this.envFilePath) return undefined;

    const decls = parseEnvFile(this.envFilePath);
    const decl = decls.find(d => d.name === name);
    if (!decl) return undefined;

    return resolveDeclaration(decl);
  }

  statSync(vfsPath: string): fs.Stats {
    const norm = normalizeVfsPath(vfsPath);
    if (norm === "/") return createVirtualDirStats();

    const name = norm.slice(1);
    if (name.includes("/")) throw enoent(vfsPath);

    const val = this.resolveOne(name);
    if (val === undefined) throw enoent(vfsPath);

    return fileStats(Buffer.byteLength(val, "utf-8"));
  }

  lstatSync(vfsPath: string): fs.Stats { return this.statSync(vfsPath); }

  readdirSync(_path: string, options?: object): (string | fs.Dirent)[] {
    const withTypes = (options as any)?.withFileTypes ?? false;
    const entries = this.resolvedEntries();
    return fileEntries(entries.map(e => e.name), withTypes);
  }

  protected openReadonlySync(vfsPath: string): VirtualFileHandle {
    const norm = normalizeVfsPath(vfsPath);
    if (norm === "/") throw enoent(vfsPath);
    const name = norm.slice(1);
    if (name.includes("/")) throw enoent(vfsPath);

    const val = this.resolveOne(name);
    if (val === undefined) throw enoent(vfsPath);

    return new EnvFileHandle(vfsPath, Buffer.from(val, "utf-8"));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileStats(size: number): fs.Stats {
  const now = Date.now();
  return Object.assign(Object.create(fs.Stats.prototype), {
    dev: 0, mode: 0o100444, nlink: 1, uid: 0, gid: 0, rdev: 0,
    blksize: 4096, ino: 0, size, blocks: Math.ceil(size / 512),
    atimeMs: now, mtimeMs: now, ctimeMs: now, birthtimeMs: now,
    atime: new Date(now), mtime: new Date(now), ctime: new Date(now), birthtime: new Date(now),
  });
}

function enoent(p?: string): Error {
  const err: any = new Error(`ENOENT: no such file or directory${p ? ", '" + p + "'" : ""}`);
  err.code = "ENOENT";
  err.errno = -ERRNO.ENOENT;
  return err;
}

function erofs(): Error {
  const err: any = new Error("EROFS: read-only file system");
  err.code = "EROFS";
  err.errno = -ERRNO.EROFS;
  return err;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export default function createProvider(config: {
  envFile?: string;
} = {}): VirtualProvider {
  return new EnvironmentDirectoryProvider(config.envFile) as unknown as VirtualProvider;
}
