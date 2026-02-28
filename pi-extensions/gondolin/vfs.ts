/**
 * External VFS Provider Discovery, Mounting, and Secret Registration
 *
 * Discovers gondolin-vfs-* packages from node_modules, validates their
 * gondolin-vfs.json manifests, and instantiates VirtualProvider instances.
 * vm-builder calls instantiateVFSProviders() then buildVFSMounts() separately
 * so secret registration can happen in between.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { VirtualProvider } from "@earendil-works/gondolin";
import type { GondolinConfig } from "./config";

// ---------------------------------------------------------------------------
// Secret provider interfaces
// ---------------------------------------------------------------------------

/**
 * Implemented by VFS providers that own secrets (manifest.providesSecrets === true).
 *
 * Pull model — vm-builder drives the protocol:
 *   1. listSecrets()       → discover names + hosts at VM creation time
 *   2. setPlaceholders()   → vm-builder hands back name→placeholder map
 *   3. getSecretValue()    → called live at HTTP egress (value may have changed)
 */
export interface SecretVFSProvider {
  /** Return all secrets with names and allowed hosts. Called once at VM creation. */
  listSecrets(): Array<{ name: string; hosts: string[] }>;
  /**
   * Receive the final name→placeholder map from vm-builder.
   * Provider stores this and returns placeholder content from VFS reads.
   */
  setPlaceholders(map: Map<string, string>): void;
  /** Fetch the current secret value. Called live on each outbound HTTP request. */
  getSecretValue(name: string): string;
}

/**
 * Optional interface for providers that must exclude secret names from their
 * own listings (e.g. gondolin-vfs-environment excludes secrets from /run/env).
 * Returns the list of names that conflict.
 */
export interface SecretAwareVFSProvider {
  setSecretNames(names: Set<string>): string[];
}

// ---------------------------------------------------------------------------
// Manifest shape
// ---------------------------------------------------------------------------

export interface VFSConfigField {
  key: string;
  label: string;
  type: "string" | "boolean" | "select";
  options?: string[];  // for type "select"
  default?: string;
  description?: string;
}

export interface VFSManifest {
  name: string;
  version: string;
  gondolinVersion: string;
  displayName: string;
  description?: string;
  /** Key in GondolinConfig.vfs (e.g. "vault") */
  configNamespace: string;
  /** Relative path from the package root to the factory entry point */
  factory: string;
  capabilities: string[];
  readonly: boolean;
  /** Default VM mount point (e.g. "/run/vault"). Can be overridden in config. */
  defaultMountPoint: string;
  /** Typed field declarations for TUI config rendering */
  configSchema?: VFSConfigField[];
  /** If true, provider implements SecretVFSProvider (listSecrets/setPlaceholders/getSecretValue) */
  providesSecrets?: boolean;
}

export interface VFSProviderInstance {
  packageName: string;
  packagePath: string;
  manifest: VFSManifest;
  /** VirtualProvider instance created by the factory */
  provider: VirtualProvider;
  /** Resolved mount point (from config or manifest default) */
  mountPoint: string;
}

export interface VFSDiscoveryResult {
  mounts: Record<string, VirtualProvider>;
  discovered: VFSProviderInstance[];
  warnings: string[];
  errors: Array<{ packageName: string; error: string }>;
}

export interface VFSInstantiationResult {
  instances: VFSProviderInstance[];
  warnings: string[];
  errors: Array<{ packageName: string; error: string }>;
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

/** Scan node_modules for gondolin-vfs-* packages */
function findVFSPackages(nodeModulesDir: string): string[] {
  const found: string[] = [];
  if (!fs.existsSync(nodeModulesDir)) return found;

  for (const entry of fs.readdirSync(nodeModulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;

    if (entry.name.startsWith("gondolin-vfs-")) {
      found.push(path.join(nodeModulesDir, entry.name));
    }

    // Scoped packages: @org/gondolin-vfs-*
    if (entry.name.startsWith("@")) {
      const scopeDir = path.join(nodeModulesDir, entry.name);
      try {
        for (const scoped of fs.readdirSync(scopeDir, { withFileTypes: true })) {
          if (scoped.name.startsWith("gondolin-vfs-") && (scoped.isDirectory() || scoped.isSymbolicLink())) {
            found.push(path.join(scopeDir, scoped.name));
          }
        }
      } catch { /* ignore */ }
    }
  }

  // Sort alphabetically for deterministic discovery order
  found.sort();
  return found;
}

function loadManifest(packagePath: string): VFSManifest | null {
  const manifestPath = path.join(packagePath, "gondolin-vfs.json");
  if (!fs.existsSync(manifestPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as VFSManifest;
  } catch {
    return null;
  }
}

function validateManifest(m: VFSManifest): string[] {
  const errors: string[] = [];
  if (!m.name) errors.push("missing 'name'");
  if (!m.version) errors.push("missing 'version'");
  if (!m.gondolinVersion) errors.push("missing 'gondolinVersion'");
  if (!m.displayName) errors.push("missing 'displayName'");
  if (!m.configNamespace) errors.push("missing 'configNamespace'");
  if (!m.factory) errors.push("missing 'factory'");
  if (!Array.isArray(m.capabilities)) errors.push("'capabilities' must be an array");
  if (typeof m.readonly !== "boolean") errors.push("'readonly' must be boolean");
  if (!m.defaultMountPoint) errors.push("missing 'defaultMountPoint'");
  return errors;
}

function resolveBaseDir(): string {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return typeof __dirname !== "undefined" ? __dirname : process.cwd();
  }
}

// ---------------------------------------------------------------------------
// Instantiation (Phase 1 — no mounts built yet)
// ---------------------------------------------------------------------------

/**
 * Discover and instantiate external VFS providers without building mounts.
 * vm-builder calls this first, then does secret registration, then calls
 * buildVFSMounts() to get the final mount map.
 */
export function instantiateVFSProviders(
  config: GondolinConfig,
  nodeModulesDir?: string
): VFSInstantiationResult {
  const result: VFSInstantiationResult = {
    instances: [],
    warnings: [],
    errors: [],
  };

  const nmDir = nodeModulesDir ?? path.join(resolveBaseDir(), "node_modules");
  const packagePaths = findVFSPackages(nmDir);

  if (packagePaths.length === 0) return result;

  for (const packagePath of packagePaths) {
    const packageName = packagePath.split(path.sep).pop() ?? packagePath;

    // Load + validate manifest
    const manifest = loadManifest(packagePath);
    if (!manifest) {
      result.errors.push({ packageName, error: "no gondolin-vfs.json manifest found" });
      continue;
    }

    const manifestErrors = validateManifest(manifest);
    if (manifestErrors.length > 0) {
      result.errors.push({ packageName, error: `invalid manifest: ${manifestErrors.join(", ")}` });
      continue;
    }

    // Check per-provider config
    const providerConfig = config.vfs?.[packageName] ?? config.vfs?.[manifest.configNamespace];
    if (providerConfig && providerConfig.enabled === false) {
      result.warnings.push(`${manifest.displayName} is disabled in config`);
      continue;
    }

    // Resolve mount point
    const mountPoint = providerConfig?.mountPoint ?? manifest.defaultMountPoint;

    // Check for mount point conflicts
    if (result.instances.some(i => i.mountPoint === mountPoint)) {
      result.errors.push({ packageName, error: `mount point '${mountPoint}' already in use` });
      continue;
    }

    // Load factory
    const factoryPath = path.join(packagePath, manifest.factory);
    if (!fs.existsSync(factoryPath)) {
      result.errors.push({ packageName, error: `factory not found: ${manifest.factory}` });
      continue;
    }

    let provider: VirtualProvider;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(factoryPath);
      const factory = mod.default ?? mod;
      if (typeof factory !== "function") {
        result.errors.push({ packageName, error: "factory is not a function" });
        continue;
      }
      provider = factory(providerConfig ?? {});
      if (!provider) {
        result.errors.push({ packageName, error: "factory returned null" });
        continue;
      }
    } catch (err) {
      result.errors.push({ packageName, error: `factory threw: ${err}` });
      continue;
    }

    result.instances.push({ packageName, packagePath, manifest, provider, mountPoint });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Mount building (Phase 2 — after secret registration)
// ---------------------------------------------------------------------------

/**
 * Build a mount map from previously instantiated providers.
 */
export function buildVFSMounts(
  instances: VFSProviderInstance[]
): Record<string, VirtualProvider> {
  const mounts: Record<string, VirtualProvider> = {};
  for (const inst of instances) {
    mounts[inst.mountPoint] = inst.provider;
  }
  return mounts;
}

// ---------------------------------------------------------------------------
// Legacy: loadExternalVFSProviders (calls both phases, no secret registration)
// ---------------------------------------------------------------------------

/**
 * Legacy convenience wrapper. Instantiates + builds mounts in one call.
 * Does NOT support secret registration — use instantiateVFSProviders +
 * buildVFSMounts for that.
 */
export function loadExternalVFSProviders(
  config: GondolinConfig,
  nodeModulesDir?: string
): VFSDiscoveryResult {
  const { instances, warnings, errors } = instantiateVFSProviders(config, nodeModulesDir);
  const mounts = buildVFSMounts(instances);
  return { mounts, discovered: instances, warnings, errors };
}

// ---------------------------------------------------------------------------
// List available providers (for TUI / CLI display)
// ---------------------------------------------------------------------------

export interface AvailableProvider {
  packageName: string;
  manifest: VFSManifest;
  config: GondolinConfig["vfs"][string] | undefined;
  enabled: boolean;
  mountPoint: string;
}

export function listAvailableVFSProviders(
  config: GondolinConfig,
  nodeModulesDir?: string
): AvailableProvider[] {
  const nmDir = nodeModulesDir ?? path.join(resolveBaseDir(), "node_modules");
  const packagePaths = findVFSPackages(nmDir);
  const result: AvailableProvider[] = [];

  for (const packagePath of packagePaths) {
    const packageName = packagePath.split(path.sep).pop() ?? packagePath;
    const manifest = loadManifest(packagePath);
    if (!manifest || validateManifest(manifest).length > 0) continue;

    const providerConfig = config.vfs?.[packageName] ?? config.vfs?.[manifest.configNamespace];
    const enabled = providerConfig ? providerConfig.enabled !== false : true;
    const mountPoint = providerConfig?.mountPoint ?? manifest.defaultMountPoint;

    result.push({ packageName, manifest, config: providerConfig, enabled, mountPoint });
  }

  return result;
}
