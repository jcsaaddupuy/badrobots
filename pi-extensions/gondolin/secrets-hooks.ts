/**
 * Dynamic secrets VFS + HTTP hooks for Gondolin
 *
 * Parses a host-side secrets file and provides:
 * - VFS mounts at /run/secrets/<NAME> (Docker-style)
 * - HTTP header injection via a custom onRequestHead hook
 *
 * Both are live: every access re-reads the secrets file and resolves
 * env vars at that moment — no snapshots, no caching.
 *
 * Secrets file format:
 *   # comment
 *   NAME@HOST[,HOST...][=VALUE]
 *
 *   If =VALUE is omitted, process.env[NAME] is read at access time.
 *   VALUE may contain '=' — everything after the first '=' is the raw value.
 */

import crypto from "node:crypto";
import fs from "node:fs";

import {
  VirtualProviderClass,
  ERRNO,
  createVirtualDirStats,
  formatVirtualEntries,
  normalizeVfsPath,
} from "@earendil-works/gondolin";
import type {
  VirtualProvider,
  VirtualFileHandle,
} from "@earendil-works/gondolin";
import type { HttpHooks, HttpHookRequest } from "@earendil-works/gondolin";
import { HttpRequestBlockedError } from "@earendil-works/gondolin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SecretEntry = {
  /** Secret name (= env var name when no literal value given) */
  name: string;
  /** Allowed hostname patterns for HTTP injection */
  hosts: string[];
  /** Literal value, or undefined → read process.env[name] */
  literalValue?: string;
};

export type CreateSecretsHooksOptions = {
  /** Extra allowed hosts beyond those inferred from secret entries */
  extraAllowedHosts?: string[];
};

export type CreateSecretsHooksResult = {
  /** Gondolin-compatible HTTP hooks with live secret resolution */
  httpHooks: HttpHooks;
  /** env map: NAME → random placeholder (same pattern as createHttpHooks) */
  env: Record<string, string>;
  /** Spread into VM.create vfs.mounts */
  vfsMounts: Record<string, VirtualProvider>;
};

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a secrets definition file and return the list of entries.
 * Called on every secret access — not cached.
 */
export function parseSecretsFile(filePath: string): SecretEntry[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const entries: SecretEntry[] = [];

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    // Skip blank lines and comments
    if (!line || line.startsWith("#")) continue;

    // Split on first '@'
    const atIdx = line.indexOf("@");
    if (atIdx === -1) {
      console.warn(`[secrets-hooks] Skipping malformed line (missing '@'): ${rawLine}`);
      continue;
    }

    const name = line.slice(0, atIdx).trim();
    if (!name) {
      console.warn(`[secrets-hooks] Skipping malformed line (empty name): ${rawLine}`);
      continue;
    }

    const rest = line.slice(atIdx + 1);

    // Split rest on first '=' → hosts and optional literal value
    const eqIdx = rest.indexOf("=");
    let hostsRaw: string;
    let literalValue: string | undefined;

    if (eqIdx === -1) {
      hostsRaw = rest;
      literalValue = undefined;
    } else {
      hostsRaw = rest.slice(0, eqIdx);
      literalValue = rest.slice(eqIdx + 1); // raw: may contain '='
    }

    const hosts = hostsRaw
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);

    if (hosts.length === 0) {
      console.warn(`[secrets-hooks] Skipping malformed line (no hosts): ${rawLine}`);
      continue;
    }

    // Warn if any host looks like a full URL instead of a bare hostname
    for (const host of hosts) {
      if (host.startsWith("http://") || host.startsWith("https://")) {
        console.warn(
          `[secrets-hooks] Host "${host}" for secret "${name}" looks like a full URL — ` +
          `only the domain should be used (e.g. "httpbin.org", not "https://httpbin.org/anything")`
        );
      }
    }

    entries.push({ name, hosts, literalValue });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Value resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the current value of a secret entry.
 * - If literalValue is defined → return it as-is.
 * - Otherwise → read process.env[name]; warn + return "" if missing.
 */
export function resolveSecretValue(entry: SecretEntry): string {
  if (entry.literalValue !== undefined) {
    return entry.literalValue;
  }

  const value = process.env[entry.name];
  if (value === undefined) {
    console.warn(
      `[secrets-hooks] Secret ${entry.name} is not set in host environment — returning empty string`
    );
    return "";
  }
  return value;
}

// ---------------------------------------------------------------------------
// VFS provider
// ---------------------------------------------------------------------------

/**
 * A single read-only directory provider mounted at /run/secrets.
 *
 * Security model: files contain the **placeholder** token
 * (e.g. GONDOLIN_SECRET_<random>), never the real secret value.
 * The guest reads the placeholder, uses it in HTTP headers, and
 * the host's onRequestHead hook substitutes the live value before
 * forwarding — so the plaintext secret never exists inside the VM.
 *
 * Handles the whole subtree:
 *   stat("/")          → directory stats
 *   stat("/<name>")    → file stats (size = placeholder length)
 *   readdir("/")       → list of secret names (re-reads secrets file)
 *   open("/<name>","r")→ SecretFileHandle containing the placeholder
 *
 * One mount, no per-file sub-mounts — avoids the MountRouterProvider
 * "virtual children" amplification that floods the virtio queue.
 */
class SecretsDirectoryProvider extends (VirtualProviderClass as any) implements VirtualProvider {
  readonly readonly = true;
  readonly supportsSymlinks = false;
  readonly supportsWatch = false;

  constructor(
    private readonly secretsFilePath: string,
    private readonly placeholders: Record<string, string>
  ) {
    super();
  }

  /**
   * Return the placeholder for a named secret.
   * If this secret was added to the file after VM creation, lazily generate and
   * register a new placeholder so it becomes available both in VFS and HTTP hooks.
   * Callers must have already verified the name exists in the current secrets file.
   */
  private _getOrCreatePlaceholder(name: string): string {
    if (!this.placeholders[name]) {
      // New secret added to file after VM creation — lazily register a placeholder.
      this.placeholders[name] = `GONDOLIN_SECRET_${crypto.randomBytes(24).toString("hex")}`;
    }
    return this.placeholders[name];
  }

  /** Return the set of names currently defined in the secrets file. */
  private _currentNames(): Set<string> {
    try {
      return new Set(parseSecretsFile(this.secretsFilePath).map((e) => e.name));
    } catch {
      return new Set();
    }
  }

  private _fileStats(size: number): fs.Stats {
    const now = Date.now();
    const stats = Object.create(fs.Stats.prototype);
    Object.assign(stats, {
      dev: 0,
      mode: 0o100444, // regular file, read-only
      nlink: 1,
      uid: 0,
      gid: 0,
      rdev: 0,
      blksize: 4096,
      ino: 0,
      size,
      blocks: Math.ceil(size / 512),
      atimeMs: now,
      mtimeMs: now,
      ctimeMs: now,
      birthtimeMs: now,
      atime: new Date(now),
      mtime: new Date(now),
      ctime: new Date(now),
      birthtime: new Date(now),
    });
    return stats;
  }

  stat(path: string): Promise<fs.Stats> {
    return Promise.resolve(this.statSync(path));
  }

  statSync(path: string): fs.Stats {
    const normalized = normalizeVfsPath(path);
    if (normalized === "/") return createVirtualDirStats();

    const name = normalized.slice(1);
    if (name.includes("/")) throw enoent(path);

    // Verify the name exists in the current secrets file
    if (!this._currentNames().has(name)) throw enoent(path);

    const placeholder = this._getOrCreatePlaceholder(name);
    return this._fileStats(Buffer.byteLength(placeholder, "utf-8"));
  }

  lstat(path: string): Promise<fs.Stats> { return this.stat(path); }
  lstatSync(path: string): fs.Stats { return this.statSync(path); }

  readdir(path: string, options?: object): Promise<any[]> {
    return Promise.resolve(this.readdirSync(path, options));
  }

  readdirSync(_path: string, options?: object): any[] {
    const entries = parseSecretsFile(this.secretsFilePath);
    const withTypes = (options as any)?.withFileTypes ?? false;
    return formatVirtualEntries(entries.map((e) => e.name), withTypes);
  }

  open(path: string, flags: string): Promise<VirtualFileHandle> {
    return Promise.resolve(this.openSync(path, flags));
  }

  openSync(path: string, _flags: string): VirtualFileHandle {
    const normalized = normalizeVfsPath(path);
    if (normalized === "/") throw enoent(path);
    const name = normalized.slice(1);
    if (name.includes("/")) throw enoent(path);

    // Verify the name exists in the current secrets file
    if (!this._currentNames().has(name)) throw enoent(path);

    const placeholder = this._getOrCreatePlaceholder(name);

    // Serve the placeholder — the real value is never written into the VM.
    return new SecretFileHandle(path, Buffer.from(placeholder, "utf-8"));
  }

  mkdir(): Promise<void> { return Promise.reject(notSupported("mkdir")); }
  mkdirSync(): void { throw notSupported("mkdirSync"); }
  rmdir(): Promise<void> { return Promise.reject(notSupported("rmdir")); }
  rmdirSync(): void { throw notSupported("rmdirSync"); }
  unlink(): Promise<void> { return Promise.reject(notSupported("unlink")); }
  unlinkSync(): void { throw notSupported("unlinkSync"); }
  rename(): Promise<void> { return Promise.reject(notSupported("rename")); }
  renameSync(): void { throw notSupported("renameSync"); }
}

// ---------------------------------------------------------------------------
// VFS file handle
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

  read(
    buffer: Buffer,
    offset: number,
    length: number,
    position?: number | null
  ): Promise<{ bytesRead: number; buffer: Buffer }> {
    return Promise.resolve(
      this.readSync(buffer, offset, length, position),
      // readSync returns bytesRead, not the result object — fix below
    ) as any;
  }

  // Implementing readSync properly and delegating read() to it
  readSync(
    buffer: Buffer,
    offset: number,
    length: number,
    position?: number | null
  ): number {
    const pos = position ?? this.position;
    const available = Math.max(0, this.data.length - pos);
    const bytesRead = Math.min(length, available);
    if (bytesRead > 0) {
      this.data.copy(buffer, offset, pos, pos + bytesRead);
    }
    if (position == null) {
      this.position = pos + bytesRead;
    }
    return bytesRead;
  }

  write(): Promise<{ bytesWritten: number; buffer: Buffer }> {
    return Promise.reject(notSupported("write"));
  }
  writeSync(): number {
    throw notSupported("writeSync");
  }

  readFile(
    options?: { encoding?: BufferEncoding } | BufferEncoding
  ): Promise<Buffer | string> {
    return Promise.resolve(this.readFileSync(options));
  }

  readFileSync(
    options?: { encoding?: BufferEncoding } | BufferEncoding
  ): Buffer | string {
    const enc =
      typeof options === "string"
        ? options
        : (options as any)?.encoding;
    return enc ? this.data.toString(enc) : Buffer.from(this.data);
  }

  writeFile(): Promise<void> {
    return Promise.reject(notSupported("writeFile"));
  }
  writeFileSync(): void {
    throw notSupported("writeFileSync");
  }

  stat(): Promise<fs.Stats> {
    return Promise.resolve(this.statSync());
  }

  statSync(): fs.Stats {
    const now = Date.now();
    const size = this.data.length;
    const stats = Object.create(fs.Stats.prototype);
    Object.assign(stats, {
      dev: 0,
      mode: 0o100444,
      nlink: 1,
      uid: 0,
      gid: 0,
      rdev: 0,
      blksize: 4096,
      ino: 0,
      size,
      blocks: Math.ceil(size / 512),
      atimeMs: now,
      mtimeMs: now,
      ctimeMs: now,
      birthtimeMs: now,
      atime: new Date(now),
      mtime: new Date(now),
      ctime: new Date(now),
      birthtime: new Date(now),
    });
    return stats;
  }

  truncate(): Promise<void> {
    return Promise.reject(notSupported("truncate"));
  }
  truncateSync(): void {
    throw notSupported("truncateSync");
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
  closeSync(): void {
    this.closed = true;
  }
}

// Properly wire read() so it returns the expected shape
(SecretFileHandle.prototype as any).read = function (
  this: SecretFileHandle,
  buffer: Buffer,
  offset: number,
  length: number,
  position?: number | null
): Promise<{ bytesRead: number; buffer: Buffer }> {
  const bytesRead = this.readSync(buffer, offset, length, position);
  return Promise.resolve({ bytesRead, buffer });
};

// ---------------------------------------------------------------------------
// Environment VFS provider
// ---------------------------------------------------------------------------

/**
 * A read-only directory provider mounted at /run/env.
 *
 * Serves host environment variables as files:
 *   /run/env/VAR_NAME → raw value from process.env[VAR_NAME]
 *
 * Every access re-reads process.env, so changes are live.
 * Values are NOT obfuscated (unlike secrets).
 *
 * If a name exists in both secrets and env vars, the secret takes precedence
 * (the caller should filter out secret names before mounting this provider).
 */
class EnvironmentDirectoryProvider extends (VirtualProviderClass as any) implements VirtualProvider {
  readonly readonly = true;
  readonly supportsSymlinks = false;
  readonly supportsWatch = false;

  constructor(private readonly secretNames?: Set<string>) {
    super();
  }

  /** Return the set of environment variable names, excluding any that are secrets. */
  private _currentEnvNames(): Set<string> {
    const names = new Set<string>();
    for (const key of Object.keys(process.env)) {
      // Skip secret names (they take precedence)
      if (this.secretNames?.has(key)) continue;
      names.add(key);
    }
    return names;
  }

  private _fileStats(size: number): fs.Stats {
    const now = Date.now();
    const stats = Object.create(fs.Stats.prototype);
    Object.assign(stats, {
      dev: 0,
      mode: 0o100444, // regular file, read-only
      nlink: 1,
      uid: 0,
      gid: 0,
      rdev: 0,
      blksize: 4096,
      ino: 0,
      size,
      blocks: Math.ceil(size / 512),
      atimeMs: now,
      mtimeMs: now,
      ctimeMs: now,
      birthtimeMs: now,
      atime: new Date(now),
      mtime: new Date(now),
      ctime: new Date(now),
      birthtime: new Date(now),
    });
    return stats;
  }

  stat(path: string): Promise<fs.Stats> {
    return Promise.resolve(this.statSync(path));
  }

  statSync(path: string): fs.Stats {
    const normalized = normalizeVfsPath(path);
    if (normalized === "/") return createVirtualDirStats();

    const name = normalized.slice(1);
    if (name.includes("/")) throw enoent(path);

    const value = process.env[name];
    if (value === undefined || this.secretNames?.has(name)) throw enoent(path);

    return this._fileStats(Buffer.byteLength(value, "utf-8"));
  }

  lstat(path: string): Promise<fs.Stats> { return this.stat(path); }
  lstatSync(path: string): fs.Stats { return this.statSync(path); }

  readdir(path: string, options?: object): Promise<any[]> {
    return Promise.resolve(this.readdirSync(path, options));
  }

  readdirSync(_path: string, options?: object): any[] {
    const names = Array.from(this._currentEnvNames());
    const withTypes = (options as any)?.withFileTypes ?? false;
    return formatVirtualEntries(names, withTypes);
  }

  open(path: string, flags: string): Promise<VirtualFileHandle> {
    return Promise.resolve(this.openSync(path, flags));
  }

  openSync(path: string, _flags: string): VirtualFileHandle {
    const normalized = normalizeVfsPath(path);
    if (normalized === "/") throw enoent(path);
    const name = normalized.slice(1);
    if (name.includes("/")) throw enoent(path);

    const value = process.env[name];
    if (value === undefined || this.secretNames?.has(name)) throw enoent(path);

    // Serve the raw environment variable value
    return new EnvironmentFileHandle(path, Buffer.from(value, "utf-8"));
  }

  mkdir(): Promise<void> { return Promise.reject(notSupported("mkdir")); }
  mkdirSync(): void { throw notSupported("mkdirSync"); }
  rmdir(): Promise<void> { return Promise.reject(notSupported("rmdir")); }
  rmdirSync(): void { throw notSupported("rmdirSync"); }
  unlink(): Promise<void> { return Promise.reject(notSupported("unlink")); }
  unlinkSync(): void { throw notSupported("unlinkSync"); }
  rename(): Promise<void> { return Promise.reject(notSupported("rename")); }
  renameSync(): void { throw notSupported("renameSync"); }
}

// ---------------------------------------------------------------------------
// Environment file handle
// ---------------------------------------------------------------------------

class EnvironmentFileHandle implements VirtualFileHandle {
  closed = false;
  readonly path: string;
  readonly flags = "r";
  readonly mode = 0o444;
  position = 0;

  constructor(path: string, private readonly data: Buffer) {
    this.path = path;
  }

  read(
    buffer: Buffer,
    offset: number,
    length: number,
    position?: number | null
  ): Promise<{ bytesRead: number; buffer: Buffer }> {
    return Promise.resolve(
      this.readSync(buffer, offset, length, position),
    ) as any;
  }

  readSync(
    buffer: Buffer,
    offset: number,
    length: number,
    position?: number | null
  ): number {
    const pos = position ?? this.position;
    const available = Math.max(0, this.data.length - pos);
    const bytesRead = Math.min(length, available);
    if (bytesRead > 0) {
      this.data.copy(buffer, offset, pos, pos + bytesRead);
    }
    if (position == null) {
      this.position = pos + bytesRead;
    }
    return bytesRead;
  }

  write(): Promise<{ bytesWritten: number; buffer: Buffer }> {
    return Promise.reject(notSupported("write"));
  }
  writeSync(): number {
    throw notSupported("writeSync");
  }

  readFile(
    options?: { encoding?: BufferEncoding } | BufferEncoding
  ): Promise<Buffer | string> {
    return Promise.resolve(this.readFileSync(options));
  }

  readFileSync(
    options?: { encoding?: BufferEncoding } | BufferEncoding
  ): Buffer | string {
    const enc =
      typeof options === "string"
        ? options
        : (options as any)?.encoding;
    return enc ? this.data.toString(enc) : Buffer.from(this.data);
  }

  writeFile(): Promise<void> {
    return Promise.reject(notSupported("writeFile"));
  }
  writeFileSync(): void {
    throw notSupported("writeFileSync");
  }

  stat(): Promise<fs.Stats> {
    return Promise.resolve(this.statSync());
  }

  statSync(): fs.Stats {
    const now = Date.now();
    const size = this.data.length;
    const stats = Object.create(fs.Stats.prototype);
    Object.assign(stats, {
      dev: 0,
      mode: 0o100444,
      nlink: 1,
      uid: 0,
      gid: 0,
      rdev: 0,
      blksize: 4096,
      ino: 0,
      size,
      blocks: Math.ceil(size / 512),
      atimeMs: now,
      mtimeMs: now,
      ctimeMs: now,
      birthtimeMs: now,
      atime: new Date(now),
      mtime: new Date(now),
      ctime: new Date(now),
      birthtime: new Date(now),
    });
    return stats;
  }

  truncate(): Promise<void> {
    return Promise.reject(notSupported("truncate"));
  }
  truncateSync(): void {
    throw notSupported("truncateSync");
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
  closeSync(): void {
    this.closed = true;
  }
}

// Properly wire read() so it returns the expected shape
(EnvironmentFileHandle.prototype as any).read = function (
  this: EnvironmentFileHandle,
  buffer: Buffer,
  offset: number,
  length: number,
  position?: number | null
): Promise<{ bytesRead: number; buffer: Buffer }> {
  const bytesRead = this.readSync(buffer, offset, length, position);
  return Promise.resolve({ bytesRead, buffer });
};

// ---------------------------------------------------------------------------
// HTTP hooks
// ---------------------------------------------------------------------------

function buildHttpHooks(
  secretsFilePath: string,
  placeholders: Record<string, string>, // name → placeholder
  allowedHosts: string[]
): HttpHooks {
  return {
    isIpAllowed: async (info) => {
      if (allowedHosts.length === 0) return true;
      // Simple wildcard match inline (avoids importing matchesAnyHost from private path)
      const hostname = info.hostname.toLowerCase();
      return allowedHosts.some((pattern) => matchHostname(hostname, pattern));
    },

    onRequestHead: async (request) => {
      const entries = parseSecretsFile(secretsFilePath);

      // Build a lookup: placeholder → entry
      // For secrets added after VM creation, lazily generate and register a placeholder.
      const byPlaceholder = new Map<string, SecretEntry>();
      for (const entry of entries) {
        if (!placeholders[entry.name]) {
          placeholders[entry.name] = `GONDOLIN_SECRET_${crypto.randomBytes(24).toString("hex")}`;
        }
        byPlaceholder.set(placeholders[entry.name], entry);
      }

      const hostname = getHostname(request.url);

      // Defense-in-depth: block real secret values going to non-allowed hosts
      for (const entry of entries) {
        const value = resolveSecretValue(entry);
        if (!value) continue;
        if (matchesAnyHostPattern(hostname, entry.hosts)) continue;
        if (requestContainsValue(request, value)) {
          throw new HttpRequestBlockedError(
            `secret ${entry.name} not allowed for host: ${hostname || "unknown"}`
          );
        }
      }

      // Replace placeholders in headers with live-resolved values
      const headers = replacePlaceholdersInHeaders(
        request.headers,
        hostname,
        byPlaceholder
      );

      return { ...request, headers };
    },
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Build HTTP hooks + VFS mounts from a secrets definition file.
 *
 * @param secretsFilePath  Absolute path to the secrets file on the host.
 * @param options          Optional extra configuration.
 */
export function createSecretsHooks(
  secretsFilePath: string,
  options: CreateSecretsHooksOptions = {}
): CreateSecretsHooksResult {
  // Read the file once at init to get the list of secret names and build
  // per-name placeholders.  Values themselves are NOT stored — they are
  // resolved live on each access.
  const initialEntries = parseSecretsFile(secretsFilePath);

  // Build placeholder map (name → random placeholder)
  const env: Record<string, string> = {};
  const placeholders: Record<string, string> = {};

  for (const entry of initialEntries) {
    const placeholder = `GONDOLIN_SECRET_${crypto.randomBytes(24).toString("hex")}`;
    env[entry.name] = placeholder;
    placeholders[entry.name] = placeholder;
  }

  // Build allowed hosts from all secret entries + extras
  const allHosts = [
    ...initialEntries.flatMap((e) => e.hosts),
    ...(options.extraAllowedHosts ?? []),
  ];
  const allowedHosts = uniqueNormalized(allHosts);

  // Single VFS mount at /run/secrets — SecretsDirectoryProvider handles
  // both readdir("/") and open("/<name>") internally.
  // Files contain the placeholder token, not the real value — the secret
  // never exists in plaintext inside the VM.
  const vfsMounts: Record<string, VirtualProvider> = {
    "/run/secrets": new SecretsDirectoryProvider(secretsFilePath, placeholders) as unknown as VirtualProvider,
  };

  const httpHooks = buildHttpHooks(secretsFilePath, placeholders, allowedHosts);

  return { httpHooks, env, vfsMounts };
}

/**
 * Create a VFS mount for dynamic environment variables at /run/env.
 *
 * @param secretNames Set of secret names that should be excluded from the env VFS.
 *                    (Secrets take precedence over env vars if both exist.)
 * @returns VFS mounts object suitable for spreading into VM.create vfs.mounts
 */
export function createEnvironmentVfs(secretNames?: Set<string>): Record<string, VirtualProvider> {
  return {
    "/run/env": new EnvironmentDirectoryProvider(secretNames) as unknown as VirtualProvider,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function matchHostname(hostname: string, pattern: string): boolean {
  const p = pattern.trim().toLowerCase();
  if (!p) return false;
  if (p === "*") return true;
  const escaped = p
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`, "i").test(hostname);
}

function matchesAnyHostPattern(hostname: string, patterns: string[]): boolean {
  return patterns.some((p) => matchHostname(hostname, p));
}

function uniqueNormalized(hosts: string[]): string[] {
  const seen = new Set<string>();
  return hosts
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h && !seen.has(h) && seen.add(h));
}

function requestContainsValue(request: HttpHookRequest, value: string): boolean {
  for (const v of Object.values(request.headers)) {
    if (!v) continue;
    if (v.includes(value)) return true;
    // Basic auth decode
    const decoded = tryDecodeBasicAuth(v);
    if (decoded && decoded.includes(value)) return true;
  }
  return false;
}

function tryDecodeBasicAuth(headerValue: string): string | null {
  const match = headerValue.match(/^Basic\s+(\S+)\s*$/i);
  if (!match) return null;
  try {
    return Buffer.from(match[1], "base64").toString("utf8");
  } catch {
    return null;
  }
}

function replacePlaceholdersInHeaders(
  headers: Record<string, string>,
  hostname: string,
  byPlaceholder: Map<string, SecretEntry>
): Record<string, string> {
  if (byPlaceholder.size === 0) return headers;

  const result: Record<string, string> = { ...headers };

  for (const [headerName, headerValue] of Object.entries(result)) {
    let updated = headerValue;

    // Plain text replacement
    updated = replacePlaceholdersInString(updated, hostname, byPlaceholder);

    // Basic auth (base64 encoded credentials)
    updated = replaceBasicAuthPlaceholders(headerName, updated, hostname, byPlaceholder);

    result[headerName] = updated;
  }

  return result;
}

function replacePlaceholdersInString(
  value: string,
  hostname: string,
  byPlaceholder: Map<string, SecretEntry>
): string {
  let updated = value;
  for (const [placeholder, entry] of byPlaceholder) {
    if (!updated.includes(placeholder)) continue;
    if (!matchesAnyHostPattern(hostname, entry.hosts)) {
      throw new HttpRequestBlockedError(
        `secret ${entry.name} not allowed for host: ${hostname || "unknown"}`
      );
    }
    const value = resolveSecretValue(entry);
    updated = updated.split(placeholder).join(value);
  }
  return updated;
}

function replaceBasicAuthPlaceholders(
  headerName: string,
  headerValue: string,
  hostname: string,
  byPlaceholder: Map<string, SecretEntry>
): string {
  if (!/^(authorization|proxy-authorization)$/i.test(headerName)) {
    return headerValue;
  }
  const match = headerValue.match(/^(Basic)(\s+)(\S+)(\s*)$/i);
  if (!match) return headerValue;

  const [, scheme, ws, token, trailing] = match;
  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64").toString("utf8");
  } catch {
    return headerValue;
  }

  const updatedDecoded = replacePlaceholdersInString(decoded, hostname, byPlaceholder);
  if (updatedDecoded === decoded) return headerValue;

  const updatedToken = Buffer.from(updatedDecoded, "utf8").toString("base64");
  return `${scheme}${ws}${updatedToken}${trailing}`;
}

function enoent(path: string): Error {
  const err: any = new Error(`ENOENT: no such file or directory, '${path}'`);
  err.code = "ENOENT";
  err.errno = -ERRNO.ENOENT;
  return err;
}

function notSupported(op: string): Error {
  const err: any = new Error(`EROFS: operation not supported, ${op}`);
  err.code = "EROFS";
  err.errno = -ERRNO.EROFS;
  return err;
}
