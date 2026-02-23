/**
 * Gondolin Configuration Editor - Interactive TUI
 */

import {
  type Component,
  matchesKey,
  Key,
  truncateToWidth,
} from "@mariozechner/pi-tui";
import { getConfig, setConfig, type GondolinConfig, validateConfig } from "./config";

// Menu states
type MenuState = "main" | "workspace" | "skills" | "autoAttach" | "environment" | "secrets" | "network";

/**
 * Main interactive config editor component
 */
export class ConfigEditor implements Component {
  private menuState: MenuState = "main";
  private tui: any;
  private theme: any;
  private done: (result: any) => void;
  private config: GondolinConfig;
  private currentComponent: Component | null = null;
  private cachedWidth?: number;
  private cachedLines?: string[];

  constructor(
    tui: any,
    theme: any,
    done: (result: any) => void,
    config: GondolinConfig
  ) {
    this.tui = tui;
    this.theme = theme;
    this.done = done;
    this.config = { ...config };
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape)) {
      this.done(null);
      return;
    }

    switch (this.menuState) {
      case "main":
        this.handleMainMenu(data);
        break;
      case "workspace":
        this.handleWorkspaceMenu(data);
        break;
      case "skills":
        this.handleSkillsMenu(data);
        break;
      case "autoAttach":
        this.handleAutoAttachMenu(data);
        break;
      case "environment":
        this.handleEnvironmentMenu(data);
        break;
      case "network":
        this.handleNetworkMenu(data);
        break;
    }

    this.invalidate();
    this.tui.requestRender();
  }

  private handleMainMenu(data: string): void {
    if (matchesKey(data, "1")) {
      this.menuState = "workspace";
    } else if (matchesKey(data, "2")) {
      this.menuState = "skills";
    } else if (matchesKey(data, "3")) {
      this.menuState = "autoAttach";
    } else if (matchesKey(data, "4")) {
      this.menuState = "environment";
    } else if (matchesKey(data, "5")) {
      this.menuState = "network";
    } else if (matchesKey(data, "s") || matchesKey(data, "S")) {
      // Save and close
      this.saveAndClose();
    } else if (matchesKey(data, "r") || matchesKey(data, "R")) {
      // Reset to defaults
      this.config = this.getDefaultConfig();
    } else if (matchesKey(data, Key.backspace)) {
      this.menuState = "main";
    }
  }

  private handleWorkspaceMenu(data: string): void {
    if (matchesKey(data, "1")) {
      this.config.workspace.mountCwd = true;
    } else if (matchesKey(data, "2")) {
      this.config.workspace.mountCwd = false;
    } else if (matchesKey(data, Key.backspace)) {
      this.menuState = "main";
    }
  }

  private handleSkillsMenu(data: string): void {
    if (matchesKey(data, "1")) {
      this.config.skills.enabled = true;
    } else if (matchesKey(data, "2")) {
      this.config.skills.enabled = false;
    } else if (matchesKey(data, "3")) {
      this.config.skills.mountDefault = !this.config.skills.mountDefault;
    } else if (matchesKey(data, "4")) {
      this.config.skills.readOnly = !this.config.skills.readOnly;
    } else if (matchesKey(data, Key.backspace)) {
      this.menuState = "main";
    }
  }

  private handleAutoAttachMenu(data: string): void {
    if (matchesKey(data, "1")) {
      this.config.autoAttach = true;
    } else if (matchesKey(data, "2")) {
      this.config.autoAttach = false;
    } else if (matchesKey(data, Key.backspace)) {
      this.menuState = "main";
    }
  }

  private handleEnvironmentMenu(data: string): void {
    // Future: allow adding/removing environment variables
    if (matchesKey(data, Key.backspace)) {
      this.menuState = "main";
    }
  }

  private handleNetworkMenu(data: string): void {
    if (matchesKey(data, "1")) {
      this.config.network.blockInternalRanges = true;
    } else if (matchesKey(data, "2")) {
      this.config.network.blockInternalRanges = false;
    } else if (matchesKey(data, Key.backspace)) {
      this.menuState = "main";
    }
  }

  private getDefaultConfig(): GondolinConfig {
    return {
      workspace: { mountCwd: true, defaultVmName: "default" },
      skills: { enabled: true, mountDefault: true, customPaths: [], readOnly: true },
      autoAttach: false,
      network: { allowedHosts: [], blockInternalRanges: false },
      environment: {},
      secrets: {},
    };
  }

  private saveAndClose(): void {
    // Validate config
    const validation = validateConfig(this.config);
    if (validation.valid) {
      // Pass config to handler for async save
      this.done({ saved: true, config: this.config });
    } else {
      // Show validation error
      this.done({ saved: false, errors: validation.errors });
    }
  }

  render(width: number): string[] {
    if (this.cachedWidth === width && this.cachedLines) {
      return this.cachedLines;
    }

    const lines: string[] = [];

    // Header
    lines.push(this.theme.fg("accent", "⚙️  Gondolin Configuration"));
    lines.push("");

    if (this.menuState === "main") {
      lines.push(...this.renderMainMenu(width));
    } else if (this.menuState === "workspace") {
      lines.push(...this.renderWorkspaceMenu(width));
    } else if (this.menuState === "skills") {
      lines.push(...this.renderSkillsMenu(width));
    } else if (this.menuState === "autoAttach") {
      lines.push(...this.renderAutoAttachMenu(width));
    } else if (this.menuState === "environment") {
      lines.push(...this.renderEnvironmentMenu(width));
    } else if (this.menuState === "network") {
      lines.push(...this.renderNetworkMenu(width));
    }

    // Footer
    lines.push("");
    lines.push(
      truncateToWidth(
        this.theme.fg("dim", "↑↓ navigate • enter select • s save • r reset • esc cancel • backspace back"),
        width
      )
    );

    this.cachedWidth = width;
    this.cachedLines = lines;

    return lines;
  }

  private renderMainMenu(width: number): string[] {
    const lines: string[] = [];

    lines.push(this.theme.fg("muted", "Main Menu"));
    lines.push("");

    const items = [
      `${this.theme.fg("accent", "1")} Workspace (CWD Mount): ${this.config.workspace.mountCwd ? this.theme.fg("success", "ON") : this.theme.fg("error", "OFF")}`,
      `${this.theme.fg("accent", "2")} Skills: ${this.config.skills.enabled ? this.theme.fg("success", "ENABLED") : this.theme.fg("error", "DISABLED")}`,
      `${this.theme.fg("accent", "3")} Auto-Attach: ${this.config.autoAttach ? this.theme.fg("success", "ON") : this.theme.fg("error", "OFF")}`,
      `${this.theme.fg("accent", "4")} Environment Variables (${Object.keys(this.config.environment).length})`,
      `${this.theme.fg("accent", "5")} Network Policies`,
      "",
      `${this.theme.fg("accent", "S")} Save and Close`,
      `${this.theme.fg("accent", "R")} Reset to Defaults`,
      `${this.theme.fg("accent", "ESC")} Cancel`,
    ];

    for (const item of items) {
      lines.push(truncateToWidth(item, width));
    }

    return lines;
  }

  private renderWorkspaceMenu(width: number): string[] {
    const lines: string[] = [];

    lines.push(this.theme.fg("muted", "Workspace Settings"));
    lines.push("");
    lines.push("Mount current working directory to VM?");
    lines.push("");

    const currentStatus = this.config.workspace.mountCwd
      ? this.theme.fg("success", "✓ ON")
      : this.theme.fg("error", "✗ OFF");

    lines.push(`Current: ${currentStatus}`);
    lines.push("");
    lines.push(
      truncateToWidth(
        `${this.theme.fg("accent", "1")} Enable  ${!this.config.workspace.mountCwd ? "" : this.theme.fg("accent", "●")}`,
        width
      )
    );
    lines.push(
      truncateToWidth(
        `${this.theme.fg("accent", "2")} Disable ${this.config.workspace.mountCwd ? "" : this.theme.fg("accent", "●")}`,
        width
      )
    );
    lines.push("");
    lines.push(this.theme.fg("dim", "When disabled, VMs have no access to your files."));
    lines.push(this.theme.fg("dim", "When enabled, VMs can read/write files in your current directory."));

    return lines;
  }

  private renderSkillsMenu(width: number): string[] {
    const lines: string[] = [];

    lines.push(this.theme.fg("muted", "Skills Settings"));
    lines.push("");

    lines.push(
      truncateToWidth(
        `${this.theme.fg("accent", "1")} Enable Skills  ${this.config.skills.enabled ? this.theme.fg("accent", "●") : ""}`,
        width
      )
    );
    lines.push(
      truncateToWidth(
        `${this.theme.fg("accent", "2")} Disable Skills  ${!this.config.skills.enabled ? this.theme.fg("accent", "●") : ""}`,
        width
      )
    );
    lines.push("");

    if (this.config.skills.enabled) {
      lines.push(
        truncateToWidth(
          `${this.theme.fg("accent", "3")} Mount Default Skills: ${this.config.skills.mountDefault ? this.theme.fg("success", "ON") : this.theme.fg("error", "OFF")}`,
          width
        )
      );
      lines.push(
        truncateToWidth(
          `${this.theme.fg("accent", "4")} Read-Only Mode: ${this.config.skills.readOnly ? this.theme.fg("success", "ON") : this.theme.fg("error", "OFF")}`,
          width
        )
      );
      lines.push("");
      lines.push(this.theme.fg("dim", `Custom Paths: ${this.config.skills.customPaths.length}`));
    } else {
      lines.push(this.theme.fg("dim", "Skills mounting is disabled."));
    }

    return lines;
  }

  private renderAutoAttachMenu(width: number): string[] {
    const lines: string[] = [];

    lines.push(this.theme.fg("muted", "Auto-Attach Settings"));
    lines.push("");
    lines.push("Automatically create and attach VM on session start?");
    lines.push("");

    const currentStatus = this.config.autoAttach
      ? this.theme.fg("success", "✓ ON")
      : this.theme.fg("error", "✗ OFF");

    lines.push(`Current: ${currentStatus}`);
    lines.push("");
    lines.push(
      truncateToWidth(
        `${this.theme.fg("accent", "1")} Enable  ${this.config.autoAttach ? this.theme.fg("accent", "●") : ""}`,
        width
      )
    );
    lines.push(
      truncateToWidth(
        `${this.theme.fg("accent", "2")} Disable  ${!this.config.autoAttach ? this.theme.fg("accent", "●") : ""}`,
        width
      )
    );
    lines.push("");
    lines.push(this.theme.fg("dim", "When enabled, your VM is created and attached automatically"));
    lines.push(this.theme.fg("dim", "when you start a new pi session."));

    return lines;
  }

  private renderEnvironmentMenu(width: number): string[] {
    const lines: string[] = [];

    lines.push(this.theme.fg("muted", "Environment Variables"));
    lines.push("");

    const count = Object.keys(this.config.environment).length;
    if (count === 0) {
      lines.push(this.theme.fg("dim", "No environment variables configured."));
    } else {
      lines.push(this.theme.fg("dim", `${count} variable(s) configured:`));
      lines.push("");
      for (const [varName, config] of Object.entries(this.config.environment)) {
        lines.push(truncateToWidth(`  ${varName}: ${config.type}`, width));
      }
    }

    lines.push("");
    lines.push(this.theme.fg("dim", "Use /gondolin config environment to manage variables."));

    return lines;
  }

  private renderNetworkMenu(width: number): string[] {
    const lines: string[] = [];

    lines.push(this.theme.fg("muted", "Network Policies"));
    lines.push("");
    lines.push("Block internal IP ranges (192.168.x.x, 10.x.x.x, etc.)?");
    lines.push("");

    const currentStatus = this.config.network.blockInternalRanges
      ? this.theme.fg("success", "✓ ON")
      : this.theme.fg("error", "✗ OFF");

    lines.push(`Current: ${currentStatus}`);
    lines.push("");
    lines.push(
      truncateToWidth(
        `${this.theme.fg("accent", "1")} Enable  ${this.config.network.blockInternalRanges ? this.theme.fg("accent", "●") : ""}`,
        width
      )
    );
    lines.push(
      truncateToWidth(
        `${this.theme.fg("accent", "2")} Disable  ${!this.config.network.blockInternalRanges ? this.theme.fg("accent", "●") : ""}`,
        width
      )
    );
    lines.push("");
    lines.push(this.theme.fg("dim", "When enabled, blocks access to internal network ranges."));

    if (this.config.network.allowedHosts.length > 0) {
      lines.push("");
      lines.push(this.theme.fg("dim", "Allowed hosts:"));
      for (const host of this.config.network.allowedHosts) {
        lines.push(truncateToWidth(`  • ${host}`, width));
      }
    }

    return lines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}

/**
 * Simpler component for confirmation dialogs
 */
export class ConfirmDialog implements Component {
  private selected = 0;
  private options: string[];
  private title: string;
  private tui: any;
  private theme: any;
  private done: (confirmed: boolean) => void;

  constructor(
    title: string,
    options: string[],
    tui: any,
    theme: any,
    done: (confirmed: boolean) => void
  ) {
    this.title = title;
    this.options = options;
    this.tui = tui;
    this.theme = theme;
    this.done = done;
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.left) && this.selected > 0) {
      this.selected--;
      this.invalidate();
    } else if (matchesKey(data, Key.right) && this.selected < this.options.length - 1) {
      this.selected++;
      this.invalidate();
    } else if (matchesKey(data, Key.enter)) {
      this.done(this.selected === 0);
    } else if (matchesKey(data, Key.escape)) {
      this.done(false);
    }
    this.tui.requestRender();
  }

  render(width: number): string[] {
    const lines: string[] = [];

    lines.push(this.theme.fg("accent", this.title));
    lines.push("");

    // Render options
    let optionsLine = "";
    for (let i = 0; i < this.options.length; i++) {
      const option = this.options[i];
      const isSelected = i === this.selected;
      const styled = isSelected
        ? this.theme.fg("accent", `[${option}]`)
        : `[${option}]`;

      optionsLine += (i > 0 ? "  " : "") + styled;
    }

    lines.push(truncateToWidth(optionsLine, width));

    return lines;
  }

  invalidate(): void {
    // No caching needed for simple dialog
  }
}
