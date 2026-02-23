/**
 * Gondolin Configuration Editor - Using SettingsList with Env/Secrets Management
 */

import { getSettingsListTheme } from "@mariozechner/pi-coding-agent";
import { Container, type SettingItem, SettingsList } from "@mariozechner/pi-tui";
import { getConfig, setConfig, type GondolinConfig } from "./config";

export async function showGondolinSettings(ctx: any): Promise<void> {
  const config = await getConfig();

  await ctx.ui.custom((_tui, theme, _kb, done) => {
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
        // Handle special cases (environment, secrets)
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

        // Handle boolean toggles
        const enabled = newValue === "enabled";

        switch (id) {
          case "cwd":
            config.workspace.mountCwd = enabled;
            break;
          case "cwd-writable":
            config.workspace.cwdWritable = enabled;
            break;
          case "skills-enabled":
            config.skills.enabled = enabled;
            break;
          case "skills-default":
            config.skills.mountDefault = enabled;
            break;
          case "skills-readonly":
            config.skills.readOnly = enabled;
            break;
          case "auto-attach":
            config.autoAttach = enabled;
            break;
          case "block-internal":
            config.network.blockInternalRanges = enabled;
            break;
        }

        // Save immediately
        await setConfig(config);
      },
      () => {
        done(undefined);
      }
    );

    container.addChild(settingsList);

    return {
      render(width: number) {
        return container.render(width);
      },
      invalidate() {
        container.invalidate();
      },
      handleInput(data: string) {
        settingsList.handleInput?.(data);
      },
    };
  });
}

async function manageEnvironmentVariables(ctx: any, config: GondolinConfig): Promise<void> {
  const vars = Object.entries(config.environment);

  await ctx.ui.custom((_tui, theme, _kb, done) => {
    const items: SettingItem[] = vars.map(([name, setting]) => ({
      id: name,
      label: name,
      currentValue: setting.type,
      values: [setting.type],
    }));

    items.push({
      id: "__add__",
      label: "+ Add Variable",
      currentValue: "add",
      values: ["add"],
    });

    items.push({
      id: "__back__",
      label: "← Back to Settings",
      currentValue: "back",
      values: ["back"],
    });

    const container = new Container();
    container.addChild(
      new (class {
        render(_width: number) {
          return [
            theme.fg("accent", "Environment Variables"),
            "",
            theme.fg("dim", "Select to edit/delete, or add new"),
            "",
          ];
        }
        invalidate() {}
      })()
    );

    const settingsList = new SettingsList(
      items,
      Math.min(items.length + 2, 20),
      getSettingsListTheme(),
      async (id) => {
        if (id === "__back__") {
          done(undefined);
          await showGondolinSettings(ctx);
          return;
        }

        if (id === "__add__") {
          done(undefined);
          const name = await ctx.ui.input("Variable name: ");
          if (!name) {
            await manageEnvironmentVariables(ctx, config);
            return;
          }
          const type = await ctx.ui.select("Type:", ["propagate", "static", "reference"], "propagate");
          let value: string | undefined = undefined;
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

        // Edit or delete existing variable
        const current = config.environment[id];
        const action = await ctx.ui.select(`${id}:`, ["Edit", "Delete"], "Edit");

        if (action === "Delete") {
          delete config.environment[id];
          await setConfig(config);
          await manageEnvironmentVariables(ctx, config);
        } else {
          const newValue = await ctx.ui.input(`Value (current: ${current.value || "none"}): `);
          if (newValue !== null && newValue !== undefined && newValue !== "") {
            config.environment[id].value = newValue;
            await setConfig(config);
          }
          await manageEnvironmentVariables(ctx, config);
        }
      },
      () => {
        done(undefined);
      }
    );

    container.addChild(settingsList);

    return {
      render(width: number) {
        return container.render(width);
      },
      invalidate() {
        container.invalidate();
      },
      handleInput(data: string) {
        settingsList.handleInput?.(data);
      },
    };
  });
}

async function manageSecrets(ctx: any, config: GondolinConfig): Promise<void> {
  const secretsList = Object.entries(config.secrets);

  await ctx.ui.custom((_tui, theme, _kb, done) => {
    const items: SettingItem[] = secretsList.map(([name, setting]) => ({
      id: name,
      label: name,
      currentValue: setting.type,
      values: [setting.type],
    }));

    items.push({
      id: "__add__",
      label: "+ Add Secret",
      currentValue: "add",
      values: ["add"],
    });

    items.push({
      id: "__back__",
      label: "← Back to Settings",
      currentValue: "back",
      values: ["back"],
    });

    const container = new Container();
    container.addChild(
      new (class {
        render(_width: number) {
          return [
            theme.fg("accent", "Secrets"),
            "",
            theme.fg("dim", "Select to edit/delete, or add new"),
            "",
          ];
        }
        invalidate() {}
      })()
    );

    const settingsList = new SettingsList(
      items,
      Math.min(items.length + 2, 20),
      getSettingsListTheme(),
      async (id) => {
        if (id === "__back__") {
          done(undefined);
          await showGondolinSettings(ctx);
          return;
        }

        if (id === "__add__") {
          done(undefined);
          const name = await ctx.ui.input("Secret name: ");
          if (!name) {
            await manageSecrets(ctx, config);
            return;
          }
          const type = await ctx.ui.select("Type:", ["propagate", "static", "reference"], "static");
          let value: string | undefined = undefined;
          if (type !== "propagate") {
            value = await ctx.ui.input("Value: ");
            if (!value) {
              ctx.ui.notify("Value required for static/reference types", "error");
              await manageSecrets(ctx, config);
              return;
            }
          }
          const hostsInput = await ctx.ui.input("Allowed hosts (comma-separated, default: *): ");
          const hosts = hostsInput ? hostsInput.split(",").map(h => h.trim()) : ["*"];

          config.secrets[name] = { type: type as any, value, hosts };
          await setConfig(config);
          await manageSecrets(ctx, config);
          return;
        }

        // Edit or delete existing secret
        const current = config.secrets[id];
        const action = await ctx.ui.select(`${id}:`, ["Edit", "Delete"], "Edit");

        if (action === "Delete") {
          delete config.secrets[id];
          await setConfig(config);
          await manageSecrets(ctx, config);
        } else {
          const newValue = await ctx.ui.input(`Value (current: ${current.value || "none"}): `);
          if (newValue !== null && newValue !== undefined && newValue !== "") {
            config.secrets[id].value = newValue;
            await setConfig(config);
          }
          const hostsInput = await ctx.ui.input(`Hosts (current: ${current.hosts.join(", ")}): `);
          if (hostsInput && hostsInput.trim()) {
            config.secrets[id].hosts = hostsInput.split(",").map(h => h.trim());
            await setConfig(config);
          }
          await manageSecrets(ctx, config);
        }
      },
      () => {
        done(undefined);
      }
    );

    container.addChild(settingsList);

    return {
      render(width: number) {
        return container.render(width);
      },
      invalidate() {
        container.invalidate();
      },
      handleInput(data: string) {
        settingsList.handleInput?.(data);
      },
    };
  });
}

async function manageCustomMounts(ctx: any, config: GondolinConfig): Promise<void> {
  const mountsList = Object.entries(config.customMounts);

  await ctx.ui.custom((_tui, theme, _kb, done) => {
    const items: SettingItem[] = mountsList.map(([guestPath, mount]) => ({
      id: guestPath,
      label: `${guestPath} → ${mount.hostPath}${mount.writable ? " (rw)" : " (ro)"}`,
      currentValue: "edit",
      values: ["edit"],
    }));

    items.push({
      id: "__add__",
      label: "+ Add Mount",
      currentValue: "add",
      values: ["add"],
    });

    items.push({
      id: "__back__",
      label: "← Back to Settings",
      currentValue: "back",
      values: ["back"],
    });

    const container = new Container();
    container.addChild(
      new (class {
        render(_width: number) {
          return [
            theme.fg("accent", "Custom Mounts"),
            "",
            theme.fg("dim", "Map host directories into the VM at custom paths"),
            "",
          ];
        }
        invalidate() {}
      })()
    );

    const settingsList = new SettingsList(
      items,
      Math.min(items.length + 2, 20),
      getSettingsListTheme(),
      async (id) => {
        if (id === "__back__") {
          done(undefined);
          await showGondolinSettings(ctx);
          return;
        }

        if (id === "__add__") {
          done(undefined);
          const guestPath = await ctx.ui.input("Guest path (e.g., /mnt/data): ");
          if (!guestPath) {
            await manageCustomMounts(ctx, config);
            return;
          }

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

        // Edit or delete existing mount
        const current = config.customMounts[id];
        const action = await ctx.ui.select(`${id}:`, ["Edit", "Delete"], "Edit");

        if (action === "Delete") {
          delete config.customMounts[id];
          await setConfig(config);
          await manageCustomMounts(ctx, config);
        } else {
          const newHostPath = await ctx.ui.input(`Host path (current: ${current.hostPath}): `);
          if (newHostPath && newHostPath.trim()) {
            current.hostPath = newHostPath;
          }

          const writable = await ctx.ui.select("Writable?", ["yes", "no"], current.writable ? "yes" : "no") === "yes";
          current.writable = writable;

          await setConfig(config);
          await manageCustomMounts(ctx, config);
        }
      },
      () => {
        done(undefined);
      }
    );

    container.addChild(settingsList);

    return {
      render(width: number) {
        return container.render(width);
      },
      invalidate() {
        container.invalidate();
      },
      handleInput(data: string) {
        settingsList.handleInput?.(data);
      },
    };
  });
}
