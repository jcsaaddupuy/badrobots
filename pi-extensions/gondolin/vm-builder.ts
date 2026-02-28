/**
 * VM Creation Options Builder
 *
 * Orchestrates three independent concerns in strict order:
 * 1. Exec env (config.environment → resolveEnvironmentVars)
 * 2. HTTP secrets (config.secrets → createHttpHooks, VFS secrets → onRequestHead wrapper)
 * 3. VFS file mounts (gondolin-vfs-* packages)
 *
 * The guest NEVER sees a real secret value — only GONDOLIN_SECRET_<hex> placeholders.
 */

import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import {
  RealFSProvider,
  ReadonlyProvider,
  MemoryProvider,
  createHttpHooks,
  HttpRequestBlockedError,
} from "@earendil-works/gondolin";
import type { HttpHookRequest, HttpHookRequestHeadResult } from "@earendil-works/gondolin";
import {
  type GondolinConfig,
  resolveEnvironmentVars,
  prepareSecretsForGondolin,
  expandSkillPaths,
  getGuestImagePath,
} from "./config";
import {
  instantiateVFSProviders,
  buildVFSMounts,
  type VFSProviderInstance,
  type SecretVFSProvider,
} from "./vfs";

const WORKSPACE = "/root/workspace";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VMCreationContext {
  vmName: string;
  localCwd: string;
  sessionId: string;
  config: GondolinConfig;
  overrides?: {
    mountCwd?: boolean;
    mountSkills?: boolean;
    skillsReadOnly?: boolean;
  };
}

export interface BuildVMOptionsResult {
  options: any;
  warnings: string[];
  skillPaths: string[];
  customMounts: { guestPath: string; hostPath: string; writable: boolean }[];
  /** True if any provider with providesSecrets:true was successfully instantiated */
  secretsMounted: boolean;
}

type VfsSecretEntry = {
  name: string;
  placeholder: string;
  hosts: string[];
  provider: SecretVFSProvider;
};

// ---------------------------------------------------------------------------
// Host pattern matching (mirrors gondolin's internal matchesAnyHost)
// ---------------------------------------------------------------------------

function matchHostnamePattern(hostname: string, pattern: string): boolean {
  const p = pattern.trim().toLowerCase();
  if (!p) return false;
  if (p === "*") return true;
  const escaped = p
    .split("*")
    .map(s => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`, "i").test(hostname);
}

function matchesAnyHostPattern(hostname: string, patterns: string[]): boolean {
  return patterns.some(p => matchHostnamePattern(hostname, p));
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

/**
 * Build VM creation options from configuration.
 * Implements the 10-step orchestration described in TODO-4.
 */
export async function buildVMOptions(ctx: VMCreationContext): Promise<BuildVMOptionsResult> {
  const warnings: string[] = [];
  const { config, vmName, localCwd, sessionId, overrides } = ctx;

  const PI_PREFIX = "pi:";
  const sessionLabel = `${PI_PREFIX}${sessionId}:${vmName}`;

  // =======================================================================
  // Step 1 — Resolve exec env from config.environment
  // =======================================================================
  let execEnv: Record<string, string> = {};

  if (Object.keys(config.environment).length > 0) {
    const { env: resolvedEnv, warnings: envWarnings } = resolveEnvironmentVars(config.environment);
    execEnv = resolvedEnv;
    envWarnings.forEach(w => warnings.push(w));
  }

  // =======================================================================
  // Step 2 — Prepare static secrets from config.secrets
  // =======================================================================
  let staticSecrets: Record<string, { hosts: string[]; value: string }> = {};

  if (Object.keys(config.secrets).length > 0) {
    const { secrets, warnings: secretWarnings } = prepareSecretsForGondolin(config.secrets);
    staticSecrets = secrets;
    secretWarnings.forEach(w => warnings.push(w));
  }

  // =======================================================================
  // Step 3 — Discover and instantiate all VFS providers
  // =======================================================================
  const { instances, warnings: vfsWarnings, errors: vfsErrors } = instantiateVFSProviders(config);
  vfsWarnings.forEach(w => warnings.push(w));
  vfsErrors.forEach(e => warnings.push(`VFS [${e.packageName}]: ${e.error}`));

  // =======================================================================
  // Step 4 — Pull secret names from VFS providers, generate placeholders
  // =======================================================================
  const vfsSecretEntries: VfsSecretEntry[] = [];

  for (const inst of instances) {
    if (!inst.manifest.providesSecrets) continue;

    const provider = inst.provider as unknown as SecretVFSProvider;
    if (typeof provider.listSecrets !== "function" || typeof provider.setPlaceholders !== "function") {
      warnings.push(
        `VFS [${inst.packageName}]: manifest declares providesSecrets but provider missing listSecrets/setPlaceholders`
      );
      continue;
    }

    let secrets: Array<{ name: string; hosts: string[] }>;
    try {
      secrets = provider.listSecrets();
    } catch (err) {
      warnings.push(`VFS [${inst.packageName}]: listSecrets threw: ${err}`);
      continue;
    }

    const ownPlaceholders = new Map<string, string>();

    for (const secret of secrets) {
      const { name, hosts } = secret;

      // Conflict: config.secrets wins
      if (staticSecrets[name]) {
        warnings.push(`Secret "${name}" from VFS [${inst.packageName}] conflicts with config.secrets — ignored`);
        continue;
      }
      // Conflict: another VFS provider already owns this name
      const existing = vfsSecretEntries.find(e => e.name === name);
      if (existing) {
        warnings.push(`Secret "${name}" from VFS [${inst.packageName}] already registered — ignored`);
        continue;
      }

      const placeholder = `GONDOLIN_SECRET_${crypto.randomBytes(24).toString("hex")}`;
      vfsSecretEntries.push({ name, placeholder, hosts, provider });
      ownPlaceholders.set(name, placeholder);
    }

    try {
      provider.setPlaceholders(ownPlaceholders);
    } catch (err) {
      warnings.push(`VFS [${inst.packageName}]: setPlaceholders threw: ${err}`);
    }
  }

  // =======================================================================
  // Step 5 — Build full secret name set
  // =======================================================================
  const allSecretNames = new Set<string>([
    ...Object.keys(staticSecrets),
    ...vfsSecretEntries.map(e => e.name),
  ]);

  // =======================================================================
  // Step 6 — Notify secret-aware VFS providers (e.g. gondolin-vfs-environment)
  // =======================================================================
  for (const inst of instances) {
    const provider = inst.provider as any;
    if (typeof provider.setSecretNames === "function") {
      try {
        const conflicts: string[] = provider.setSecretNames(allSecretNames);
        if (Array.isArray(conflicts)) {
          for (const name of conflicts) {
            warnings.push(
              `Environment variable "${name}" in VFS provider ${inst.packageName} conflicts with a secret — excluded from /run/env`
            );
          }
        }
      } catch (err) {
        warnings.push(`VFS [${inst.packageName}]: setSecretNames threw: ${err}`);
      }
    }
  }

  // =======================================================================
  // Step 7 — createHttpHooks (config.secrets only — gondolin native)
  // =======================================================================
  const hooksResult = createHttpHooks({
    allowedHosts: [
      ...config.network.allowedHosts,
      // Also allow hosts declared by VFS secret providers
      ...vfsSecretEntries.flatMap(e => e.hosts),
    ],
    blockInternalRanges: config.network.blockInternalRanges,
    secrets: staticSecrets,
  });

  const httpHooks = hooksResult.httpHooks;
  const staticPlaceholderEnv = hooksResult.env;

  // =======================================================================
  // Step 8 — Wrap onRequestHead for live VFS secrets
  // =======================================================================
  if (vfsSecretEntries.length > 0) {
    const originalOnRequestHead = httpHooks.onRequestHead;

    httpHooks.onRequestHead = async (request: HttpHookRequest): Promise<HttpHookRequestHeadResult> => {
      const hostname = extractHostname(request.url);
      let headers = { ...request.headers };

      // Substitute VFS secret placeholders with live values
      for (const entry of vfsSecretEntries) {
        let hasPlaceholder = false;

        for (const [key, val] of Object.entries(headers)) {
          if (!val?.includes(entry.placeholder)) continue;
          hasPlaceholder = true;

          if (!matchesAnyHostPattern(hostname, entry.hosts)) {
            throw new HttpRequestBlockedError(
              `secret ${entry.name} not allowed for host: ${hostname || "unknown"}`
            );
          }

          headers[key] = val.split(entry.placeholder).join(entry.provider.getSecretValue(entry.name));
        }

        // Defense-in-depth: block real secret value going to unauthorized host
        if (!hasPlaceholder) {
          const realVal = entry.provider.getSecretValue(entry.name);
          if (realVal && !matchesAnyHostPattern(hostname, entry.hosts)) {
            for (const val of Object.values(headers)) {
              if (val?.includes(realVal)) {
                throw new HttpRequestBlockedError(
                  `secret ${entry.name} not allowed for host: ${hostname || "unknown"}`
                );
              }
            }
          }
        }
      }

      // Delegate to gondolin's original handler for config.secrets substitution
      if (originalOnRequestHead) {
        const result = await originalOnRequestHead({ ...request, headers });
        return result ?? ({ ...request, headers } as HttpHookRequestHeadResult);
      }
      return { ...request, headers } as HttpHookRequestHeadResult;
    };
  }

  // =======================================================================
  // Step 9 — Assemble final VM env
  // =======================================================================
  const guestHomeDir = config.sandbox.homeDir || "/root";
  const guestTmpDir = "/tmp";

  const vfsPlaceholderEnv = Object.fromEntries(
    vfsSecretEntries.map(e => [e.name, e.placeholder])
  );

  const env: Record<string, string> = {
    HOME: guestHomeDir,
    TMPDIR: guestTmpDir,
    PI_TMUX_SOCKET_DIR: `${guestTmpDir}/pi-tmux-sockets`,
    ...execEnv,              // plain declared vars
    ...staticPlaceholderEnv, // config.secrets placeholders (gondolin-generated)
    ...vfsPlaceholderEnv,    // VFS secrets placeholders (vm-builder-generated)
  };

  // =======================================================================
  // Step 10 — Build VFS mounts and create VM options
  // =======================================================================
  const mounts: Record<string, any> = {};

  // Handle CWD mounting
  const mountCwd = overrides?.mountCwd ?? config.workspace.mountCwd;
  if (mountCwd) {
    if (config.workspace.cwdWritable) {
      mounts[WORKSPACE] = new RealFSProvider(localCwd);
    } else {
      mounts[WORKSPACE] = new ReadonlyProvider(new RealFSProvider(localCwd));
    }
  } else {
    mounts[WORKSPACE] = new MemoryProvider();
  }

  // Handle skills mounting
  const mountSkills = overrides?.mountSkills ?? config.skills.enabled;
  const skillPaths: string[] = [];

  if (mountSkills) {
    const skillsReadOnly = overrides?.skillsReadOnly ?? config.skills.readOnly;

    if (config.skills.mountDefault) {
      const homeDir = process.env.HOME || "/root";
      const skillsBaseDir = path.join(homeDir, ".pi/agent/skills");

      if (fs.existsSync(skillsBaseDir)) {
        const fsProvider = new RealFSProvider(skillsBaseDir);
        mounts["/root/.pi/agent/skills"] = skillsReadOnly
          ? new ReadonlyProvider(fsProvider)
          : fsProvider;
        skillPaths.push(skillsBaseDir);
      } else {
        warnings.push(`Default skills directory not found: ${skillsBaseDir}`);
      }
    }

    if (config.skills.customPaths.length > 0) {
      const { expanded, warnings: expandWarnings } = expandSkillPaths(config.skills.customPaths);

      for (let i = 0; i < expanded.length; i++) {
        const skillPath = expanded[i];
        if (!fs.existsSync(skillPath)) {
          warnings.push(`Custom skill path not found: ${skillPath}`);
          continue;
        }
        const guestPath = `/root/.pi/skills/${i}`;
        const fsProvider = new RealFSProvider(skillPath);
        mounts[guestPath] = skillsReadOnly
          ? new ReadonlyProvider(fsProvider)
          : fsProvider;
        skillPaths.push(skillPath);
      }

      expandWarnings.forEach(w => warnings.push(w));
    }
  }

  // Handle custom mounts
  const customMounts: { guestPath: string; hostPath: string; writable: boolean }[] = [];
  if (config.customMounts && Object.keys(config.customMounts).length > 0) {
    for (const [guestPath, mount] of Object.entries(config.customMounts)) {
      if (!fs.existsSync(mount.hostPath)) {
        warnings.push(`Custom mount host path not found: ${mount.hostPath}`);
        continue;
      }
      const fsProvider = new RealFSProvider(mount.hostPath);
      mounts[guestPath] = mount.writable ? fsProvider : new ReadonlyProvider(fsProvider);
      customMounts.push({ guestPath, hostPath: mount.hostPath, writable: mount.writable });
    }
  }

  // Mount external VFS providers (gondolin-vfs-* packages)
  const vfsMountMap = buildVFSMounts(instances);
  Object.assign(mounts, vfsMountMap);

  // Build final VM options
  const vmCreateOptions: any = {
    sessionLabel,
    httpHooks,
    env,
    vfs: { mounts },
  };

  const guestImagePath = await getGuestImagePath();
  if (guestImagePath) {
    vmCreateOptions.sandbox = { imagePath: guestImagePath };
  }

  return {
    options: vmCreateOptions,
    warnings,
    skillPaths,
    customMounts,
    secretsMounted: instances.some(i => i.manifest.providesSecrets === true),
  };
}

/**
 * Format warnings for user display
 */
export function formatVMCreationWarnings(warnings: string[]): string {
  if (warnings.length === 0) return "";
  return (
    "Warnings:\n" +
    warnings.map(w => `  - ${w}`).join("\n")
  );
}
