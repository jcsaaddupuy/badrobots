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
  const { httpHooks, env: secretsEnv } = createHttpHooks({
    allowedHosts: config.network.allowedHosts,
    blockInternalRanges: config.network.blockInternalRanges,
    secrets,
  });

  // Merge secrets env into environment variables
  Object.assign(env, secretsEnv);

  // Construct final VM options
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

  return {
    options: vmCreateOptions,
    warnings,
    skillPaths,
    customMounts,
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
