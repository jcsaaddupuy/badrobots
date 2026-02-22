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
import { VM, RealFSProvider, listSessions, findSession, VmCheckpoint } from "@earendil-works/gondolin";
import path from "node:path";

const PI_PREFIX = "pi:";
const SESSION_MARKER = "◆"; // Unicode marker for current session VMs
const WORKSPACE = "/root/workspace";

// Track VMs (name -> VM and id -> name mapping)
const vms = new Map<string, VM>();
const vmIds = new Map<string, string>(); // VM id -> name
let currentSessionId: string | undefined;

// Track attachment state
let attachedVm: VM | null = null;

function shQuote(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

function toGuestPath(localCwd: string, localPath: string): string {
  const rel = path.relative(localCwd, localPath);
  if (rel === "") return WORKSPACE;
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`path escapes workspace: ${localPath}`);
  }
  const posixRel = rel.split(path.sep).join(path.posix.sep);
  return path.posix.join(WORKSPACE, posixRel);
}

function createVmReadOps(vm: VM, localCwd: string): ReadOperations {
  return {
    readFile: async (p) => {
      const guestPath = toGuestPath(localCwd, p);
      const r = await vm.exec(["/bin/cat", guestPath]);
      if (!r.ok) throw new Error(`cat failed (${r.exitCode}): ${r.stderr}`);
      return r.stdoutBuffer;
    },
    access: async (p) => {
      const guestPath = toGuestPath(localCwd, p);
      const r = await vm.exec(["/bin/sh", "-lc", `test -r ${shQuote(guestPath)}`]);
      if (!r.ok) throw new Error(`not readable: ${p}`);
    },
    detectImageMimeType: async (p) => {
      const guestPath = toGuestPath(localCwd, p);
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

function createVmWriteOps(vm: VM, localCwd: string): WriteOperations {
  return {
    writeFile: async (p, content) => {
      const guestPath = toGuestPath(localCwd, p);
      const dir = path.posix.dirname(guestPath);
      const b64 = Buffer.from(content, "utf8").toString("base64");
      const script = [`set -eu`, `mkdir -p ${shQuote(dir)}`, `echo ${shQuote(b64)} | base64 -d > ${shQuote(guestPath)}`].join("\n");
      const r = await vm.exec(["/bin/sh", "-lc", script]);
      if (!r.ok) throw new Error(`write failed (${r.exitCode}): ${r.stderr}`);
    },
    mkdir: async (dir) => {
      const guestDir = toGuestPath(localCwd, dir);
      const r = await vm.exec(["/bin/mkdir", "-p", guestDir]);
      if (!r.ok) throw new Error(`mkdir failed (${r.exitCode}): ${r.stderr}`);
    },
  };
}

function createVmEditOps(vm: VM, localCwd: string): EditOperations {
  const r = createVmReadOps(vm, localCwd);
  const w = createVmWriteOps(vm, localCwd);
  return { readFile: r.readFile, access: r.access, writeFile: w.writeFile };
}

function sanitizeEnv(env?: NodeJS.ProcessEnv): Record<string, string> | undefined {
  if (!env) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function createVmBashOps(vm: VM, localCwd: string): BashOperations {
  return {
    exec: async (command, cwd, { onData, signal, timeout, env }) => {
      const guestCwd = toGuestPath(localCwd, cwd);
      console.error(`[gondolin] bash in VM: cwd=${cwd} -> ${guestCwd}, cmd=${command.substring(0, 50)}`);
      
      const ac = new AbortController();
      const onAbort = () => ac.abort();
      signal?.addEventListener("abort", onAbort, { once: true });

      let timedOut = false;
      const timer =
        timeout && timeout > 0
          ? setTimeout(() => {
              timedOut = true;
              ac.abort();
            }, timeout * 1000)
          : undefined;

      try {
        const proc = vm.exec(["/bin/bash", "-lc", command], {
          cwd: guestCwd,
          signal: ac.signal,
          env: sanitizeEnv(env),
          stdout: "pipe",
          stderr: "pipe",
        });

        for await (const chunk of proc.output()) {
          onData(chunk.data);
        }

        const r = await proc;
        return { exitCode: r.exitCode };
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

  // Create original tool definitions
  const localRead = createReadTool(localCwd);
  const localWrite = createWriteTool(localCwd);
  const localEdit = createEditTool(localCwd);
  const localBash = createBashTool(localCwd);

  // Register tools at extension load time with decision logic inside execute
  pi.registerTool({
    ...localRead,
    async execute(id, params, signal, onUpdate, ctx) {
      console.error(`[gondolin] read tool called, attachedVm=${attachedVm ? "YES" : "NO"}`);
      if (!attachedVm) {
        return localRead.execute(id, params, signal, onUpdate, ctx);
      }
      const tool = createReadTool(localCwd, {
        operations: createVmReadOps(attachedVm, localCwd),
      });
      return tool.execute(id, params, signal, onUpdate);
    },
  });

  pi.registerTool({
    ...localWrite,
    async execute(id, params, signal, onUpdate, ctx) {
      console.error(`[gondolin] write tool called, attachedVm=${attachedVm ? "YES" : "NO"}`);
      if (!attachedVm) {
        return localWrite.execute(id, params, signal, onUpdate, ctx);
      }
      const tool = createWriteTool(localCwd, {
        operations: createVmWriteOps(attachedVm, localCwd),
      });
      return tool.execute(id, params, signal, onUpdate);
    },
  });

  pi.registerTool({
    ...localEdit,
    async execute(id, params, signal, onUpdate, ctx) {
      console.error(`[gondolin] edit tool called, attachedVm=${attachedVm ? "YES" : "NO"}`);
      if (!attachedVm) {
        return localEdit.execute(id, params, signal, onUpdate, ctx);
      }
      const tool = createEditTool(localCwd, {
        operations: createVmEditOps(attachedVm, localCwd),
      });
      return tool.execute(id, params, signal, onUpdate);
    },
  });

  pi.registerTool({
    ...localBash,
    async execute(id, params, signal, onUpdate, ctx) {
      console.error(`[gondolin] bash tool called, attachedVm=${attachedVm ? "YES" : "NO"}`);
      if (!attachedVm) {
        return localBash.execute(id, params, signal, onUpdate, ctx);
      }
      const tool = createBashTool(localCwd, {
        operations: createVmBashOps(attachedVm, localCwd),
      });
      return tool.execute(id, params, signal, onUpdate);
    },
  });

  // Intercept user bash commands (! and !!) to route through VM if attached
  pi.on("user_bash", (_event, ctx) => {
    if (!attachedVm) return;
    console.error(`[gondolin] user_bash intercepted, routing to VM`);
    return { operations: createVmBashOps(attachedVm, localCwd) };
  });

  // Hide host path from LLM when attached to VM
  pi.on("before_agent_start", async (event, ctx) => {
    if (!attachedVm) return;
    
    // Replace host path with VM workspace path in system prompt
    // Completely hide the host path from the LLM
    let modified = event.systemPrompt.replace(
      `Current working directory: ${localCwd}`,
      `Current working directory: ${WORKSPACE}`
    );
    
    console.error(`[gondolin] system prompt modified: hiding host path, showing VM path`);
    return { systemPrompt: modified };
  });

  pi.registerCommand("gondolin", {
    description: "Manage Gondolin VMs (start <name> | stop <name-or-id> | list | attach [name-or-id] | detach | snapshot <name> | restore <snapshot> | snapshots)",
    async handler(args, ctx) {
      // Capture current session ID on first command
      if (!currentSessionId) {
        const sessionFile = ctx.sessionManager.getSessionFile();
        if (sessionFile) {
          const filename = sessionFile.split("/").pop() || "ephemeral";
          currentSessionId = filename.replace(".json", "");
        } else {
          currentSessionId = "ephemeral";
        }
      }

      const [cmd, ...restArgs] = args.trim().split(/\s+/);
      const name = restArgs[0];

      try {
        switch (cmd) {
          case "start": {
            if (!name) {
              ctx.ui.notify("Usage: /gondolin start <name>", "warning");
              return;
            }

            if (vms.has(name)) {
              ctx.ui.notify(`VM already exists: ${name}`, "warning");
              return;
            }

            ctx.ui.notify(`Starting ${name}...`, "info");

            const sessionLabel = `${PI_PREFIX}${currentSessionId || "ephemeral"}:${name}`;

            const vm = await VM.create({
              sessionLabel,
              vfs: {
                mounts: {
                  [WORKSPACE]: new RealFSProvider(localCwd),
                },
              },
            });

            await vm.exec("echo 'VM started'", { cwd: WORKSPACE });

            vms.set(name, vm);
            vmIds.set(vm.id, name);
            ctx.ui.notify(`Started: ${name}\nID: ${vm.id}\nRun '/gondolin list' to see it`, "success");
            break;
          }

          case "stop": {
            if (!name) {
              ctx.ui.notify("Usage: /gondolin stop <name-or-id>", "warning");
              return;
            }

            const session = await findSession(name);
            if (!session) {
              ctx.ui.notify(`VM not found: ${name}`, "error");
              return;
            }

            const vmName = vmIds.get(session.id);
            if (vmName && vms.has(vmName)) {
              try {
                const vm = vms.get(vmName);
                if (vm) {
                  await vm.close();
                }
              } catch {}
              vms.delete(vmName);
              vmIds.delete(session.id);
            } else {
              try {
                process.kill(session.pid, 'SIGTERM');
              } catch {}
            }

            ctx.ui.notify(`Stopped: ${session.label || session.id.substring(0, 8)}`, "success");
            break;
          }

          case "attach": {
            if (attachedVm) {
              ctx.ui.notify("Already attached. Run '/gondolin detach' first", "warning");
              return;
            }

            let vmToAttach: VM | null = null;
            let vmName = "unknown";
            let foundSession: any = null;

            if (name) {
              if (vms.has(name)) {
                vmToAttach = vms.get(name) || null;
                vmName = name;
              } else {
                const session = await findSession(name);
                if (session) {
                  foundSession = session;
                  if (vmIds.has(session.id)) {
                    vmName = vmIds.get(session.id) || "unknown";
                    vmToAttach = vms.get(vmName) || null;
                  } else {
                    vmName = name;
                  }
                }
              }
            } else {
              const sessions = await listSessions();
              const currentVMs = sessions.filter(s => {
                const label = s.label || "";
                if (!label.startsWith(PI_PREFIX)) return false;
                const parts = label.split(":");
                return parts[1] === (currentSessionId || "ephemeral");
              });

              if (currentVMs.length === 0) {
                ctx.ui.notify("No VMs found in current session", "warning");
                return;
              }

              if (currentVMs.length > 1) {
                ctx.ui.notify("Multiple VMs found. Specify one: /gondolin attach <name-or-id>", "warning");
                return;
              }

              foundSession = currentVMs[0];
              vmName = vmIds.get(foundSession.id) || "unknown";
              vmToAttach = vms.get(vmName) || null;
            }

            if (foundSession && !foundSession.alive) {
              ctx.ui.notify(`VM '${vmName}' is dead. Start or restart it first: /gondolin start ${vmName}`, "error");
              return;
            }

            if (!vmToAttach) {
              ctx.ui.notify(`VM not found: ${name || "default"}\nStart one: /gondolin start <name>`, "error");
              return;
            }

            // Attach the VM
            attachedVm = vmToAttach;
            console.error(`[gondolin] ATTACHED to VM: ${vmName}`);

            ctx.ui.notify(`Attached to VM: ${vmName}\nAll tools (read, write, edit, bash) now route through the VM`, "success");
            break;
          }

          case "detach": {
            if (!attachedVm) {
              ctx.ui.notify("Not attached to any VM", "warning");
              return;
            }

            // Detach
            attachedVm = null;
            console.error(`[gondolin] DETACHED from VM`);

            ctx.ui.notify("Detached from VM. Tools restored to host", "success");
            break;
          }

          case "snapshot": {
            ctx.ui.notify("snapshot/restore not supported yet", "warning");
            break;
          }

          case "restore": {
            ctx.ui.notify("snapshot/restore not supported yet", "warning");
            break;
          }

          case "snapshots": {
            ctx.ui.notify("snapshot/restore not supported yet", "warning");
          }

          case "list": {
            const sessions = await listSessions();

            if (sessions.length === 0) {
              ctx.ui.notify("No running VMs", "info");
              return;
            }

            const daemonVmIds = new Set(sessions.map(s => s.id));
            for (const [id, vmName] of vmIds.entries()) {
              if (!daemonVmIds.has(id)) {
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
              const isPiVM = label.startsWith(PI_PREFIX);

              if (isPiVM) {
                const parts = label.split(":");
                const vmSessionId = parts[1];
                const displayName = parts.slice(2).join(":") || "unknown";
                const isCurrentSession = vmSessionId === (currentSessionId || "ephemeral");
                const marker = isCurrentSession ? ` ${SESSION_MARKER}` : "";
                const isAttached = attachedVm && vmIds.get(s.id) === vmIds.get(attachedVm.id) ? ` ${bright}[attached]${reset}` : "";

                const shortId = s.id.substring(0, 8);
                const line = `    ${status} ${displayName}${marker}${isAttached} ${dim}[${shortId}]${reset} (${age}s ago)`;
                piVMs.push(line);
              } else {
                const displayName = label;
                const shortId = s.id.substring(0, 8);
                const line = `    ${status} ${displayName} ${dim}[${shortId}]${reset} (${age}s ago)`;
                hostVMs.push(line);
              }
            });

            const output: string[] = [];
            output.push(`${yellow}[Gondolin]${reset}`);

            if (piVMs.length > 0) {
              output.push(`  ${blue}pi vm:${reset}`);
              piVMs.forEach(vm => output.push(vm));
            }

            if (hostVMs.length > 0) {
              output.push(`  ${blue}host vm:${reset}`);
              hostVMs.forEach(vm => output.push(vm));
            }

            ctx.ui.notify(output.join("\n"), "info");
            break;
          }

          default:
            ctx.ui.notify("Usage: /gondolin {start <name> | stop <name-or-id> | list | attach [name-or-id] | detach | snapshot <vm-name> | restore <snapshot-name> | snapshots}", "info");
        }
      } catch (error) {
        ctx.ui.notify(`Error: ${error}`, "error");
      }
    },
  });

  pi.on("session_shutdown", async () => {
    try {
      const sessions = await listSessions();

      const currentSessionVMs = sessions.filter(s => {
        const label = s.label || "";
        if (!label.startsWith(PI_PREFIX)) {
          return false;
        }

        const parts = label.split(":");
        const vmSessionId = parts[1];
        return vmSessionId === (currentSessionId || "ephemeral");
      });

      for (const session of currentSessionVMs) {
        try {
          process.kill(session.pid, 'SIGTERM');
        } catch {}
      }

      vms.clear();
      vmIds.clear();
      attachedVm = null;
    } catch (error) {
      // Suppress errors during shutdown
    }
  });
}
