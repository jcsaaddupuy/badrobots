/**
 * Gondolin Configuration Editor
 */

import { getSettingsListTheme } from "@mariozechner/pi-coding-agent";
import type { TUI, Component } from "@mariozechner/pi-tui";
import { Container, type SettingItem, SettingsList } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { getConfig, setConfig, type GondolinConfig } from "./config";
import { listAvailableVFSProviders } from "./vfs";

export async function showGondolinSettings(ctx: any): Promise<void> {
  const config = await getConfig();

  await ctx.ui.custom((_tui: TUI, theme: Theme, _kb: unknown, done: (result: unknown) => void) => {
    const items: SettingItem[] = [
      {
        id: "cwd",
        label: "Mount Current Directory",
        currentValue: config.workspace.mountCwd ? "enabled" : "disabled",
        values: ["enabled", "disabled"],
      },
      {
        id: "cwd-writable",
        label: "CWD Writeable",
        currentValue: config.workspace.cwdWritable ? "enabled" : "disabled",
        values: ["enabled", "disabled"],
      },
      {
        id: "skills-enabled",
        label: "Enable Skills",
        currentValue: config.skills.enabled ? "enabled" : "disabled",
        values: ["enabled", "disabled"],
      },
      {
        id: "skills-default",
        label: "Mount Default Skills",
        currentValue: config.skills.mountDefault ? "enabled" : "disabled",
        values: ["enabled", "disabled"],
      },
      {
        id: "skills-readonly",
        label: "Skills Read-Only",
        currentValue: config.skills.readOnly ? "enabled" : "disabled",
        values: ["enabled", "disabled"],
      },
      {
        id: "sandbox-theme",
        label: "Sandbox Theme",
        currentValue: config.sandboxTheme ?? "(none)",
        values: ["(none)", ...ctx.ui.getAllThemes().map((t: { name: string }) => t.name)],
      },
      {
        id: "auto-attach",
        label: "Auto-Attach on Session Start",
        currentValue: config.autoAttach ? "enabled" : "disabled",
        values: ["enabled", "disabled"],
      },
      {
        id: "block-internal",
        label: "Block Internal Network Ranges",
        currentValue: config.network.blockInternalRanges ? "enabled" : "disabled",
        values: ["enabled", "disabled"],
      },
      {
        id: "environment",
        label: `Environment Variables (${Object.keys(config.environment).length})`,
        currentValue: "manage",
        values: ["manage"],
      },
      {
        id: "secrets",
        label: `Secrets (${Object.keys(config.secrets).length})`,
        currentValue: "manage",
        values: ["manage"],
      },
      {
        id: "custom-mounts",
        label: `Custom Mounts (${Object.keys(config.customMounts).length})`,
        currentValue: "manage",
        values: ["manage"],
      },
      {
        id: "vfs",
        label: `VFS Providers`,
        currentValue: "manage",
        values: ["manage"],
      },
    ];

    const container = new Container();
    container.addChild(
      new (class {
        render(_width: number) {
          return [theme.fg("accent", "Gondolin Configuration"), ""];
        }
        invalidate() {}
      })()
    );

    const settingsList = new SettingsList(
      items,
      Math.min(items.length + 2, 20),
      getSettingsListTheme(),
      async (id, newValue) => {
        if (id === "environment") {
          done(undefined);
          await manageEnvironmentVariables(ctx, config);
          return;
        }

        if (id === "secrets") {
          done(undefined);
          await manageSecrets(ctx, config);
          return;
        }

        if (id === "custom-mounts") {
          done(undefined);
          await manageCustomMounts(ctx, config);
          return;
        }

        if (id === "vfs") {
          done(undefined);
          await manageVFSProviders(ctx, config);
          return;
        }

        // Boolean toggles
        const enabled = newValue === "enabled";
        switch (id) {
          case "cwd":            config.workspace.mountCwd = enabled; break;
          case "cwd-writable":   config.workspace.cwdWritable = enabled; break;
          case "skills-enabled": config.skills.enabled = enabled; break;
          case "skills-default": config.skills.mountDefault = enabled; break;
          case "skills-readonly":config.skills.readOnly = enabled; break;
          case "sandbox-theme":
            config.sandboxTheme = newValue === "(none)" ? undefined : newValue;
            break;
          case "auto-attach":    config.autoAttach = enabled; break;
          case "block-internal": config.network.blockInternalRanges = enabled; break;
        }

        await setConfig(config);
      },
      () => { done(undefined); }
    );

    container.addChild(settingsList);

    return {
      render(width: number) { return container.render(width); },
      invalidate() { container.invalidate(); },
      handleInput(data: string) { settingsList.handleInput?.(data); },
    };
  });
}

async function manageEnvironmentVariables(ctx: any, config: GondolinConfig): Promise<void> {
  const vars = Object.entries(config.environment);

  await ctx.ui.custom((_tui: TUI, theme: Theme, _kb: unknown, done: (result: unknown) => void) => {
    const items: SettingItem[] = vars.map(([name, setting]) => ({
      id: name,
      label: name,
      currentValue: setting.type,
      values: [setting.type],
    }));

    items.push({ id: "__add__", label: "+ Add Variable", currentValue: "add", values: ["add"] });
    items.push({ id: "__back__", label: "← Back to Settings", currentValue: "back", values: ["back"] });

    const container = new Container();
    container.addChild(new (class {
      render(_width: number) {
        return [
          theme.fg("accent", "Environment Variables"),
          "",
          theme.fg("dim", "Available in guest exec env — guest sees real value"),
          "",
        ];
      }
      invalidate() {}
    })());

    const settingsList = new SettingsList(
      items,
      Math.min(items.length + 2, 20),
      getSettingsListTheme(),
      async (id) => {
        if (id === "__back__") { done(undefined); await showGondolinSettings(ctx); return; }

        if (id === "__add__") {
          done(undefined);
          const name = await ctx.ui.input("Variable name: ");
          if (!name) { await manageEnvironmentVariables(ctx, config); return; }
          const type = await ctx.ui.select("Type:", ["propagate", "static", "reference"], "propagate");
          let value: string | undefined;
          if (type !== "propagate") {
            value = await ctx.ui.input("Value: ");
            if (!value) {
              ctx.ui.notify("Value required for static/reference types", "error");
              await manageEnvironmentVariables(ctx, config);
              return;
            }
          }
          config.environment[name] = { type: type as any, value };
          await setConfig(config);
          await manageEnvironmentVariables(ctx, config);
          return;
        }

        const current = config.environment[id];
        const action = await ctx.ui.select(`${id}:`, ["Edit", "Delete"], "Edit");
        if (action === "Delete") {
          delete config.environment[id];
          await setConfig(config);
        } else {
          const newValue = await ctx.ui.input(`Value (current: ${current.value || "none"}): `);
          if (newValue !== null && newValue !== undefined && newValue !== "") {
            config.environment[id].value = newValue;
            await setConfig(config);
          }
        }
        await manageEnvironmentVariables(ctx, config);
      },
      () => { done(undefined); }
    );

    container.addChild(settingsList);
    return {
      render(width: number) { return container.render(width); },
      invalidate() { container.invalidate(); },
      handleInput(data: string) { settingsList.handleInput?.(data); },
    };
  });
}

async function manageSecrets(ctx: any, config: GondolinConfig): Promise<void> {
  const secretsList = Object.entries(config.secrets);

  await ctx.ui.custom((_tui: TUI, theme: Theme, _kb: unknown, done: (result: unknown) => void) => {
    const items: SettingItem[] = secretsList.map(([name, setting]) => ({
      id: name,
      label: `${name}  ${theme.fg("dim", `→ ${setting.hosts.join(",")}`)}`,
      currentValue: setting.type,
      values: [setting.type],
    }));

    items.push({ id: "__add__", label: "+ Add Secret", currentValue: "add", values: ["add"] });
    items.push({ id: "__back__", label: "← Back to Settings", currentValue: "back", values: ["back"] });

    const container = new Container();
    container.addChild(new (class {
      render(_width: number) {
        return [
          theme.fg("accent", "Secrets"),
          "",
          theme.fg("dim", "Format: NAME or NAME@host1,host2"),
          theme.fg("dim", "Injected in HTTP headers only — guest sees placeholder token"),
          "",
        ];
      }
      invalidate() {}
    })());

    const settingsList = new SettingsList(
      items,
      Math.min(items.length + 2, 20),
      getSettingsListTheme(),
      async (id) => {
        if (id === "__back__") { done(undefined); await showGondolinSettings(ctx); return; }

        if (id === "__add__") {
          done(undefined);
          const nameInput = await ctx.ui.input("Secret name (format: NAME or NAME@host1,host2): ");
          if (!nameInput) { await manageSecrets(ctx, config); return; }

          // Parse NAME@host1,host2 format
          let name = nameInput;
          let hosts: string[] = ["*"];
          const atIdx = nameInput.indexOf("@");
          if (atIdx > 0) {
            name = nameInput.slice(0, atIdx).trim();
            const hostsStr = nameInput.slice(atIdx + 1).trim();
            if (hostsStr) {
              hosts = hostsStr.split(",").map((h: string) => h.trim()).filter(Boolean);
              if (hosts.length === 0) hosts = ["*"];
            }
          }

          if (!name || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
            ctx.ui.notify("Invalid secret name (must be valid identifier)", "error");
            await manageSecrets(ctx, config);
            return;
          }

          const type = await ctx.ui.select("Type:", ["propagate", "static", "reference"], "static");
          let value: string | undefined;
          if (type !== "propagate") {
            value = await ctx.ui.input("Value: ");
            if (!value) {
              ctx.ui.notify("Value required for static/reference types", "error");
              await manageSecrets(ctx, config);
              return;
            }
          }

          config.secrets[name] = { type: type as any, value, hosts };
          await setConfig(config);
          await manageSecrets(ctx, config);
          return;
        }

        const current = config.secrets[id];
        const action = await ctx.ui.select(`${id}:`, ["Edit Value", "Edit Hosts", "Delete"], "Edit Value");
        if (action === "Delete") {
          delete config.secrets[id];
          await setConfig(config);
        } else if (action === "Edit Value") {
          const newValue = await ctx.ui.input(`Value (current: ${current.value || "none"}): `);
          if (newValue !== null && newValue !== undefined && newValue !== "") {
            config.secrets[id].value = newValue;
            await setConfig(config);
          }
        } else if (action === "Edit Hosts") {
          const hostsInput = await ctx.ui.input(`Hosts (current: ${current.hosts.join(", ")}, format: host1,host2): `);
          if (hostsInput?.trim()) {
            const newHosts = hostsInput.split(",").map((h: string) => h.trim()).filter(Boolean);
            if (newHosts.length > 0) {
              config.secrets[id].hosts = newHosts;
              await setConfig(config);
            }
          }
        }
        await manageSecrets(ctx, config);
      },
      () => { done(undefined); }
    );

    container.addChild(settingsList);
    return {
      render(width: number) { return container.render(width); },
      invalidate() { container.invalidate(); },
      handleInput(data: string) { settingsList.handleInput?.(data); },
    };
  });
}

async function manageCustomMounts(ctx: any, config: GondolinConfig): Promise<void> {
  const mountsList = Object.entries(config.customMounts);

  await ctx.ui.custom((_tui: TUI, theme: Theme, _kb: unknown, done: (result: unknown) => void) => {
    const items: SettingItem[] = mountsList.map(([guestPath, mount]) => ({
      id: guestPath,
      label: `${guestPath} → ${mount.hostPath}${mount.writable ? " (rw)" : " (ro)"}`,
      currentValue: "edit",
      values: ["edit"],
    }));

    items.push({ id: "__add__", label: "+ Add Mount", currentValue: "add", values: ["add"] });
    items.push({ id: "__back__", label: "← Back to Settings", currentValue: "back", values: ["back"] });

    const container = new Container();
    container.addChild(new (class {
      render(_width: number) {
        return [
          theme.fg("accent", "Custom Mounts"),
          "",
          theme.fg("dim", "Map host directories into the VM at custom paths"),
          "",
        ];
      }
      invalidate() {}
    })());

    const settingsList = new SettingsList(
      items,
      Math.min(items.length + 2, 20),
      getSettingsListTheme(),
      async (id) => {
        if (id === "__back__") { done(undefined); await showGondolinSettings(ctx); return; }

        if (id === "__add__") {
          done(undefined);
          const guestPath = await ctx.ui.input("Guest path (e.g., /mnt/data): ");
          if (!guestPath) { await manageCustomMounts(ctx, config); return; }
          const hostPath = await ctx.ui.input("Host path (absolute path): ");
          if (!hostPath) {
            ctx.ui.notify("Host path is required", "error");
            await manageCustomMounts(ctx, config);
            return;
          }
          const writable = await ctx.ui.select("Writable?", ["yes", "no"], "no") === "yes";
          config.customMounts[guestPath] = { hostPath, writable };
          await setConfig(config);
          await manageCustomMounts(ctx, config);
          return;
        }

        const current = config.customMounts[id];
        const action = await ctx.ui.select(`${id}:`, ["Edit", "Delete"], "Edit");
        if (action === "Delete") {
          delete config.customMounts[id];
          await setConfig(config);
        } else {
          const newHostPath = await ctx.ui.input(`Host path (current: ${current.hostPath}): `);
          if (newHostPath?.trim()) current.hostPath = newHostPath.trim();
          const writable = await ctx.ui.select("Writable?", ["yes", "no"], current.writable ? "yes" : "no") === "yes";
          current.writable = writable;
          await setConfig(config);
        }
        await manageCustomMounts(ctx, config);
      },
      () => { done(undefined); }
    );

    container.addChild(settingsList);
    return {
      render(width: number) { return container.render(width); },
      invalidate() { container.invalidate(); },
      handleInput(data: string) { settingsList.handleInput?.(data); },
    };
  });
}

async function manageVFSProviders(ctx: any, config: GondolinConfig): Promise<void> {
  const providers = listAvailableVFSProviders(config);

  await ctx.ui.custom((_tui: TUI, theme: Theme, _kb: unknown, done: (result: unknown) => void) => {
    const items: SettingItem[] = [];

    if (providers.length === 0) {
      items.push({
        id: "__none__",
        label: "(no gondolin-vfs-* packages found in node_modules)",
        currentValue: "",
      });
    } else {
      for (const p of providers) {
        const statusLabel = p.enabled ? theme.fg("success", "enabled") : theme.fg("dim", "disabled");
        const hasSchema = (p.manifest.configSchema?.length ?? 0) > 0;
        items.push({
          id: p.packageName,
          label: p.manifest.displayName,
          description: p.manifest.description,
          currentValue: statusLabel + (hasSchema ? "  →" : ""),
          submenu: (_cv, submenuDone) =>
            buildProviderSubmenu(theme, ctx, config, p, submenuDone, done),
        });
      }
    }

    items.push({ id: "__back__", label: "← Back to Settings", currentValue: "", values: ["back"] });

    const container = new Container();
    container.addChild(new (class {
      render(_width: number) {
        return [theme.fg("accent", "VFS Providers"), "", theme.fg("dim", "Enter to configure"), ""];
      }
      invalidate() {}
    })());

    const settingsList = new SettingsList(
      items,
      Math.min(items.length + 4, 20),
      getSettingsListTheme(),
      async (id) => {
        if (id === "__back__" || id === "__none__") {
          done(undefined);
          await showGondolinSettings(ctx);
        }
      },
      () => { done(undefined); }
    );

    container.addChild(settingsList);
    return {
      render(width: number) { return container.render(width); },
      invalidate() { container.invalidate(); },
      handleInput(data: string) { settingsList.handleInput?.(data); },
    };
  });
}

/** Build a nested SettingsList Component for one provider's config fields. */
function buildProviderSubmenu(
  theme: Theme,
  ctx: any,
  config: GondolinConfig,
  provider: ReturnType<typeof listAvailableVFSProviders>[number],
  done: (selectedValue?: string) => void,
  outerDone: (result: unknown) => void
): Component {
  if (!config.vfs) config.vfs = {};
  const entry: Record<string, unknown> = { ...(config.vfs[provider.packageName] ?? {}) };

  const save = async () => {
    config.vfs[provider.packageName] = entry as any;
    await setConfig(config);
  };

  /** For string fields: close the whole custom UI, prompt, reopen. */
  const editString = (prompt: string, current: string, key: string | null) => {
    outerDone(undefined);
    Promise.resolve().then(async () => {
      const input = await ctx.ui.input(`${prompt} (current: ${current || "not set"}): `);
      if (input !== null && input !== undefined) {
        if (key === "__mountPoint__") {
          entry.mountPoint = input.trim() || provider.manifest.defaultMountPoint;
        } else if (key) {
          (entry as any)[key] = input.trim() || undefined;
        }
        await save();
      }
      await manageVFSProviders(ctx, config);
    });
  };

  const defaultMount = provider.manifest.defaultMountPoint;

  const items: SettingItem[] = [];

  items.push({
    id: "__enabled__",
    label: "Enabled",
    description: "Enable or disable this VFS provider",
    currentValue: (entry.enabled ?? true) ? "enabled" : "disabled",
    values: ["enabled", "disabled"],
  });

  items.push({
    id: "__mountPoint__",
    label: "Mount Point",
    description: `Guest path where this VFS is mounted (default: ${defaultMount})`,
    currentValue: (entry.mountPoint as string | undefined) ?? defaultMount,
    values: ["edit →"],
  });

  // Schema-driven fields — zero code changes needed when adding a new provider
  for (const field of provider.manifest.configSchema ?? []) {
    const rawVal = (entry as any)[field.key];
    const displayVal = rawVal !== undefined ? String(rawVal) : "";

    if (field.type === "boolean") {
      items.push({
        id: field.key,
        label: field.label,
        description: field.description,
        currentValue: rawVal !== undefined
          ? (rawVal ? "enabled" : "disabled")
          : (field.default === "true" ? "enabled" : "disabled"),
        values: ["enabled", "disabled"],
      });
    } else if (field.type === "select" && field.options) {
      items.push({
        id: field.key,
        label: field.label,
        description: field.description,
        currentValue: displayVal || field.default || field.options[0],
        values: field.options,
      });
    } else {
      // string — show current value, "edit →" triggers editString
      items.push({
        id: field.key,
        label: field.label,
        description: field.description,
        currentValue: displayVal
          ? displayVal
          : theme.fg("dim", field.default ? `default: ${field.default}` : "(not set)"),
        values: ["edit →"],
      });
    }
  }

  const header = new (class {
    render(_width: number) {
      const lines: string[] = [theme.fg("accent", provider.manifest.displayName)];
      if (provider.manifest.description) lines.push(theme.fg("dim", provider.manifest.description));
      lines.push("");
      return lines;
    }
    invalidate() {}
  })();

  const settingsList = new SettingsList(
    items,
    Math.min(items.length + 3, 14),
    getSettingsListTheme(),
    async (id, newValue) => {
      if (id === "__enabled__") {
        entry.enabled = newValue === "enabled";
        await save();
        return;
      }

      if (id === "__mountPoint__") {
        editString("Mount Point", (entry.mountPoint as string | undefined) ?? defaultMount, "__mountPoint__");
        return;
      }

      const field = (provider.manifest.configSchema ?? []).find(f => f.key === id);
      if (!field) return;

      if (field.type === "boolean") {
        (entry as any)[field.key] = newValue === "enabled";
        await save();
        return;
      }

      if (field.type === "select") {
        (entry as any)[field.key] = newValue;
        await save();
        return;
      }

      // string field
      const hint = field.description ? `${field.label}\n  ${field.description}` : field.label;
      editString(hint, (entry as any)[field.key] ?? field.default ?? "", field.key);
    },
    () => done(undefined)
  );

  const container = new Container();
  container.addChild(header);
  container.addChild(settingsList);
  return {
    render(width: number) { return container.render(width); },
    invalidate() { container.invalidate(); },
    handleInput(data: string) { settingsList.handleInput?.(data); },
  };
}
