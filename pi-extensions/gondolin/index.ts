import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  type BashOperations,
  createBashTool,
  createEditTool,
  createReadTool,
  createWriteTool,
  type EditOperations,
  type ReadOperations,
  type WriteOperations,
} from "@mariozechner/pi-coding-agent";
import { VM, RealFSProvider, ReadonlyProvider, listSessions, findSession, createHttpHooks, gcSessions } from "@earendil-works/gondolin";
import path from "node:path";
import fs from "node:fs";
import {
  handleConfigCommand,
  setCwdMounting,
  setSkillsOption,
  addSkillPath,
  removeSkillPath,
  setAutoAttach,
  confirmResetConfig,
  mountHostPiSkills,
} from "./config-commands";
import { getConfig } from "./config";
import { buildVMOptions, formatVMCreationWarnings, type VMCreationContext } from "./vm-builder";
import { RemoteVM } from "./remote-vm";

const PI_PREFIX = "pi:";
const SESSION_MARKER = "◆";
const WORKSPACE = "/root/workspace";

function getSkillPaths(): string[] {
  const homeDir = process.env.HOME || "/root";
  const paths = [path.join(homeDir, ".pi/agent/skills")];
  if (process.env.SANDBOX_SKILL_PATHS) {
    paths.push(...process.env.SANDBOX_SKILL_PATHS.split(",").map(p => p.trim()));
  }
  return paths;
}

function getCanonicalSkillPaths(): string[] {
  return getSkillPaths().map(p => {
    try {
      return fs.realpathSync(p);
    } catch {
      return p;
    }
  });
}

async function discoverSkills(): Promise<string[]> {
  const homeDir = process.env.HOME || "/root";
  const skillsDir = path.join(homeDir, ".pi/agent/skills");
  
  if (!fs.existsSync(skillsDir)) {
    throw new Error(`Skills directory not found: ${skillsDir}`);
  }
  
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory() && fs.existsSync(path.join(skillsDir, e.name, "SKILL.md")))
    .map(e => path.join(skillsDir, e.name));
}

declare global {
  var gondolinVmRegistry: Map<string, { name: string; vm: VM }>;
}

if (!globalThis.gondolinVmRegistry) {
  globalThis.gondolinVmRegistry = new Map();
}

const vms = new Map<string, VM | RemoteVM>();
const vmIds = new Map<string, string>();
const vmCustomMounts = new Map<string, { guestPath: string; hostPath: string; writable: boolean }[]>();
const remoteVms = new Set<string>(); // Track which VMs are remote
let currentSessionId: string | undefined;
let attachedVm: VM | RemoteVM | null = null;
let lastContext: any = null;

function updateStatusBar() {
  if (!lastContext) return;
  
  if (!attachedVm) {
    lastContext.ui.setStatus("gondolin", "Not attached to VM");
  } else {
    const vmName = vmIds.get(attachedVm.id) || "unknown";
    const vmId = attachedVm.id.substring(0, 8);
    const isRemote = remoteVms.has(vmName);
    const remoteTag = isRemote ? " [remote]" : "";
    const theme = lastContext.ui.theme;
    const indicator = theme.fg("accent", "▶");
    const status = theme.fg("dim", ` Sandbox: ${vmName}${remoteTag} [${vmId}]`);
    lastContext.ui.setStatus("gondolin", indicator + status);
  }
}

function shQuote(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

/**
 * Extract UUID from session filename
 * Handles filenames like: 2026-02-23T21-25-57-602Z_f6d80712-69d3-4dfb-86f6-43167d0c813al.json
 * Returns only the UUID part: f6d80712-69d3-4dfb-86f6-43167d0c813al
 */
function extractSessionUUID(filename: string): string {
  // Remove .json extension
  const withoutExt = filename.replace(".json", "");
  
  // If there's an underscore, take the part after it (UUID)
  // Otherwise, return the whole thing (for backward compatibility)
  const parts = withoutExt.split("_");
  return parts.length > 1 ? parts[parts.length - 1] : withoutExt;
}

function isVmInCurrentSession(sessionLabel: string, currentSessionId: string): boolean {
  return sessionLabel.startsWith(PI_PREFIX) && sessionLabel.split(":")[1] === currentSessionId;
}

function cleanupVm(vmName: string, vmId: string): void {
  vms.delete(vmName);
  vmIds.delete(vmId);
  vmCustomMounts.delete(vmName);
  remoteVms.delete(vmName);
  globalThis.gondolinVmRegistry.delete(vmName);
  if (attachedVm && vmIds.get(attachedVm.id) === vmName) {
    attachedVm = null;
    updateStatusBar();
  }
}



/**
 * For remote VMs: no path validation needed, just return the path as-is
 */
function toRemoteVmPath(localPath: string): string {
  // For remote VMs, accept any absolute path or relative path
  // No workspace boundary checks
  return path.isAbsolute(localPath) ? localPath : path.resolve(localPath);
}

function toGuestPathWithExceptions(localCwd: string, localPath: string, exceptions?: string[], customMounts?: { guestPath: string; hostPath: string; writable: boolean }[]): string {
  // Handle absolute paths that are already in guest format (starting with /root/workspace or /root/.pi)
  if (localPath.startsWith("/root/workspace") || localPath.startsWith("/root/.pi")) {
    // Normalize the path to resolve .. and . components, preventing directory traversal
    const normalized = path.posix.normalize(localPath);
    // Verify it's still within the allowed boundaries after normalization
    if (normalized.startsWith("/root/workspace") || normalized.startsWith("/root/.pi")) {
      return normalized;
    }
    throw new Error(`path escapes workspace: ${localPath}`);
  }

  // Check custom mounts first (highest priority)
  if (customMounts?.length) {
    try {
      const canonicalPath = fs.realpathSync(localPath);
      for (const mount of customMounts) {
        const canonicalHostPath = fs.realpathSync(mount.hostPath);
        if (canonicalPath === canonicalHostPath || canonicalPath.startsWith(canonicalHostPath + path.sep)) {
          // Map the local path to the mounted guest path
          const rel = path.relative(canonicalHostPath, canonicalPath);
          const posixRel = rel.split(path.sep).join(path.posix.sep);
          return path.posix.join(mount.guestPath, posixRel);
        }
      }
    } catch {
      // Fall through to skill paths check
    }
  }

  if (exceptions?.length) {
    try {
      const canonicalPath = fs.realpathSync(localPath);
      // Check if the path is within any of the exception paths (skill directories)
      for (const exceptionPath of getCanonicalSkillPaths()) {
        if (canonicalPath === exceptionPath || canonicalPath.startsWith(exceptionPath + path.sep)) {
          // Map the local skill path to the mounted guest path
          const skillsBaseDir = path.join(process.env.HOME || "/root", ".pi/agent/skills");
          const rel = path.relative(skillsBaseDir, canonicalPath);
          const posixRel = rel.split(path.sep).join(path.posix.sep);
          return path.posix.join("/root/.pi/agent/skills", posixRel);
        }
      }
    } catch {
      // Fall through to regular validation
    }
  }

  // Also check for absolute skill paths that might not have been resolved yet
  // e.g., /Users/user/.pi/agent/skills/... (host home dir)
  try {
    const skillsBaseDir = path.join(process.env.HOME || "/root", ".pi/agent/skills");
    const canonicalPath = fs.realpathSync(localPath);
    const canonicalSkillsBase = fs.realpathSync(skillsBaseDir);
    if (canonicalPath === canonicalSkillsBase || canonicalPath.startsWith(canonicalSkillsBase + path.sep)) {
      const rel = path.relative(canonicalSkillsBase, canonicalPath);
      const posixRel = rel.split(path.sep).join(path.posix.sep);
      return path.posix.join("/root/.pi/agent/skills", posixRel);
    }
  } catch {
    // Path doesn't exist or can't be resolved, will be caught in access check
  }
  
  const rel = path.relative(localCwd, localPath);
  if (rel === "") return WORKSPACE;
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`path escapes workspace: ${localPath}`);
  }
  const posixRel = rel.split(path.sep).join(path.posix.sep);
  return path.posix.join(WORKSPACE, posixRel);
}

function createVmReadOps(vm: VM, localCwd: string, exceptions?: string[], customMounts?: { guestPath: string; hostPath: string; writable: boolean }[]): ReadOperations {
  return {
    readFile: async (p) => {
      const guestPath = toGuestPathWithExceptions(localCwd, p, exceptions, customMounts);
      const r = await vm.exec(["/bin/cat", guestPath]);
      if (!r.ok) throw new Error(`cat failed (${r.exitCode}): ${r.stderr}`);
      return r.stdoutBuffer;
    },
    access: async (p) => {
      const guestPath = toGuestPathWithExceptions(localCwd, p, exceptions, customMounts);
      const r = await vm.exec(["/bin/sh", "-lc", `test -r ${shQuote(guestPath)}`]);
      if (!r.ok) throw new Error(`not readable: ${p}`);
    },
    detectImageMimeType: async (p) => {
      const guestPath = toGuestPathWithExceptions(localCwd, p, exceptions, customMounts);
      try {
        const r = await vm.exec(["/bin/sh", "-lc", `file --mime-type -b ${shQuote(guestPath)}`]);
        if (!r.ok) return null;
        const m = r.stdout.trim();
        return ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(m) ? m : null;
      } catch {
        return null;
      }
    },
  };
}

function createVmWriteOps(vm: VM, localCwd: string, exceptions?: string[], customMounts?: { guestPath: string; hostPath: string; writable: boolean }[]): WriteOperations {
  return {
    writeFile: async (p, content) => {
      const guestPath = toGuestPathWithExceptions(localCwd, p, exceptions, customMounts);
      const dir = path.posix.dirname(guestPath);
      const b64 = Buffer.from(content, "utf8").toString("base64");
      const script = [`set -eu`, `mkdir -p ${shQuote(dir)}`, `echo ${shQuote(b64)} | base64 -d > ${shQuote(guestPath)}`].join("\n");
      const r = await vm.exec(["/bin/sh", "-lc", script]);
      if (!r.ok) throw new Error(`write failed (${r.exitCode}): ${r.stderr}`);
    },
    mkdir: async (dir) => {
      const guestDir = toGuestPathWithExceptions(localCwd, dir, exceptions, customMounts);
      const r = await vm.exec(["/bin/mkdir", "-p", guestDir]);
      if (!r.ok) throw new Error(`mkdir failed (${r.exitCode}): ${r.stderr}`);
    },
  };
}

function createVmEditOps(vm: VM, localCwd: string, exceptions?: string[], customMounts?: { guestPath: string; hostPath: string; writable: boolean }[]): EditOperations {
  const r = createVmReadOps(vm, localCwd, exceptions, customMounts);
  const w = createVmWriteOps(vm, localCwd, exceptions, customMounts);
  return { readFile: r.readFile, access: r.access, writeFile: w.writeFile };
}

function createVmBashOps(vm: VM, localCwd: string, exceptions?: string[], customMounts?: { guestPath: string; hostPath: string; writable: boolean }[]): BashOperations {
  return {
    exec: async (command, cwd, { onData, signal, timeout, env: _env }) => {
      let guestCwd: string;
      try {
        guestCwd = toGuestPathWithExceptions(localCwd, cwd, exceptions, customMounts);
      } catch (e) {
        throw e;
      }

      const ac = new AbortController();
      const onAbort = () => ac.abort();
      signal?.addEventListener("abort", onAbort, { once: true });

      let timedOut = false;
      const timer = timeout && timeout > 0
        ? setTimeout(() => { timedOut = true; ac.abort(); }, timeout * 1000)
        : undefined;

      try {
        const proc = vm.exec(["/bin/bash", "-lc", command], {
          cwd: guestCwd,
          signal: ac.signal,
          stdout: "pipe",
          stderr: "pipe",
        });

        for await (const chunk of proc.output()) {
          onData(chunk.data);
        }

        return { exitCode: (await proc).exitCode };
      } catch (err) {
        if (signal?.aborted) throw new Error("aborted");
        if (timedOut) throw new Error(`timeout:${timeout}`);
        throw err;
      } finally {
        if (timer) clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
    },
  };
}

// Remote VM operations - no workspace boundary checks
function createRemoteVmReadOps(vm: RemoteVM): ReadOperations {
  return {
    readFile: async (p) => {
      const vmPath = toRemoteVmPath(p);
      const r = await vm.exec(["/bin/cat", vmPath]);
      if (!r.ok) throw new Error(`cat failed (${r.exitCode}): ${r.stderr}`);
      return r.stdoutBuffer;
    },
    access: async (p) => {
      const vmPath = toRemoteVmPath(p);
      const r = await vm.exec(["/bin/sh", "-c", `test -r ${shQuote(vmPath)}`]);
      if (!r.ok) throw new Error(`not readable: ${p}`);
    },
    detectImageMimeType: async (p) => {
      const vmPath = toRemoteVmPath(p);
      try {
        const r = await vm.exec(["/bin/sh", "-c", `file --mime-type -b ${shQuote(vmPath)}`]);
        if (!r.ok) return null;
        const m = r.stdout.trim();
        return ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(m) ? m : null;
      } catch {
        return null;
      }
    },
  };
}

function createRemoteVmWriteOps(vm: RemoteVM): WriteOperations {
  return {
    writeFile: async (p, content) => {
      const vmPath = toRemoteVmPath(p);
      const dir = path.posix.dirname(vmPath);
      const b64 = Buffer.from(content, "utf8").toString("base64");
      const r = await vm.exec(["/bin/sh", "-c", `mkdir -p ${shQuote(dir)} && echo ${shQuote(b64)} | base64 -d > ${shQuote(vmPath)}`]);
      if (!r.ok) throw new Error(`write failed (${r.exitCode}): ${r.stderr}`);
    },
  };
}

function createRemoteVmEditOps(vm: RemoteVM): EditOperations {
  return {
    editFile: async (p, oldText, newText) => {
      const vmPath = toRemoteVmPath(p);
      const r1 = await vm.exec(["/bin/cat", vmPath]);
      if (!r1.ok) throw new Error(`read failed: ${r1.stderr}`);
      const current = r1.stdout;
      if (!current.includes(oldText)) throw new Error(`old text not found in ${p}`);
      const updated = current.replace(oldText, newText);
      const b64 = Buffer.from(updated, "utf8").toString("base64");
      const r2 = await vm.exec(["/bin/sh", "-c", `echo ${shQuote(b64)} | base64 -d > ${shQuote(vmPath)}`]);
      if (!r2.ok) throw new Error(`write failed: ${r2.stderr}`);
    },
  };
}

function createRemoteVmBashOps(vm: RemoteVM): BashOperations {
  return {
    exec: async (command, cwd, { onData, signal, timeout, env: _env }) => {
      const ac = new AbortController();
      const onAbort = () => ac.abort();
      signal?.addEventListener("abort", onAbort, { once: true });

      let timedOut = false;
      const timer = timeout && timeout > 0
        ? setTimeout(() => { timedOut = true; ac.abort(); }, timeout * 1000)
        : undefined;

      try {
        const proc = vm.exec(["/bin/sh", "-c", command], {
          signal: ac.signal,
          stdout: "pipe",
          stderr: "pipe",
        });

        for await (const chunk of proc.output()) {
          onData(chunk.data);
        }

        return { exitCode: (await proc).exitCode };
      } catch (err) {
        if (signal?.aborted) throw new Error("aborted");
        if (timedOut) throw new Error(`timeout:${timeout}`);
        throw err;
      } finally {
        if (timer) clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
    },
  };
}

export default function (pi: ExtensionAPI) {
  const localCwd = process.cwd();
  const vmSkillExceptions = new Map<string, string[]>();

  // Load existing VMs from global registry on startup
  for (const [vmName, { vm }] of globalThis.gondolinVmRegistry) {
    vms.set(vmName, vm);
    vmIds.set(vm.id, vmName);
  }

  // Initialize status bar on session start
  pi.on("session_start", async (_event, ctx) => {
    lastContext = ctx;
    updateStatusBar();

    // Handle auto-attach if enabled
    try {
      const config = await getConfig();
      if (config.autoAttach && !attachedVm) {
        const defaultVmName = config.workspace.defaultVmName;
        
        // Check if VM already exists
        if (vms.has(defaultVmName)) {
          attachedVm = vms.get(defaultVmName)!;
          updateStatusBar();
          ctx.ui.notify(`🔵 Auto-attached to: ${defaultVmName}`, "success");
          return;
        }

        // Create new default VM with current config
        try {
          // Get session ID from context
          if (!currentSessionId) {
            const sessionFile = ctx.sessionManager.getSessionFile();
            const filename = sessionFile?.split("/").pop() || "ephemeral";
            currentSessionId = extractSessionUUID(filename);
          }
          
          const buildResult = await buildVMOptions({
            vmName: defaultVmName,
            localCwd: process.cwd(),
            sessionId: currentSessionId,
            config,
          });

          const vm = await VM.create(buildResult.options);
          await vm.exec("echo 'VM started'", { cwd: "/root/workspace" });

          vms.set(defaultVmName, vm);
          vmIds.set(vm.id, defaultVmName);
          if (buildResult.skillPaths.length > 0) {
            vmSkillExceptions.set(defaultVmName, buildResult.skillPaths);
          }
          if (buildResult.customMounts.length > 0) {
            vmCustomMounts.set(defaultVmName, buildResult.customMounts);
          }
          globalThis.gondolinVmRegistry.set(defaultVmName, { name: defaultVmName, vm });

          attachedVm = vm;
          updateStatusBar();

          if (buildResult.warnings.length > 0) {
            const warningText = formatVMCreationWarnings(buildResult.warnings);
            ctx.ui.notify(`🔵 Auto-attached to: ${defaultVmName}\n${warningText}`, "success");
          } else {
            ctx.ui.notify(`🔵 Auto-attached to: ${defaultVmName}`, "success");
          }
        } catch (err) {
          ctx.ui.notify(`Failed to auto-attach: ${err}`, "error");
        }
      }
    } catch (err) {
      ctx.ui.notify(`Auto-attach config error: ${err}`, "error");
    }
  });

  // Clear status on session shutdown
  pi.on("session_shutdown", () => {
    attachedVm = null;
    vms.clear();
    vmIds.clear();
    lastContext = null;
  });

  const localRead = createReadTool(localCwd);
  const localWrite = createWriteTool(localCwd);
  const localEdit = createEditTool(localCwd);
  const localBash = createBashTool(localCwd);

  const getTool = (type: "read" | "write" | "edit" | "bash") => {
    return async (id: any, params: any, signal: any, onUpdate: any, ctx: any) => {
      if (!attachedVm) {
        switch (type) {
          case "read": return localRead.execute(id, params, signal, onUpdate, ctx);
          case "write": return localWrite.execute(id, params, signal, onUpdate, ctx);
          case "edit": return localEdit.execute(id, params, signal, onUpdate, ctx);
          case "bash": return localBash.execute(id, params, signal, onUpdate, ctx);
        }
      }
      
      const vmName = vmIds.get(attachedVm.id) || "unknown";
      const isRemote = remoteVms.has(vmName);
      
      // Use appropriate operations based on VM type
      if (isRemote && attachedVm instanceof RemoteVM) {
        switch (type) {
          case "read":
            return createReadTool(localCwd, { operations: createRemoteVmReadOps(attachedVm) })
              .execute(id, params, signal, onUpdate, ctx);
          case "write":
            return createWriteTool(localCwd, { operations: createRemoteVmWriteOps(attachedVm) })
              .execute(id, params, signal, onUpdate, ctx);
          case "edit":
            return createEditTool(localCwd, { operations: createRemoteVmEditOps(attachedVm) })
              .execute(id, params, signal, onUpdate, ctx);
          case "bash":
            return createBashTool(localCwd, { operations: createRemoteVmBashOps(attachedVm) })
              .execute(id, params, signal, onUpdate, ctx);
        }
      }
      
      // Use pi-managed VM operations with workspace checks
      const exceptions = vmSkillExceptions.get(vmName);
      const customMounts = vmCustomMounts.get(vmName);
      switch (type) {
        case "read":
          return createReadTool(localCwd, { operations: createVmReadOps(attachedVm as VM, localCwd, exceptions, customMounts) })
            .execute(id, params, signal, onUpdate, ctx);
        case "write":
          return createWriteTool(localCwd, { operations: createVmWriteOps(attachedVm as VM, localCwd, exceptions, customMounts) })
            .execute(id, params, signal, onUpdate, ctx);
        case "edit":
          return createEditTool(localCwd, { operations: createVmEditOps(attachedVm as VM, localCwd, exceptions, customMounts) })
            .execute(id, params, signal, onUpdate, ctx);
        case "bash":
          return createBashTool(localCwd, { operations: createVmBashOps(attachedVm as VM, localCwd, exceptions, customMounts) })
            .execute(id, params, signal, onUpdate, ctx);
      }
    };
  };

  pi.registerTool({ ...localRead, execute: getTool("read") });
  pi.registerTool({ ...localWrite, execute: getTool("write") });
  pi.registerTool({ ...localEdit, execute: getTool("edit") });
  pi.registerTool({ ...localBash, execute: getTool("bash") });

  pi.on("user_bash", (event, ctx) => {
    if (!attachedVm) return;
    const vmName = vmIds.get(attachedVm.id) || "unknown";
    const isRemote = remoteVms.has(vmName);
    
    if (isRemote && attachedVm instanceof RemoteVM) {
      return { operations: createRemoteVmBashOps(attachedVm) };
    }
    
    const exceptions = vmSkillExceptions.get(vmName);
    const customMounts = vmCustomMounts.get(vmName);
    return { operations: createVmBashOps(attachedVm as VM, localCwd, exceptions, customMounts) };
  });

  pi.on("before_agent_start", (event, ctx) => {
    if (!attachedVm) return;
    return { systemPrompt: event.systemPrompt.replace(`Current working directory: ${localCwd}`, `Current working directory: ${WORKSPACE}`) };
  });

  pi.registerCommand("gondolin", {
    description: "Manage Gondolin VMs (start [name] [--mount-skills] | stop [name-or-id|session|all] | list | attach [name-or-id] | detach | recreate [name] | gc | exec <vm-id-or-name> <cmd> | config [cwd|skills|auto-attach|guest-image|environment|secrets|mount-host-skills|edit|view|reset])",
    async handler(args, ctx) {
      if (!currentSessionId) {
        const sessionFile = ctx.sessionManager.getSessionFile();
        const filename = sessionFile?.split("/").pop() || "ephemeral";
        currentSessionId = extractSessionUUID(filename);
      }

      const [cmd, ...restArgs] = args.trim().split(/\s+/);
      const restArgsStr = restArgs.join(" ");

      try {
        // Handle config subcommands
        if (cmd === "config") {
          const [subCmd, ...configArgs] = restArgs;
          const configArgsStr = configArgs.join(" ");

          switch (subCmd) {
            case "cwd": {
              if (configArgs.length === 0) {
                await handleConfigCommand("cwd", ctx);
              } else if (configArgs[0] === "on") {
                await setCwdMounting(true, ctx);
              } else if (configArgs[0] === "off") {
                await setCwdMounting(false, ctx);
              } else {
                ctx.ui.notify("Usage: /gondolin config cwd [on|off]", "info");
              }
              return;
            }

            case "skills": {
              if (configArgs.length === 0) {
                await handleConfigCommand("skills", ctx);
              } else if (configArgs[0] === "enable") {
                await setSkillsOption("enable", undefined, ctx);
              } else if (configArgs[0] === "default") {
                await setSkillsOption("default", undefined, ctx);
              } else if (configArgs[0] === "read-only") {
                await setSkillsOption("read-only", undefined, ctx);
              } else if (configArgs[0] === "add" && configArgs.length > 1) {
                const skillPath = configArgs.slice(1).join(" ");
                await addSkillPath(skillPath, ctx);
              } else if (configArgs[0] === "remove" && configArgs.length > 1) {
                const index = parseInt(configArgs[1], 10) - 1;
                await removeSkillPath(index, ctx);
              } else {
                ctx.ui.notify(
                  "Usage: /gondolin config skills {enable|default|read-only|add <path>|remove <index>}",
                  "info"
                );
              }
              return;
            }

            case "view": {
              await handleConfigCommand("view", ctx);
              return;
            }

            case "reset": {
              if (configArgs[0] === "confirm") {
                await confirmResetConfig(ctx);
              } else {
                await handleConfigCommand("reset", ctx);
              }
              return;
            }

            case "edit": {
              await handleConfigCommand("edit", ctx);
              return;
            }

            case "auto-attach": {
              if (configArgs.length === 0) {
                await handleConfigCommand("auto-attach", ctx);
              } else if (configArgs[0] === "on") {
                await setAutoAttach(true, ctx);
              } else if (configArgs[0] === "off") {
                await setAutoAttach(false, ctx);
              } else {
                ctx.ui.notify("Usage: /gondolin config auto-attach [on|off]", "info");
              }
              return;
            }

            case "environment": {
              await handleConfigCommand(`environment ${configArgsStr}`, ctx);
              return;
            }

            case "secrets": {
              await handleConfigCommand(`secrets ${configArgsStr}`, ctx);
              return;
            }

            case "mount-host-skills": {
              await mountHostPiSkills(ctx);
              return;
            }

            default:
              ctx.ui.notify(
                "Usage: /gondolin config {cwd [on|off] | skills {enable|default|read-only|add <path>|remove <index>} | auto-attach [on|off] | guest-image {set <path>|unset|show} | environment {add|remove|list} | secrets {add|remove|list} | mount-host-skills | edit | view | reset}",
                "info"
              );
              return;
          }
        }

        // Original gondolin commands
        const mountSkills = restArgs.includes("--mount-skills");
        const name = restArgs.find(arg => !arg.startsWith("-")) || "default";

        switch (cmd) {
          case "start": {
            if (vms.has(name)) {
              ctx.ui.notify(`VM already exists: ${name}`, "warning");
              return;
            }

            ctx.ui.notify(`Starting ${name}...`, "info");

            try {
              // Load configuration
              const config = await getConfig();

              // Build VM options from config
              const buildResult = await buildVMOptions({
                vmName: name,
                localCwd,
                sessionId: currentSessionId || "ephemeral",
                config,
                overrides: {
                  mountCwd: mountSkills ? undefined : (restArgs.includes("--mount-cwd") ? true : undefined),
                  mountSkills: restArgs.includes("--mount-skills") ? true : undefined,
                  skillsReadOnly: restArgs.includes("--writable-skills") ? false : undefined,
                },
              });

              const vmCreateOptions = buildResult.options;

              // Notify about any warnings
              if (buildResult.warnings.length > 0) {
                const warningText = formatVMCreationWarnings(buildResult.warnings);
                ctx.ui.notify(warningText, "warning");
              }

              // Create VM
              const vm = await VM.create(vmCreateOptions);
              await vm.exec("echo 'VM started'", { cwd: "/root/workspace" });

              // Register VM
              vms.set(name, vm);
              vmIds.set(vm.id, name);
              if (buildResult.skillPaths.length > 0) {
                vmSkillExceptions.set(name, buildResult.skillPaths);
              }
              if (buildResult.customMounts.length > 0) {
                vmCustomMounts.set(name, buildResult.customMounts);
              }
              globalThis.gondolinVmRegistry.set(name, { name, vm });

              const details =
                `Started: ${name}\n` +
                `ID: ${vm.id}\n` +
                `CWD mount: ${config.workspace.mountCwd ? "ON" : "OFF"}\n` +
                `Skills: ${config.skills.enabled ? "ON" : "OFF"}${config.skills.readOnly ? " (read-only)" : ""}`
              ;

              ctx.ui.notify(details, "success");
            } catch (err) {
              ctx.ui.notify(`Error starting VM: ${err}`, "error");
            }
            break;
          }

          case "stop": {
            const stopVm = async (vmName: string) => {
              if (!vms.has(vmName)) return false;
              const vm = vms.get(vmName)!;
              try {
                await vm.close();
                // Cleanup stale sessions after VM stops
                await gcSessions();
              } catch (err) {
                ctx.ui.notify(`Error: ${err}`, "error");
              }
              cleanupVm(vmName, vm.id);
              vmSkillExceptions.delete(vmName);
              return true;
            };

            // Handle keywords
            if (!name || name === "default" || name === "session" || name === "all") {
              if (!name || name === "default") {
                if (await stopVm("default")) {
                  ctx.ui.notify("Stopped: default", "success");
                  return;
                }
                const allSessions = await listSessions();
                const defaultSessions = allSessions.filter(s => s.label?.endsWith(":default"));
                if (defaultSessions.length === 0) {
                  ctx.ui.notify("VM not found: default", "error");
                } else {
                  const info = defaultSessions.map(s => `  ${s.label?.split(":")[0]}: ${s.id.substring(0, 8)}`).join("\n");
                  ctx.ui.notify(`Found in other session(s):\n${info}\nSwitch to that session and stop it.`, "warning");
                }
                return;
              }

              if (name === "session" || name === "all") {
                const allSessions = await listSessions();
                const filter = name === "session"
                  ? (s: any) => s.label?.startsWith(PI_PREFIX) && s.label?.split(":")[1] === currentSessionId
                  : (s: any) => s.label?.startsWith(PI_PREFIX);

                let count = 0;
                for (const session of allSessions.filter(filter)) {
                  const vmName = vmIds.get(session.id);
                  if (vmName && await stopVm(vmName)) count++;
                }
                ctx.ui.notify(count === 0 ? "No VMs found" : `Stopped ${count} VM(s)`, count > 0 ? "success" : "info");
                return;
              }
            }

            // Stop by name or ID
            if (await stopVm(name)) {
              ctx.ui.notify(`Stopped: ${name}`, "success");
              return;
            }

            const session = await findSession(name);
            if (!session) {
              ctx.ui.notify(`VM not found: ${name}`, "error");
              return;
            }

            const sessionLabel = session.label || "";
            if (!isVmInCurrentSession(sessionLabel, currentSessionId || "ephemeral")) {
              ctx.ui.notify(`VM in different session (${sessionLabel.split(":")[0]}).\nSwitch to that session to stop it.`, "error");
              return;
            }

            const vmName = vmIds.get(session.id);
            if (vmName && await stopVm(vmName)) {
              ctx.ui.notify(`Stopped: ${vmName}`, "success");
            } else {
              ctx.ui.notify("VM not in local registry", "warning");
            }
            break;
          }

          case "attach": {
            if (attachedVm) {
              ctx.ui.notify("Already attached. Run '/gondolin detach' first", "warning");
              return;
            }

            // 1. Check local VMs first
            if (vms.has(name)) {
              attachedVm = vms.get(name)!;
              updateStatusBar();
              ctx.ui.notify(`Attached to: ${name}`, "success");
              return;
            }

            // 2. Search session registry for host VMs
            const session = await findSession(name);
            if (session) {
              const sessionLabel = session.label || "";
              
              // Check if it's a host VM (not in current session)
              const isHostVm = !isVmInCurrentSession(sessionLabel, currentSessionId || "ephemeral");
              
              if (!isHostVm) {
                // It's a local VM in current session
                const vmName = vmIds.get(session.id);
                if (vmName && vms.has(vmName)) {
                  attachedVm = vms.get(vmName)!;
                  updateStatusBar();
                  ctx.ui.notify(`Attached to: ${vmName}`, "success");
                  return;
                }
              }
              
              // Try to attach to host VM
              if (isHostVm || !session.label?.startsWith(PI_PREFIX)) {
                if (!session.alive) {
                  ctx.ui.notify(`VM not alive: ${name}`, "error");
                  return;
                }

                try {
                  const remoteVm = new RemoteVM(session.socketPath, session.id);
                  await remoteVm.connect();

                  vms.set(name, remoteVm);
                  vmIds.set(remoteVm.id, name);
                  remoteVms.add(name);

                  attachedVm = remoteVm;
                  updateStatusBar();
                  ctx.ui.notify(`Attached to: ${name} [remote]`, "success");
                  return;
                } catch (err) {
                  ctx.ui.notify(`Failed to attach to remote VM: ${err}`, "error");
                  return;
                }
              }
            }

            // 3. Try default VM
            if (name === "default") {
              const sessions = await listSessions();
              const currentVMs = sessions.filter(s =>
                s.label?.startsWith(PI_PREFIX) && s.label?.split(":")[1] === currentSessionId
              );
              if (currentVMs.length === 1) {
                const vmName = vmIds.get(currentVMs[0].id);
                if (vmName && vms.has(vmName)) {
                  attachedVm = vms.get(vmName)!;
                  updateStatusBar();
                  ctx.ui.notify(`Attached to: ${vmName}`, "success");
                  return;
                }
              }
            }

            ctx.ui.notify(`VM not found: ${name}`, "error");
            break;
          }

          case "detach": {
            if (!attachedVm) {
              ctx.ui.notify("Not attached", "warning");
              return;
            }
            
            // Close remote VM connection if detaching from one
            const vmName = vmIds.get(attachedVm.id);
            if (vmName && remoteVms.has(vmName)) {
              if (attachedVm instanceof RemoteVM) {
                attachedVm.close().catch(err => {
                  ctx.ui.notify(`Warning closing remote VM: ${err}`, "warning");
                });
              }
            }
            
            attachedVm = null;
            updateStatusBar();
            ctx.ui.notify("Detached", "success");
            break;
          }

          case "recreate": {
            const vmName = restArgs.find(arg => !arg.startsWith("-")) || "default";
            const wasAttached = attachedVm && vmIds.get(attachedVm.id) === vmName;

            try {
              ctx.ui.notify(`Recreating ${vmName}...`, "info");

              // Step 1: Detach if attached
              if (wasAttached) {
                attachedVm = null;
                updateStatusBar();
              }

              // Step 2: Stop the VM
              if (vms.has(vmName)) {
                const vm = vms.get(vmName)!;
                try {
                  await vm.close();
                  await gcSessions();
                } catch (err) {
                  ctx.ui.notify(`Warning stopping VM: ${err}`, "warning");
                }
                cleanupVm(vmName, vm.id);
                vmSkillExceptions.delete(vmName);
              }

              // Step 3: Recreate the VM
              const config = await getConfig();
              const buildResult = await buildVMOptions({
                vmName,
                localCwd,
                sessionId: currentSessionId || "ephemeral",
                config,
              });

              const newVm = await VM.create(buildResult.options);
              await newVm.exec("echo 'VM started'", { cwd: "/root/workspace" });

              // Step 4: Register new VM
              vms.set(vmName, newVm);
              vmIds.set(newVm.id, vmName);
              if (buildResult.skillPaths.length > 0) {
                vmSkillExceptions.set(vmName, buildResult.skillPaths);
              }
              if (buildResult.customMounts.length > 0) {
                vmCustomMounts.set(vmName, buildResult.customMounts);
              }
              globalThis.gondolinVmRegistry.set(vmName, { name: vmName, vm: newVm });

              // Step 5: Reattach if was attached
              if (wasAttached) {
                attachedVm = newVm;
                updateStatusBar();
              }

              const details =
                `Recreated: ${vmName}\n` +
                `ID: ${newVm.id}\n` +
                `CWD mount: ${config.workspace.mountCwd ? "ON" : "OFF"}\n` +
                `Skills: ${config.skills.enabled ? "ON" : "OFF"}${config.skills.readOnly ? " (read-only)" : ""}` +
                (wasAttached ? `\nReattached: Yes` : "")
              ;

              ctx.ui.notify(details, "success");
            } catch (err) {
              ctx.ui.notify(`Error recreating VM: ${err}`, "error");
            }
            break;
          }

          case "gc": {
            try {
              const cleaned = await gcSessions();
              ctx.ui.notify(cleaned === 0 ? "No stale sessions found" : `Cleaned up ${cleaned} stale session(s)`, "success");
            } catch (err) {
              ctx.ui.notify(`Error: ${err}`, "error");
            }
            break;
          }

          case "list": {
            const sessions = await listSessions();
            
            // Cleanup stale sessions before listing
            try {
              const staleCount = await gcSessions();
              if (staleCount > 0) {
                // Re-list after cleanup
                const updatedSessions = await listSessions();
              }
            } catch (err) {
              // Ignore gc errors, just proceed with listing
            }
            
            if (sessions.length === 0) {
              ctx.ui.notify("No VMs", "info");
              return;
            }

            const daemonIds = new Set(sessions.map(s => s.id));
            for (const [id, vmName] of vmIds.entries()) {
              if (!daemonIds.has(id)) {
                vmIds.delete(id);
                vms.delete(vmName);
              }
            }

            const yellow = "\x1b[93m";
            const blue = "\x1b[94m";
            const reset = "\x1b[0m";
            const dim = "\x1b[2m";
            const bright = "\x1b[1m";

            const piVMs: string[] = [];
            const hostVMs: string[] = [];

            sessions.forEach(s => {
              const age = Math.floor((Date.now() - new Date(s.createdAt).getTime()) / 1000);
              const status = s.alive ? "✓" : "✗";
              const label = s.label || s.id.substring(0, 8);

              if (label.startsWith(PI_PREFIX)) {
                const parts = label.split(":");
                const displayName = parts.slice(2).join(":");
                const vmName = vmIds.get(s.id);
                const isCurrent = parts[1] === currentSessionId ? ` ${SESSION_MARKER}` : "";
                const hasSkills = vmName && vmSkillExceptions.has(vmName) ? " 📚" : "";
                const isAttached = attachedVm && vmIds.get(s.id) === vmIds.get(attachedVm.id) ? ` ${bright}[attached]${reset}` : "";
                const shortId = s.id.substring(0, 8);
                piVMs.push(`    ${status} ${displayName}${isCurrent}${hasSkills}${isAttached} ${dim}[${shortId}]${reset} (${age}s)`);
              } else {
                const vmName = vmIds.get(s.id);
                const isRemote = vmName && remoteVms.has(vmName) ? " [remote]" : "";
                const isAttached = attachedVm && vmIds.get(s.id) === vmIds.get(attachedVm.id) ? ` ${bright}[attached]${reset}` : "";
                const shortId = s.id.substring(0, 8);
                hostVMs.push(`    ${status} ${label}${isRemote}${isAttached} ${dim}[${shortId}]${reset} (${age}s)`);
              }
            });

            const output = [`${yellow}[Gondolin]${reset}`];
            if (piVMs.length) output.push(`  ${blue}pi vm:${reset}`, ...piVMs);
            if (hostVMs.length) output.push(`  ${blue}host vm:${reset}`, ...hostVMs);
            ctx.ui.notify(output.join("\n"), "info");
            break;
          }

          case "exec": {
            if (restArgs.length < 2) {
              ctx.ui.notify("Usage: /gondolin exec <vm-id-or-name> <command> [args...]", "info");
              break;
            }

            const vmIdOrName = restArgs[0];
            const commandArgs = restArgs.slice(1);
            const command = commandArgs.join(" ");

            try {
              let targetVm: VM | RemoteVM | null = null;
              let vmName: string = "";
              
              // 1. Try exact name match in local vms
              if (vms.has(vmIdOrName)) {
                targetVm = vms.get(vmIdOrName)!;
                vmName = vmIdOrName;
              } else {
                // 2. Search all VMs in local map by ID prefix
                for (const [name, vm] of vms) {
                  if (vm.id.startsWith(vmIdOrName)) {
                    targetVm = vm;
                    vmName = name;
                    break;
                  }
                }
                
                // 3. Search all sessions (from daemon) by ID prefix
                if (!targetVm) {
                  const sessions = await listSessions();
                  const matchingSession = sessions.find(s => s.id.startsWith(vmIdOrName));
                  
                  if (matchingSession) {
                    // Check if it's already in local map
                    const existingName = vmIds.get(matchingSession.id);
                    if (existingName && vms.has(existingName)) {
                      targetVm = vms.get(existingName)!;
                      vmName = existingName;
                    } else {
                      // Need to create a connection
                      if (!matchingSession.alive) {
                        ctx.ui.notify(`VM not alive: ${vmIdOrName}`, "error");
                        break;
                      }
                      
                      // Determine if it's a host VM or pi-managed
                      const isHostVm = !matchingSession.label?.startsWith(PI_PREFIX);
                      
                      if (isHostVm) {
                        // Create RemoteVM connection
                        const remoteVm = new RemoteVM(matchingSession.socketPath, matchingSession.id);
                        await remoteVm.connect();
                        targetVm = remoteVm;
                        vmName = matchingSession.label || matchingSession.id.substring(0, 8);
                        remoteVms.add(vmName);
                      } else {
                        // Pi-managed VM - try to find in global registry first
                        vmName = existingName || matchingSession.label?.split(":").slice(2).join(":") || matchingSession.id;
                        let found = false;
                        for (const [regName, { vm }] of globalThis.gondolinVmRegistry) {
                          if (vm.id === matchingSession.id) {
                            targetVm = vm;
                            vmName = regName;
                            vms.set(vmName, vm);
                            vmIds.set(vm.id, vmName);
                            found = true;
                            break;
                          }
                        }
                        
                        // If not in registry, try connecting as remote (fallback)
                        if (!found) {
                          try {
                            const remoteVm = new RemoteVM(matchingSession.socketPath, matchingSession.id);
                            await remoteVm.connect();
                            targetVm = remoteVm;
                            remoteVms.add(vmName);
                          } catch (err) {
                            ctx.ui.notify(`Failed to connect to VM: ${err}`, "error");
                            break;
                          }
                        }
                      }
                    }
                  }
                }
              }

              if (!targetVm) {
                ctx.ui.notify(`VM not found: ${vmIdOrName}`, "error");
                break;
              }

              // Execute the command
              const proc = targetVm.exec(command, { cwd: "/tmp" });

              // Collect output silently
              for await (const chunk of proc.output()) {
                // Consume output but don't notify each chunk
              }

              const result = await proc;

              // Display result in single notify call
              if (result.stdout) {
                ctx.ui.notify(result.stdout, "info");
              }
              
              if (result.exitCode !== 0) {
                if (result.stderr) {
                  ctx.ui.notify(result.stderr, "error");
                }
                ctx.ui.notify(`exit code: ${result.exitCode}`, "error");
              }
            } catch (err) {
              ctx.ui.notify(`Failed to execute command: ${err}`, "error");
            }
            break;
          }

          default:
            ctx.ui.notify("Usage: /gondolin {start <name> [--mount-skills] | stop [name-or-id|session|all] | list | attach [name-or-id] | detach | recreate [name] | gc | exec <vm-id-or-name> <command> | config {cwd|skills|auto-attach|guest-image|...}}", "info");
        }
      } catch (error) {
        ctx.ui.notify(`Error: ${error}`, "error");
      }
    },
  });
}
