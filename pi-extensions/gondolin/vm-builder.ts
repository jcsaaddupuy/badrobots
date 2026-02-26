/**
 * VM Creation Options Builder
 * Constructs VM creation options from GondolinConfig
 */

import { RealFSProvider, ReadonlyProvider, MemoryProvider, createHttpHooks } from "@earendil-works/gondolin";
import path from "node:path";
import fs from "node:fs";
import {
  type GondolinConfig,
  resolveEnvironmentVars,
  prepareSecretsForGondolin,
  expandSkillPaths,
  getGuestImagePath,
} from "./config";
import { createSecretsHooks, createEnvironmentVfs } from "./secrets-hooks";

const WORKSPACE = "/root/workspace";

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
  secretsMounted: boolean;
  /** Only set when secretsFile is configured and exists. */
  secretsInfo?: {
    filePath: string;
    /** NAME → placeholder mapping from createSecretsHooks */
    placeholders: Record<string, string>;
  };
}

/**
 * Build VM creation options from configuration
 */
export async function buildVMOptions(ctx: VMCreationContext): Promise<BuildVMOptionsResult> {
  const warnings: string[] = [];
  const { config, vmName, localCwd, sessionId, overrides } = ctx;

  // Build session label
  const PI_PREFIX = "pi:";
  const sessionLabel = `${PI_PREFIX}${sessionId}:${vmName}`;

  // Build VFS mounts
  const mounts: Record<string, any> = {};

  // Handle CWD mounting
  const mountCwd = overrides?.mountCwd ?? config.workspace.mountCwd;
  if (mountCwd) {
    const cwdWritable = config.workspace.cwdWritable;
    if (cwdWritable) {
      mounts[WORKSPACE] = new RealFSProvider(localCwd);
    } else {
      mounts[WORKSPACE] = new ReadonlyProvider(new RealFSProvider(localCwd));
    }
  } else {
    // Empty workspace when mounting disabled
    mounts[WORKSPACE] = new MemoryProvider();
  }

  // Handle skills mounting
  const mountSkills = overrides?.mountSkills ?? config.skills.enabled;
  const skillPaths: string[] = [];

  if (mountSkills) {
    const skillsReadOnly = overrides?.skillsReadOnly ?? config.skills.readOnly;

    // Mount default skills
    if (config.skills.mountDefault) {
      const homeDir = process.env.HOME || "/root";
      const skillsBaseDir = path.join(homeDir, ".pi/agent/skills");

      // Verify directory exists
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

    // Mount custom skill paths
    if (config.skills.customPaths.length > 0) {
      const { expanded, warnings: expandWarnings } = expandSkillPaths(config.skills.customPaths);

      for (let i = 0; i < expanded.length; i++) {
        const skillPath = expanded[i];

        // Verify path exists
        if (!fs.existsSync(skillPath)) {
          warnings.push(`Custom skill path not found: ${skillPath}`);
          continue;
        }

        // Mount at a numbered path
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

  // Build environment variables
  let env: Record<string, string> = {};

  if (Object.keys(config.environment).length > 0) {
    const { env: resolvedEnv, warnings: envWarnings } = resolveEnvironmentVars(config.environment);
    env = resolvedEnv;
    envWarnings.forEach(w => warnings.push(w));
  }

  // Set default environment variables for VM
  // These are essential for tools like tmux to work correctly
  const guestHomeDir = config.sandbox.homeDir || "/root";
  const guestTmpDir = "/tmp";
  
  // Only set if not already configured by user
  if (!env.HOME) {
    env.HOME = guestHomeDir;
  }
  if (!env.TMPDIR) {
    env.TMPDIR = guestTmpDir;
  }
  if (!env.PI_TMUX_SOCKET_DIR) {
    env.PI_TMUX_SOCKET_DIR = `${guestTmpDir}/pi-tmux-sockets`;
  }

  // Prepare secrets
  let secrets: Record<string, { hosts: string[]; value: string }> = {};

  if (Object.keys(config.secrets).length > 0) {
    const { secrets: preparedSecrets, warnings: secretWarnings } = prepareSecretsForGondolin(
      config.secrets
    );
    secrets = preparedSecrets;
    secretWarnings.forEach(w => warnings.push(w));
  }

  // Build network hooks
  // If a secretsFile is configured, use createSecretsHooks for live resolution.
  // Otherwise fall back to the standard createHttpHooks with static values.
  let httpHooks: any;
  let secretsPlaceholders: Record<string, string> | undefined;
  let secretNames: Set<string> | undefined;

  if (config.secretsFile) {
    if (!fs.existsSync(config.secretsFile)) {
      warnings.push(`Secrets file not found: ${config.secretsFile} — secrets will not be mounted`);
      const result = createHttpHooks({
        allowedHosts: config.network.allowedHosts,
        blockInternalRanges: config.network.blockInternalRanges,
        secrets,
      });
      httpHooks = result.httpHooks;
      Object.assign(env, result.env);
    } else {
      const result = createSecretsHooks(config.secretsFile, {
        extraAllowedHosts: config.network.allowedHosts,
      });
      httpHooks = result.httpHooks;
      // result.env contains only NAME → placeholder entries
      secretsPlaceholders = { ...result.env };
      Object.assign(env, result.env);
      // Add per-secret VFS mounts alongside other mounts
      Object.assign(mounts, result.vfsMounts);
      // Track secret names so environment VFS can exclude them (secrets take precedence)
      secretNames = new Set(Object.keys(secretsPlaceholders));
    }
  } else {
    const result = createHttpHooks({
      allowedHosts: config.network.allowedHosts,
      blockInternalRanges: config.network.blockInternalRanges,
      secrets,
    });
    httpHooks = result.httpHooks;
    Object.assign(env, result.env);
  }

  // Mount environment variables VFS at /run/env (live updates, raw values)
  // Secrets take precedence: if a name is both a secret and an env var, the secret wins
  const envVfsMounts = createEnvironmentVfs(secretNames);
  Object.assign(mounts, envVfsMounts);
  const vmCreateOptions: any = {
    sessionLabel,
    httpHooks,
    env,
    vfs: { mounts },
  };

  // Add sandbox image if configured (config override or env var)
  const guestImagePath = await getGuestImagePath();
  if (guestImagePath) {
    vmCreateOptions.sandbox = { imagePath: guestImagePath };
  }

  // Track whether secrets VFS was actually mounted (file existed and was valid)
  const secretsMounted = Boolean(config.secretsFile && fs.existsSync(config.secretsFile));

  return {
    options: vmCreateOptions,
    warnings,
    skillPaths,
    customMounts,
    secretsMounted,
    secretsInfo: secretsMounted && secretsPlaceholders
      ? { filePath: config.secretsFile!, placeholders: secretsPlaceholders }
      : undefined,
  };
}

/**
 * Format warnings for user display
 */
export function formatVMCreationWarnings(warnings: string[]): string {
  if (warnings.length === 0) return "";

  return (
    "⚠️  Warnings:\n" +
    warnings.map(w => `  • ${w}`).join("\n")
  );
}
