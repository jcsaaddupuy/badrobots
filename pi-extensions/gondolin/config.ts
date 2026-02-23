import path from "node:path";
import fs from "node:fs";

/**
 * Gondolin Configuration Schema
 */
export interface GondolinConfig {
  workspace: {
    mountCwd: boolean;
    cwdWritable: boolean;
    defaultVmName: string;
  };
  skills: {
    enabled: boolean;
    mountDefault: boolean;
    customPaths: string[];
    readOnly: boolean;
  };
  autoAttach: boolean;
  customMounts: {
    [guestPath: string]: {
      hostPath: string;
      writable: boolean;
    };
  };
  network: {
    allowedHosts: string[];
    blockInternalRanges: boolean;
  };
  environment: {
    [varName: string]: {
      type: "propagate" | "static" | "reference";
      value?: string;
    };
  };
  secrets: {
    [secretName: string]: {
      type: "propagate" | "static" | "reference";
      value?: string;
      hosts: string[];
    };
  };
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: GondolinConfig = {
  workspace: {
    mountCwd: true,
    cwdWritable: false,
    defaultVmName: "default",
  },
  skills: {
    enabled: false,
    mountDefault: true,
    customPaths: [],
    readOnly: true,
  },
  autoAttach: false,
  customMounts: {},
  network: {
    allowedHosts: ["*"],
    blockInternalRanges: true,
  },
  environment: {},
  secrets: {},
};

/**
 * Get settings file path (~/.pi/agent/settings.json)
 */
function getSettingsFilePath(): string {
  const homeDir = process.env.HOME || "/root";
  return path.join(homeDir, ".pi/agent/settings.json");
}

/**
 * Deep merge objects, with explicit fields
 */
function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        sourceValue !== null &&
        typeof sourceValue === "object" &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === "object" &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(targetValue, sourceValue);
      } else if (sourceValue !== undefined) {
        result[key] = sourceValue;
      }
    }
  }
  return result;
}

/**
 * Validate environment variable configuration
 */
export function validateEnvironmentVars(
  env: GondolinConfig["environment"]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [varName, config] of Object.entries(env)) {
    // Validate variable name
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(varName)) {
      errors.push(
        `Invalid environment variable name: ${varName} (must be valid identifier)`
      );
    }

    // Validate type
    if (!["propagate", "static", "reference"].includes(config.type)) {
      errors.push(
        `Invalid type for ${varName}: ${config.type} (must be propagate, static, or reference)`
      );
    }

    // Validate value for static/reference
    if (config.type !== "propagate") {
      if (!config.value || typeof config.value !== "string") {
        errors.push(
          `${varName} type ${config.type} requires non-empty 'value' field`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate secrets configuration (strict - at config save time)
 */
export function validateSecretsStrict(
  secrets: GondolinConfig["secrets"]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [secretName, config] of Object.entries(secrets)) {
    // Validate secret name
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(secretName)) {
      errors.push(
        `Invalid secret name: ${secretName} (must be valid identifier)`
      );
    }

    // Validate type
    if (!["propagate", "static", "reference"].includes(config.type)) {
      errors.push(
        `Invalid type for ${secretName}: ${config.type} (must be propagate, static, or reference)`
      );
    }

    // Validate hosts array
    if (!Array.isArray(config.hosts) || config.hosts.length === 0) {
      errors.push(`${secretName} must have non-empty 'hosts' array`);
    } else {
      for (const host of config.hosts) {
        if (typeof host !== "string" || host.length === 0) {
          errors.push(`${secretName} has invalid host entry: ${host}`);
        }
      }
    }

    // Validate value for static/reference
    if (config.type !== "propagate") {
      if (!config.value || typeof config.value !== "string") {
        errors.push(
          `${secretName} type ${config.type} requires non-empty 'value' field`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate secrets at runtime (loose - at VM creation time)
 * Check if propagated secrets exist on host
 */
export function validateSecretsRuntime(
  secrets: GondolinConfig["secrets"]
): { warnings: string[] } {
  const warnings: string[] = [];

  for (const [secretName, config] of Object.entries(secrets)) {
    if (config.type === "propagate") {
      if (!process.env[secretName]) {
        warnings.push(
          `Secret ${secretName} is set to propagate but not found in host environment`
        );
      }
    }
  }

  return { warnings };
}

/**
 * Validate full configuration
 */
export function validateConfig(config: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config || typeof config !== "object") {
    return { valid: false, errors: ["Config must be an object"] };
  }

  const cfg = config as Record<string, unknown>;

  // Validate workspace
  if (!cfg.workspace || typeof cfg.workspace !== "object") {
    errors.push("workspace must be an object");
  } else {
    const ws = cfg.workspace as Record<string, unknown>;
    if (typeof ws.mountCwd !== "boolean") {
      errors.push("workspace.mountCwd must be boolean");
    }
    if (typeof ws.defaultVmName !== "string" || ws.defaultVmName.length === 0) {
      errors.push("workspace.defaultVmName must be non-empty string");
    }
  }

  // Validate skills
  if (!cfg.skills || typeof cfg.skills !== "object") {
    errors.push("skills must be an object");
  } else {
    const sk = cfg.skills as Record<string, unknown>;
    if (typeof sk.enabled !== "boolean") {
      errors.push("skills.enabled must be boolean");
    }
    if (typeof sk.mountDefault !== "boolean") {
      errors.push("skills.mountDefault must be boolean");
    }
    if (!Array.isArray(sk.customPaths)) {
      errors.push("skills.customPaths must be array");
    } else {
      for (const path of sk.customPaths) {
        if (typeof path !== "string") {
          errors.push("skills.customPaths must contain only strings");
        }
      }
    }
    if (typeof sk.readOnly !== "boolean") {
      errors.push("skills.readOnly must be boolean");
    }
  }

  // Validate autoAttach
  if (typeof cfg.autoAttach !== "boolean") {
    errors.push("autoAttach must be boolean");
  }

  // Validate network
  if (!cfg.network || typeof cfg.network !== "object") {
    errors.push("network must be an object");
  } else {
    const net = cfg.network as Record<string, unknown>;
    if (!Array.isArray(net.allowedHosts)) {
      errors.push("network.allowedHosts must be array");
    } else {
      for (const host of net.allowedHosts) {
        if (typeof host !== "string") {
          errors.push("network.allowedHosts must contain only strings");
        }
      }
    }
    if (typeof net.blockInternalRanges !== "boolean") {
      errors.push("network.blockInternalRanges must be boolean");
    }
  }

  // Validate environment variables
  if (cfg.environment && typeof cfg.environment === "object") {
    const envValidation = validateEnvironmentVars(cfg.environment as any);
    errors.push(...envValidation.errors);
  }

  // Validate secrets
  if (cfg.secrets && typeof cfg.secrets === "object") {
    const secretValidation = validateSecretsStrict(cfg.secrets as any);
    errors.push(...secretValidation.errors);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Load configuration from settings.json
 */
export async function getConfig(): Promise<GondolinConfig> {
  try {
    const filePath = getSettingsFilePath();

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return DEFAULT_CONFIG;
    }

    // Read and parse
    const content = fs.readFileSync(filePath, "utf-8");
    const settings = JSON.parse(content);

    // Extract gondolin config
    const gondolinConfig = settings.gondolin;

    if (!gondolinConfig) {
      return DEFAULT_CONFIG;
    }

    // Merge with defaults
    const merged = deepMerge(DEFAULT_CONFIG, gondolinConfig);

    // Validate
    const validation = validateConfig(merged);
    if (!validation.valid) {
      console.warn(
        "Gondolin configuration validation errors:",
        validation.errors
      );
      return DEFAULT_CONFIG;
    }

    return merged as GondolinConfig;
  } catch (error) {
    console.warn("Failed to load Gondolin config, using defaults:", error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Save configuration to settings.json
 */
export async function setConfig(config: GondolinConfig): Promise<void> {
  // Validate first (strict validation)
  const validation = validateConfig(config);
  if (!validation.valid) {
    throw new Error(
      `Invalid configuration: ${validation.errors.join(", ")}`
    );
  }

  try {
    const filePath = getSettingsFilePath();

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Read existing settings or create empty
    let settings: Record<string, unknown> = {};
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        settings = JSON.parse(content);
      } catch (error) {
        console.warn("Failed to parse existing settings.json, overwriting");
        settings = {};
      }
    }

    // Update gondolin key
    settings.gondolin = config;

    // Write back
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), "utf-8");
  } catch (error) {
    throw new Error(`Failed to save Gondolin config: ${error}`);
  }
}

/**
 * Resolve environment variables for VM creation
 * Returns resolved environment object with all variables expanded
 */
export function resolveEnvironmentVars(
  envConfig: GondolinConfig["environment"]
): { env: Record<string, string>; warnings: string[] } {
  const env: Record<string, string> = {};
  const warnings: string[] = [];

  for (const [varName, config] of Object.entries(envConfig)) {
    try {
      if (config.type === "propagate") {
        const value = process.env[varName];
        if (value === undefined) {
          warnings.push(`Environment variable ${varName} not found on host`);
        } else {
          env[varName] = value;
        }
      } else if (config.type === "static") {
        if (config.value) {
          env[varName] = config.value;
        }
      } else if (config.type === "reference") {
        if (config.value) {
          // Expand ${VAR} references
          let expanded = config.value;
          const refMatches = expanded.match(/\$\{[A-Za-z_][A-Za-z0-9_]*\}/g) || [];
          for (const match of refMatches) {
            const refVar = match.slice(2, -1); // Remove ${ and }
            const refValue = process.env[refVar];
            if (refValue === undefined) {
              warnings.push(
                `Reference variable ${refVar} in ${varName} not found on host`
              );
            } else {
              expanded = expanded.replace(match, refValue);
            }
          }
          env[varName] = expanded;
        }
      }
    } catch (error) {
      warnings.push(`Failed to resolve environment variable ${varName}: ${error}`);
    }
  }

  return { env, warnings };
}

/**
 * Prepare secrets for Gondolin createHttpHooks
 * Returns secrets object ready to pass to Gondolin API
 */
export function prepareSecretsForGondolin(
  secretsConfig: GondolinConfig["secrets"]
): {
  secrets: Record<string, { hosts: string[]; value: string }>;
  warnings: string[];
} {
  const secrets: Record<string, { hosts: string[]; value: string }> = {};
  const warnings: string[] = [];

  for (const [secretName, config] of Object.entries(secretsConfig)) {
    try {
      let value: string | undefined;

      if (config.type === "propagate") {
        value = process.env[secretName];
        if (!value) {
          warnings.push(
            `Secret ${secretName} is set to propagate but environment variable not found. ` +
            `Make sure ${secretName} is set in your shell before starting Pi.`
          );
          // Still try to add it - it might be set later or in a different way
          // For now, skip it to avoid errors
          continue;
        }
      } else if (config.type === "static") {
        value = config.value;
      } else if (config.type === "reference") {
        if (config.value) {
          // Expand ${VAR} references
          let expanded = config.value;
          const refMatches =
            expanded.match(/\$\{[A-Za-z_][A-Za-z0-9_]*\}/g) || [];
          for (const match of refMatches) {
            const refVar = match.slice(2, -1); // Remove ${ and }
            const refValue = process.env[refVar];
            if (!refValue) {
              warnings.push(
                `Reference variable ${refVar} in secret ${secretName} not found on host`
              );
              continue;
            }
            expanded = expanded.replace(match, refValue);
          }
          value = expanded;
        }
      }

      if (value) {
        secrets[secretName] = {
          hosts: config.hosts,
          value,
        };
      }
    } catch (error) {
      warnings.push(
        `Failed to prepare secret ${secretName} for Gondolin: ${error}`
      );
    }
  }

  return { secrets, warnings };
}

/**
 * Expand skill paths with environment variables
 * Converts ${VAR} and relative paths to absolute paths
 */
export function expandSkillPaths(paths: string[]): {
  expanded: string[];
  warnings: string[];
} {
  const expanded: string[] = [];
  const warnings: string[] = [];
  const homeDir = process.env.HOME || "/root";

  for (const p of paths) {
    try {
      let resolved = p;

      // Expand environment variables
      const refMatches = resolved.match(/\$\{[A-Za-z_][A-Za-z0-9_]*\}/g) || [];
      for (const match of refMatches) {
        const refVar = match.slice(2, -1); // Remove ${ and }
        const refValue = process.env[refVar];
        if (!refValue) {
          warnings.push(
            `Skill path ${p}: Reference variable ${refVar} not found`
          );
        } else {
          resolved = resolved.replace(match, refValue);
        }
      }

      // Handle ~ expansion
      if (resolved.startsWith("~/")) {
        resolved = path.join(homeDir, resolved.slice(2));
      } else if (resolved === "~") {
        resolved = homeDir;
      }

      // Convert relative to absolute
      if (!path.isAbsolute(resolved)) {
        resolved = path.resolve(resolved);
      }

      expanded.push(resolved);
    } catch (error) {
      warnings.push(`Failed to expand skill path ${p}: ${error}`);
    }
  }

  return { expanded, warnings };
}
