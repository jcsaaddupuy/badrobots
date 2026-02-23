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

const vms = new Map<string, VM>();
const vmIds = new Map<string, string>();
let currentSessionId: string | undefined;
let attachedVm: VM | null = null;
let lastContext: any = null;

function updateStatusBar() {
  if (!lastContext) return;
  
  if (!attachedVm) {
    lastContext.ui.setStatus("gondolin", undefined);
  } else {
    const vmName = vmIds.get(attachedVm.id) || "unknown";
    const theme = lastContext.ui.theme;
    const indicator = theme.fg("accent", "▶");
    const status = theme.fg("dim", ` Sandbox: ${vmName}`);
    lastContext.ui.setStatus("gondolin", indicator + status);
  }
}

function shQuote(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

function isVmInCurrentSession(sessionLabel: string, currentSessionId: string): boolean {
  return sessionLabel.startsWith(PI_PREFIX) && sessionLabel.split(":")[1] === currentSessionId;
}

function cleanupVm(vmName: string, vmId: string): void {
  vms.delete(vmName);
  vmIds.delete(vmId);
  globalThis.gondolinVmRegistry.delete(vmName);
  if (attachedVm && vmIds.get(attachedVm.id) === vmName) {
    attachedVm = null;
    updateStatusBar();
  }
}

function toGuestPathWithExceptions(localCwd: string, localPath: string, exceptions?: string[]): string {
  if (exceptions?.length) {
    try {
      const canonicalPath = fs.realpathSync(localPath);
      for (const exceptionPath of getCanonicalSkillPaths()) {
        if (canonicalPath === exceptionPath || canonicalPath.startsWith(exceptionPath + path.sep)) {
          return localPath;
        }
      }
    } catch {
      // Fall through to regular validation
    }
  }
  
  const rel = path.relative(localCwd, localPath);
  if (rel === "") return WORKSPACE;
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`path escapes workspace: ${localPath}`);
  }
  const posixRel = rel.split(path.sep).join(path.posix.sep);
  return path.posix.join(WORKSPACE, posixRel);
}

function createVmReadOps(vm: VM, localCwd: string, exceptions?: string[]): ReadOperations {
  return {
    readFile: async (p) => {
      const guestPath = toGuestPathWithExceptions(localCwd, p, exceptions);
      const r = await vm.exec(["/bin/cat", guestPath]);
      if (!r.ok) throw new Error(`cat failed (${r.exitCode}): ${r.stderr}`);
      return r.stdoutBuffer;
    },
    access: async (p) => {
      const guestPath = toGuestPathWithExceptions(localCwd, p, exceptions);
      const r = await vm.exec(["/bin/sh", "-lc", `test -r ${shQuote(guestPath)}`]);
      if (!r.ok) throw new Error(`not readable: ${p}`);
    },
    detectImageMimeType: async (p) => {
      const guestPath = toGuestPathWithExceptions(localCwd, p, exceptions);
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

function createVmWriteOps(vm: VM, localCwd: string, exceptions?: string[]): WriteOperations {
  return {
    writeFile: async (p, content) => {
      const guestPath = toGuestPathWithExceptions(localCwd, p, exceptions);
      const dir = path.posix.dirname(guestPath);
      const b64 = Buffer.from(content, "utf8").toString("base64");
      const script = [`set -eu`, `mkdir -p ${shQuote(dir)}`, `echo ${shQuote(b64)} | base64 -d > ${shQuote(guestPath)}`].join("\n");
      const r = await vm.exec(["/bin/sh", "-lc", script]);
      if (!r.ok) throw new Error(`write failed (${r.exitCode}): ${r.stderr}`);
    },
    mkdir: async (dir) => {
      const guestDir = toGuestPathWithExceptions(localCwd, dir, exceptions);
      const r = await vm.exec(["/bin/mkdir", "-p", guestDir]);
      if (!r.ok) throw new Error(`mkdir failed (${r.exitCode}): ${r.stderr}`);
    },
  };
}

function createVmEditOps(vm: VM, localCwd: string, exceptions?: string[]): EditOperations {
  const r = createVmReadOps(vm, localCwd, exceptions);
  const w = createVmWriteOps(vm, localCwd, exceptions);
  return { readFile: r.readFile, access: r.access, writeFile: w.writeFile };
}

function createVmBashOps(vm: VM, localCwd: string, exceptions?: string[]): BashOperations {
  return {
    exec: async (command, cwd, { onData, signal, timeout, env: _env }) => {
      let guestCwd: string;
      try {
        guestCwd = toGuestPathWithExceptions(localCwd, cwd, exceptions);
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
      const exceptions = vmSkillExceptions.get(vmName);
      switch (type) {
        case "read":
          return createReadTool(localCwd, { operations: createVmReadOps(attachedVm, localCwd, exceptions) })
            .execute(id, params, signal, onUpdate, ctx);
        case "write":
          return createWriteTool(localCwd, { operations: createVmWriteOps(attachedVm, localCwd, exceptions) })
            .execute(id, params, signal, onUpdate, ctx);
        case "edit":
          return createEditTool(localCwd, { operations: createVmEditOps(attachedVm, localCwd, exceptions) })
            .execute(id, params, signal, onUpdate, ctx);
        case "bash":
          return createBashTool(localCwd, { operations: createVmBashOps(attachedVm, localCwd, exceptions) })
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
    const exceptions = vmSkillExceptions.get(vmName);
    return { operations: createVmBashOps(attachedVm, localCwd, exceptions) };
  });

  pi.on("before_agent_start", (event, ctx) => {
    if (!attachedVm) return;
    return { systemPrompt: event.systemPrompt.replace(`Current working directory: ${localCwd}`, `Current working directory: ${WORKSPACE}`) };
  });

  pi.registerCommand("gondolin", {
    description: "Manage Gondolin VMs (start [name] [--mount-skills] | stop [name-or-id|session|all] | list | attach [name-or-id] | detach | gc)",
    async handler(args, ctx) {
      if (!currentSessionId) {
        const sessionFile = ctx.sessionManager.getSessionFile();
        const filename = sessionFile?.split("/").pop() || "ephemeral";
        currentSessionId = filename.replace(".json", "");
      }

      const [cmd, ...restArgs] = args.trim().split(/\s+/);
      const mountSkills = restArgs.includes("--mount-skills");
      const name = restArgs.find(arg => !arg.startsWith("-")) || "default";

      try {
        switch (cmd) {
          case "start": {
            if (vms.has(name)) {
              ctx.ui.notify(`VM already exists: ${name}`, "warning");
              return;
            }

            ctx.ui.notify(`Starting ${name}...`, "info");
            const sessionLabel = `${PI_PREFIX}${currentSessionId}:${name}`;
            const { httpHooks } = createHttpHooks({ allowedHosts: ["*"] });

            const vmCreateOptions: any = {
              sessionLabel,
              httpHooks,
              env: {},
              vfs: { mounts: { [WORKSPACE]: new RealFSProvider(localCwd) } },
            };

            if (mountSkills) {
              try {
                const skills = await discoverSkills();
                const homeDir = process.env.HOME || "/root";
                const skillsBaseDir = path.join(homeDir, ".pi/agent/skills");
                vmCreateOptions.vfs.mounts["/root/.pi/agent/skills"] = new ReadonlyProvider(new RealFSProvider(skillsBaseDir));
                ctx.ui.notify(`Mounting ${skills.length} skills read-only`, "info");
              } catch (err) {
                ctx.ui.notify(`Error mounting skills: ${err}`, "error");
                return;
              }
            }

            if (process.env.GONDOLIN_GUEST_DIR) {
              vmCreateOptions.sandbox = { imagePath: process.env.GONDOLIN_GUEST_DIR };
            }

            const vm = await VM.create(vmCreateOptions);
            await vm.exec("echo 'VM started'", { cwd: WORKSPACE });

            vms.set(name, vm);
            vmIds.set(vm.id, name);
            if (mountSkills) {
              vmSkillExceptions.set(name, getSkillPaths());
            }
            globalThis.gondolinVmRegistry.set(name, { name, vm });

            ctx.ui.notify(`Started: ${name}\nID: ${vm.id}`, "success");
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

            if (vms.has(name)) {
              attachedVm = vms.get(name)!;
              updateStatusBar();
              ctx.ui.notify(`Attached to: ${name}`, "success");
              return;
            }

            const session = await findSession(name);
            if (session) {
              const sessionLabel = session.label || "";
              if (!isVmInCurrentSession(sessionLabel, currentSessionId || "ephemeral")) {
                ctx.ui.notify(`VM in different session. Use ID: /gondolin attach ${session.id}`, "error");
                return;
              }
              const vmName = vmIds.get(session.id);
              if (vmName && vms.has(vmName)) {
                attachedVm = vms.get(vmName)!;
                updateStatusBar();
                ctx.ui.notify(`Attached to: ${vmName}`, "success");
                return;
              }
            }

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
            attachedVm = null;
            updateStatusBar();
            ctx.ui.notify("Detached", "success");
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
                const shortId = s.id.substring(0, 8);
                hostVMs.push(`    ${status} ${label} ${dim}[${shortId}]${reset} (${age}s)`);
              }
            });

            const output = [`${yellow}[Gondolin]${reset}`];
            if (piVMs.length) output.push(`  ${blue}pi vm:${reset}`, ...piVMs);
            if (hostVMs.length) output.push(`  ${blue}host vm:${reset}`, ...hostVMs);
            ctx.ui.notify(output.join("\n"), "info");
            break;
          }

          default:
            ctx.ui.notify("Usage: /gondolin {start <name> [--mount-skills] | stop [name-or-id|session|all] | list | attach [name] | detach | gc}", "info");
        }
      } catch (error) {
        ctx.ui.notify(`Error: ${error}`, "error");
      }
    },
  });
}
