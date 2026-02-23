import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getConfig, setConfig, expandSkillPaths, GondolinConfig } from "./config";
import { showGondolinSettings } from "./config-editor";
import fs from "node:fs";
import path from "node:path";

/**
 * TUI Configuration Commands for Gondolin
 * Handles: /gondolin config cwd, /gondolin config skills, /gondolin config auto-attach
 */

export async function handleConfigCommand(
  args: string,
  ctx: any
): Promise<void> {
  const [subCmd, ...subArgs] = args.trim().split(/\s+/);

  switch (subCmd) {
    case "cwd":
      await handleCwdConfig(ctx);
      break;
    case "skills":
      await handleSkillsConfig(ctx);
      break;
    case "auto-attach":
      await handleAutoAttachConfig(ctx);
      break;
    case "environment":
      await handleEnvironmentConfig(subArgs.join(" "), ctx);
      break;
    case "secrets":
      await handleSecretsConfig(subArgs.join(" "), ctx);
      break;
    case "view":
      await handleViewConfig(ctx);
      break;
    case "edit":
      await handleEditConfig(ctx);
      break;
    case "reset":
      await handleResetConfig(ctx);
      break;
    default:
      ctx.ui.notify(
        `Usage: /gondolin config {cwd | skills | auto-attach | environment | secrets | edit | view | reset}`,
        "info"
      );
  }
}

/**
 * Handle: /gondolin config cwd
 * Toggle CWD mounting on/off
 */
async function handleCwdConfig(ctx: any): Promise<void> {
  try {
    const config = await getConfig();
    const current = config.workspace.mountCwd;

    ctx.ui.notify(
      `CWD Mounting Configuration\n\n` +
        `Current: ${current ? "[ON]" : "[OFF]"}\n\n` +
        `When ON (enabled):\n` +
        `  • Your current working directory is mounted to /root/workspace\n` +
        `  • Tools can read and modify files in the VM\n` +
        `  • This is the default behavior\n\n` +
        `When OFF (disabled):\n` +
        `  • VM gets an empty /root/workspace (MemoryProvider)\n` +
        `  • Complete filesystem isolation\n` +
        `  • You can still access files via skills or explicit mounts`,
      "info"
    );

    // Show toggle options
    const newValue = !current;
    const message =
      `Change to: [${newValue ? "ON" : "OFF"}]?\n\n` +
      `Type YES to confirm, or anything else to cancel.`;

    ctx.ui.notify(message, "question");
    
    // For now, we'll just show the option but require manual entry
    // In a full TUI implementation, this would be an interactive prompt
    ctx.ui.notify(
      `To toggle CWD mounting:\n\n` +
      `  /gondolin config cwd ${newValue ? "on" : "off"}`,
      "info"
    );
  } catch (error) {
    ctx.ui.notify(`Error loading config: ${error}`, "error");
  }
}

/**
 * Handle: /gondolin config cwd on|off
 * Set CWD mounting explicitly
 */
export async function setCwdMounting(
  value: boolean,
  ctx: any
): Promise<void> {
  try {
    const config = await getConfig();
    const oldValue = config.workspace.mountCwd;

    config.workspace.mountCwd = value;
    await setConfig(config);

    const action = value ? "enabled" : "disabled";
    ctx.ui.notify(
      `CWD mounting ${action}\n\n` +
        `Previous: ${oldValue ? "ON" : "OFF"}\n` +
        `Now: ${value ? "ON" : "OFF"}\n\n` +
        `This will apply to new VMs created with /gondolin start`,
      "success"
    );
  } catch (error) {
    ctx.ui.notify(`Error: ${error}`, "error");
  }
}

/**
 * Handle: /gondolin config skills
 * Interactive skills mounting configuration
 */
async function handleSkillsConfig(ctx: any): Promise<void> {
  try {
    const config = await getConfig();
    const skills = config.skills;

    let status = `Skills Mounting Configuration\n\n`;
    status += `Status:\n`;
    status += `  ${skills.enabled ? "[✓]" : "[ ]"} Enable skills mounting\n`;
    status += `  ${skills.mountDefault ? "[✓]" : "[ ]"} Mount default skills (~/.pi/agent/skills)\n`;
    status += `  ${skills.readOnly ? "[✓]" : "[ ]"} Read-only access (prevent modifications)\n`;
    status += `\nCustom skill paths: ${skills.customPaths.length || "none"}\n`;
    if (skills.customPaths.length > 0) {
      skills.customPaths.forEach((p, i) => {
        status += `  ${i + 1}. ${p}\n`;
      });
    }

    ctx.ui.notify(status, "info");

    // Show available actions
    const actions =
      `Available actions:\n` +
      `  /gondolin config skills enable          - Toggle skills mounting\n` +
      `  /gondolin config skills default         - Toggle default skills mount\n` +
      `  /gondolin config skills read-only       - Toggle read-only mode\n` +
      `  /gondolin config skills add <path>      - Add custom skill path\n` +
      `  /gondolin config skills remove <index>  - Remove custom skill path\n`;

    ctx.ui.notify(actions, "info");
  } catch (error) {
    ctx.ui.notify(`Error: ${error}`, "error");
  }
}

/**
 * Set individual skill options
 */
export async function setSkillsOption(
  option: "enable" | "default" | "read-only",
  value?: boolean,
  ctx?: any
): Promise<void> {
  try {
    const config = await getConfig();
    const skills = config.skills;

    const oldValue =
      option === "enable"
        ? skills.enabled
        : option === "default"
          ? skills.mountDefault
          : skills.readOnly;

    const newValue = value !== undefined ? value : !oldValue;

    if (option === "enable") {
      skills.enabled = newValue;
    } else if (option === "default") {
      skills.mountDefault = newValue;
    } else if (option === "read-only") {
      skills.readOnly = newValue;
    }

    await setConfig(config);

    if (ctx) {
      const optionName =
        option === "enable"
          ? "Skills mounting"
          : option === "default"
            ? "Default skills mount"
            : "Read-only mode";
      const action = newValue ? "enabled" : "disabled";
      ctx.ui.notify(
        `${optionName} ${action}\n\n` +
          `Previous: ${oldValue ? "ON" : "OFF"}\n` +
          `Now: ${newValue ? "ON" : "OFF"}\n\n` +
          `This will apply to new VMs created with /gondolin start`,
        "success"
      );
    }
  } catch (error) {
    if (ctx) {
      ctx.ui.notify(`Error: ${error}`, "error");
    } else {
      throw error;
    }
  }
}

/**
 * Add custom skill path
 */
export async function addSkillPath(
  skillPath: string,
  ctx: any
): Promise<void> {
  try {
    // Validate path exists
    if (!fs.existsSync(skillPath)) {
      ctx.ui.notify(
        `Path does not exist: ${skillPath}`,
        "error"
      );
      return;
    }

    // Expand path (handle ~ and env vars)
    const { expanded, warnings } = expandSkillPaths([skillPath]);

    if (warnings.length > 0) {
      warnings.forEach(w => ctx.ui.notify(`Warning: ${w}`, "warning"));
    }

    const resolvedPath = expanded[0];

    const config = await getConfig();
    if (config.skills.customPaths.includes(resolvedPath)) {
      ctx.ui.notify(
        `Path already configured: ${resolvedPath}`,
        "warning"
      );
      return;
    }

    config.skills.customPaths.push(resolvedPath);
    await setConfig(config);

    ctx.ui.notify(
      `Added skill path:\n  ${resolvedPath}\n\n` +
        `Total custom paths: ${config.skills.customPaths.length}\n` +
        `This will apply to new VMs created with /gondolin start`,
      "success"
    );
  } catch (error) {
    ctx.ui.notify(`Error: ${error}`, "error");
  }
}

/**
 * Remove custom skill path by index
 */
export async function removeSkillPath(
  index: number,
  ctx: any
): Promise<void> {
  try {
    const config = await getConfig();

    if (index < 0 || index >= config.skills.customPaths.length) {
      ctx.ui.notify(`Invalid path index: ${index}`, "error");
      return;
    }

    const removed = config.skills.customPaths.splice(index, 1)[0];
    await setConfig(config);

    ctx.ui.notify(
      `Removed skill path:\n  ${removed}\n\n` +
        `Total custom paths: ${config.skills.customPaths.length}`,
      "success"
    );
  } catch (error) {
    ctx.ui.notify(`Error: ${error}`, "error");
  }
}

/**
 * Handle: /gondolin config auto-attach
 * Toggle auto-attach on session start
 */
async function handleAutoAttachConfig(ctx: any): Promise<void> {
  try {
    const config = await getConfig();
    const current = config.autoAttach;

    ctx.ui.notify(
      `Auto-Attach Configuration\n\n` +
        `Current: ${current ? "[ON]" : "[OFF]"}\n\n` +
        `When ON:\n` +
        `  • Default VM is automatically created on session start\n` +
        `  • VM uses current CWD and skills configuration\n\n` +
        `When OFF:\n` +
        `  • Manual /gondolin start required`,
      "info"
    );
  } catch (error) {
    ctx.ui.notify(`Error loading config: ${error}`, "error");
  }
}

/**
 * Set auto-attach value
 */
export async function setAutoAttach(
  value: boolean,
  ctx: any
): Promise<void> {
  try {
    const config = await getConfig();
    const oldValue = config.autoAttach;

    config.autoAttach = value;
    await setConfig(config);

    const action = value ? "enabled" : "disabled";
    ctx.ui.notify(
      `Auto-attach ${action}\n\n` +
        `Previous: ${oldValue ? "ON" : "OFF"}\n` +
        `Now: ${value ? "ON" : "OFF"}`,
      "success"
    );
  } catch (error) {
    ctx.ui.notify(`Error: ${error}`, "error");
  }
}

/**
 * Handle: /gondolin config edit
 * Open interactive configuration editor
 */
async function handleEditConfig(ctx: any): Promise<void> {
  try {
    await showGondolinSettings(ctx);
  } catch (error) {
    ctx.ui.notify(`Error: ${error}`, "error");
  }
}

/**
 * Handle: /gondolin config view
 * Display current configuration
 */
async function handleViewConfig(ctx: any): Promise<void> {
  try {
    const config = await getConfig();

    let output = `Gondolin Configuration\n`;
    output += `${"=".repeat(50)}\n\n`;

    output += `Workspace:\n`;
    output += `  Mount CWD: ${config.workspace.mountCwd ? "ON" : "OFF"}\n`;
    output += `  Default VM: ${config.workspace.defaultVmName}\n\n`;

    output += `Skills:\n`;
    output += `  Enabled: ${config.skills.enabled ? "ON" : "OFF"}\n`;
    output += `  Mount default: ${config.skills.mountDefault ? "ON" : "OFF"}\n`;
    output += `  Read-only: ${config.skills.readOnly ? "ON" : "OFF"}\n`;
    output += `  Custom paths: ${config.skills.customPaths.length}\n`;
    if (config.skills.customPaths.length > 0) {
      config.skills.customPaths.forEach((p, i) => {
        output += `    ${i + 1}. ${p}\n`;
      });
    }
    output += `\n`;

    output += `Session:\n`;
    output += `  Auto-attach: ${config.autoAttach ? "ON" : "OFF"}\n\n`;

    output += `Network:\n`;
    output += `  Allowed hosts: ${config.network.allowedHosts.join(", ")}\n`;
    output += `  Block internal: ${config.network.blockInternalRanges ? "ON" : "OFF"}\n\n`;

    output += `Environment Variables: ${Object.keys(config.environment).length}\n`;
    Object.entries(config.environment).forEach(([key, val]: [string, any]) => {
      output += `  ${key}: ${val.type}${val.value ? ` (${val.value.substring(0, 30)}${val.value.length > 30 ? "..." : ""})` : ""}\n`;
    });
    output += `\n`;

    output += `Secrets: ${Object.keys(config.secrets).length}\n`;
    Object.entries(config.secrets).forEach(([key, val]: [string, any]) => {
      output += `  ${key}: ${val.type} → hosts: ${val.hosts.join(", ")}\n`;
    });

    ctx.ui.notify(output, "info");
  } catch (error) {
    ctx.ui.notify(`Error: ${error}`, "error");
  }
}

/**
 * Handle: /gondolin config environment {add|remove|list}
 */
async function handleEnvironmentConfig(args: string, ctx: any): Promise<void> {
  try {
    const config = await getConfig();
    const parts = args.trim().split(/\s+/);
    const action = parts[0];

    switch (action) {
      case "add": {
        const name = parts[1];
        if (!name) {
          ctx.ui.notify(
            `Usage: /gondolin config environment add NAME [value]\n` +
            `Type will be: propagate (or use: static | reference)`,
            "info"
          );
          return;
        }
        config.environment[name] = {
          type: "propagate",
          value: parts.slice(2).join(" ") || undefined,
        };
        await setConfig(config);
        ctx.ui.notify(`Added environment variable: ${name}`, "success");
        break;
      }

      case "remove": {
        const name = parts[1];
        if (!name) {
          ctx.ui.notify(`Usage: /gondolin config environment remove NAME`, "info");
          return;
        }
        if (config.environment[name]) {
          delete config.environment[name];
          await setConfig(config);
          ctx.ui.notify(`Removed environment variable: ${name}`, "success");
        } else {
          ctx.ui.notify(`Environment variable not found: ${name}`, "error");
        }
        break;
      }

      case "list": {
        if (Object.keys(config.environment).length === 0) {
          ctx.ui.notify("No environment variables configured.", "info");
          return;
        }
        let output = "Environment Variables:\n";
        Object.entries(config.environment).forEach(([key, val]) => {
          output += `\n${key}:\n`;
          output += `  Type: ${val.type}\n`;
          if (val.value) output += `  Value: ${val.value}\n`;
        });
        ctx.ui.notify(output, "info");
        break;
      }

      default:
        ctx.ui.notify(
          `Usage: /gondolin config environment {add NAME|remove NAME|list}`,
          "info"
        );
    }
  } catch (error) {
    ctx.ui.notify(`Error: ${error}`, "error");
  }
}

/**
 * Handle: /gondolin config secrets {add|remove|list}
 */
async function handleSecretsConfig(args: string, ctx: any): Promise<void> {
  try {
    const config = await getConfig();
    const parts = args.trim().split(/\s+/);
    const action = parts[0];

    switch (action) {
      case "add": {
        const name = parts[1];
        if (!name) {
          ctx.ui.notify(
            `Usage: /gondolin config secrets add NAME [value] [hosts]\n` +
            `Type will be: static (or use: propagate | reference)\n` +
            `Hosts default to: *`,
            "info"
          );
          return;
        }
        config.secrets[name] = {
          type: "static",
          value: parts[2] || undefined,
          hosts: parts.slice(3).length > 0 ? parts.slice(3) : ["*"],
        };
        await setConfig(config);
        ctx.ui.notify(`Added secret: ${name}`, "success");
        break;
      }

      case "remove": {
        const name = parts[1];
        if (!name) {
          ctx.ui.notify(`Usage: /gondolin config secrets remove NAME`, "info");
          return;
        }
        if (config.secrets[name]) {
          delete config.secrets[name];
          await setConfig(config);
          ctx.ui.notify(`Removed secret: ${name}`, "success");
        } else {
          ctx.ui.notify(`Secret not found: ${name}`, "error");
        }
        break;
      }

      case "list": {
        if (Object.keys(config.secrets).length === 0) {
          ctx.ui.notify("No secrets configured.", "info");
          return;
        }
        let output = "Secrets:\n";
        Object.entries(config.secrets).forEach(([key, val]) => {
          output += `\n${key}:\n`;
          output += `  Type: ${val.type}\n`;
          if (val.value) output += `  Value: ${val.value}\n`;
          output += `  Allowed hosts: ${val.hosts.join(", ")}\n`;
        });
        ctx.ui.notify(output, "info");
        break;
      }

      default:
        ctx.ui.notify(
          `Usage: /gondolin config secrets {add NAME|remove NAME|list}`,
          "info"
        );
    }
  } catch (error) {
    ctx.ui.notify(`Error: ${error}`, "error");
  }
}

/**
 * Handle: /gondolin config reset
 * Reset config to defaults
 */
async function handleResetConfig(ctx: any): Promise<void> {
  try {
    ctx.ui.notify(
      `To reset configuration to defaults, run:\n\n` +
        `  /gondolin config reset confirm\n\n` +
        `This will reload defaults from ~/.pi/agent/settings.json`,
      "warning"
    );
  } catch (error) {
    ctx.ui.notify(`Error: ${error}`, "error");
  }
}

/**
 * Actually reset the config (requires confirmation)
 */
export async function confirmResetConfig(ctx: any): Promise<void> {
  try {
    const homeDir = process.env.HOME || "/root";
    const settingsPath = path.join(homeDir, ".pi/agent/settings.json");

    if (fs.existsSync(settingsPath)) {
      // Read existing settings
      const content = fs.readFileSync(settingsPath, "utf-8");
      let settings = JSON.parse(content);

      // Remove gondolin config
      delete settings.gondolin;

      // Write back
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
    }

    ctx.ui.notify(
      `Configuration reset to defaults\n\n` +
        `Settings file: ${settingsPath}`,
      "success"
    );
  } catch (error) {
    ctx.ui.notify(`Error: ${error}`, "error");
  }
}
