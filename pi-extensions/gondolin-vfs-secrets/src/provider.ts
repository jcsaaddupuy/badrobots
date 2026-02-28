/**
 * Secrets File VFS Provider for Gondolin
 *
 * Secrets are declared in a host-side config file with optional host restrictions:
 *
 *   SECRET_NAME                 → propagate from process.env[SECRET_NAME]
 *   SECRET_NAME=value           → static literal
 *   SECRET_NAME=$ENV_VAR        → reference, resolved from process.env at access time
 *   SECRET_NAME=${ENV_VAR}      → same reference, ${} syntax
 *
 *   With host restrictions (@ syntax):
 *   SECRET_NAME@host1,host2     → propagate, allowed only for specified hosts
 *   SECRET_NAME@host1=value     → static, allowed only for specified hosts
 *   SECRET_NAME@host1=$VAR      → reference, allowed only for specified hosts
 *
 * The guest reads files from the VFS and gets placeholder content (GONDOLIN_SECRET_xxx),
 * never the real values. Real values are substituted at HTTP egress via onRequestHead wrapper.
 *
 * Config file is re-read on every guest access (live updates).
 * If no config file is set, the directory is empty.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  ReadonlyVirtualProvider,
  ERRNO,
  createVirtualDirStats,
  normalizeVfsPath,
} from "@earendil-works/gondolin";
import type { VirtualProvider, VirtualFileHandle } from "@earendil-works/gondolin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SecretDeclaration = {
  name: string;
  type: "propagate" | "static" | "reference";
  value?: string; // raw RHS for static/reference; undefined for propagate
};

// ---------------------------------------------------------------------------
// Dirent helpers
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
// File handle
// ---------------------------------------------------------------------------

class SecretFileHandle implements VirtualFileHandle {
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
 * Parse the secrets config file. Returns declarations in order.
 * Format: SECRET_NAME[@host1,host2][=value]
 * - No = suffix: propagate from process.env[SECRET_NAME]
 * - = with value: static or reference
 * Re-reads from disk on every call (live updates).
 */
function parseSecretsFile(filePath: string): Array<SecretDeclaration & { hosts: string[] }> {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const result: Array<SecretDeclaration & { hosts: string[] }> = [];

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIdx = line.indexOf("=");
    
    // Extract name and hosts
    let nameAndHosts: string;
    let rhs: string | undefined;
    
    if (eqIdx === -1) {
      // No = sign: propagate format (NAME or NAME@hosts)
      nameAndHosts = line;
      rhs = undefined;
    } else {
      nameAndHosts = line.slice(0, eqIdx).trim();
      rhs = line.slice(eqIdx + 1);
    }

    // Parse NAME@host1,host2 format
    let name = nameAndHosts;
    let hosts: string[] = ["*"];

    const atIdx = nameAndHosts.indexOf("@");
    if (atIdx > 0) {
      name = nameAndHosts.slice(0, atIdx).trim();
      const hostsStr = nameAndHosts.slice(atIdx + 1).trim();
      if (hostsStr) {
        const parsed = hostsStr.split(",").map(h => h.trim()).filter(Boolean);
        if (parsed.length > 0) hosts = parsed;
      }
    }

    if (!name || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;

    // Determine type based on presence of = and RHS content
    if (rhs === undefined) {
      // No = sign: propagate
      result.push({ name, type: "propagate", hosts });
    } else if (/\$[A-Za-z_]|\$\{[A-Za-z_]/.test(rhs)) {
      // RHS contains $VAR or ${VAR}: reference
      result.push({ name, type: "reference", value: rhs, hosts });
    } else {
      // RHS is literal: static
      result.push({ name, type: "static", value: rhs, hosts });
    }
  }

  return result;
}

/**
 * Resolve a declaration to its current value.
 * Returns undefined if the value cannot be resolved (missing env var).
 */
function resolveDeclaration(decl: SecretDeclaration): string | undefined {
  switch (decl.type) {
    case "propagate": {
      // Read from process.env with the same name as the secret
      return process.env[decl.name];
    }
    case "static":
      return decl.value;
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

export class SecretsFileProvider extends ReadonlyVirtualProvider {
  private secretsFilePath: string | undefined;
  /** Set by vm-builder via setPlaceholders(). Maps name → placeholder string. */
  private placeholders: Map<string, string> = new Map();

  constructor(secretsFilePath?: string) {
    super();
    if (secretsFilePath) {
      this.secretsFilePath = secretsFilePath.startsWith("~")
        ? path.join(os.homedir(), secretsFilePath.slice(1))
        : secretsFilePath;
    }
  }

  // ---------------------------------------------------------------------------
  // SecretVFSProvider protocol
  // ---------------------------------------------------------------------------

  /** Phase 1: return all secrets with names and allowed hosts by parsing the config file. */
  listSecrets(): Array<{ name: string; hosts: string[] }> {
    if (!this.secretsFilePath) return [];
    const decls = parseSecretsFile(this.secretsFilePath);
    return decls.map(d => ({ name: d.name, hosts: d.hosts }));
  }

  /** Phase 2: receive the name→placeholder map from vm-builder. */
  setPlaceholders(map: Map<string, string>): void {
    this.placeholders = map;
  }

  /** Phase 3: read current secret value (called live at HTTP egress). */
  getSecretValue(name: string): string {
    if (!this.secretsFilePath) return "";
    const decls = parseSecretsFile(this.secretsFilePath);
    const decl = decls.find(d => d.name === name);
    if (!decl) return "";
    return resolveDeclaration(decl) ?? "";
  }

  // ---------------------------------------------------------------------------
  // VFS reads — always serve placeholders
  // ---------------------------------------------------------------------------

  statSync(vfsPath: string): fs.Stats {
    const norm = normalizeVfsPath(vfsPath);
    if (norm === "/") return createVirtualDirStats();

    const name = norm.slice(1);
    if (name.includes("/")) throw enoent(vfsPath);

    const placeholder = this.placeholders.get(name);
    if (!placeholder) throw enoent(vfsPath);

    return fileStats(Buffer.byteLength(placeholder, "utf-8"));
  }

  lstatSync(vfsPath: string): fs.Stats { return this.statSync(vfsPath); }

  readdirSync(vfsPath: string, options?: object): (string | fs.Dirent)[] {
    const norm = normalizeVfsPath(vfsPath);
    if (norm !== "/") throw enoent(vfsPath);
    const withTypes = (options as any)?.withFileTypes ?? false;
    return fileEntries(Array.from(this.placeholders.keys()), withTypes);
  }

  protected openReadonlySync(vfsPath: string): VirtualFileHandle {
    const norm = normalizeVfsPath(vfsPath);
    if (norm === "/") throw enoent(vfsPath);

    const name = norm.slice(1);
    if (name.includes("/")) throw enoent(vfsPath);

    const placeholder = this.placeholders.get(name);
    if (!placeholder) throw enoent(vfsPath);

    return new SecretFileHandle(vfsPath, Buffer.from(placeholder, "utf-8"));
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
  secretsFile?: string;
} = {}): VirtualProvider {
  const file = config.secretsFile ?? "~/.pi/secrets";
  return new SecretsFileProvider(file) as unknown as VirtualProvider;
}
