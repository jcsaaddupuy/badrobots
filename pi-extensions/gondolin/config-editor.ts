/**
 * Gondolin Configuration Editor - Using SettingsList
 */

import { getSettingsListTheme } from "@mariozechner/pi-coding-agent";
import { Container, type SettingItem, SettingsList, Text } from "@mariozechner/pi-tui";
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
      Math.min(items.length + 2, 15),
      getSettingsListTheme(),
      async (id, newValue) => {
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
