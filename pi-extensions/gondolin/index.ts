import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { VM, RealFSProvider, listSessions, findSession, VmCheckpoint } from "@earendil-works/gondolin";

const PI_PREFIX = "pi:";
const SESSION_MARKER = "◆"; // Unicode marker for current session VMs

// Track VMs (name -> VM and id -> name mapping)
const vms = new Map<string, VM>();
const vmIds = new Map<string, string>(); // VM id -> name
let currentSessionId: string | undefined;


export default function (pi: ExtensionAPI) {
  pi.registerCommand("gondolin", {
    description: "Manage Gondolin VMs (start <name> | stop <name-or-id> | list | snapshot <name> | restore <snapshot> | snapshots)",
    async handler(args, ctx) {
      // Capture current session ID on first command (extract UUID only)
      if (!currentSessionId) {
        const sessionFile = ctx.sessionManager.getSessionFile();
        if (sessionFile) {
          // Extract UUID from path: /path/to/uuid.json -> uuid
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

            const cwd = process.cwd();
            const sessionLabel = `${PI_PREFIX}${currentSessionId || "ephemeral"}:${name}`;

            const vm = await VM.create({
              sessionLabel,
              vfs: {
                mounts: {
                  "/root/workspace": new RealFSProvider(cwd),
                },
              },
            });

            // Execute initialization commands
            // 1. Ensure VM fully starts and registers
            await vm.exec("echo 'VM started'", { cwd: "/root/workspace" });

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

            // Always query daemon first via findSession()
            const session = await findSession(name);
            if (!session) {
              ctx.ui.notify(`VM not found: ${name}`, "error");
              return;
            }

            // Try to close via local reference if we have it
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
              // VM not in our registry, kill the process directly
              try {
                process.kill(session.pid, 'SIGTERM');
              } catch {}
            }

            ctx.ui.notify(`Stopped: ${session.label || session.id.substring(0, 8)}`, "success");
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

            // Clean up local Map: remove VMs that no longer exist in daemon
            const daemonVmIds = new Set(sessions.map(s => s.id));
            for (const [id, name] of vmIds.entries()) {
              if (!daemonVmIds.has(id)) {
                vmIds.delete(id);
                vms.delete(name);
              }
            }

            // ANSI color codes
            const yellow = "\x1b[93m";  // Yellow for [Gondolin] prefix
            const blue = "\x1b[94m";    // Blue for subsection labels
            const reset = "\x1b[0m";
            const dim = "\x1b[2m";

            // Separate Pi and Host VMs
            const piVMs: string[] = [];
            const hostVMs: string[] = [];

            sessions.forEach(s => {
              const age = Math.floor((Date.now() - new Date(s.createdAt).getTime()) / 1000);
              const status = s.alive ? "✓" : "✗";
              
              const label = s.label || s.id.substring(0, 8);
              const isPiVM = label.startsWith(PI_PREFIX);
              
              if (isPiVM) {
                // Parse label: "pi:sessionId:name"
                const parts = label.split(":");
                const vmSessionId = parts[1];  // Second part is session ID
                const displayName = parts.slice(2).join(":") || "unknown";  // Everything after sessionId
                const isCurrentSession = vmSessionId === (currentSessionId || "ephemeral");
                const marker = isCurrentSession ? ` ${SESSION_MARKER}` : "";
                
                const shortId = s.id.substring(0, 8);
                const line = `    ${status} ${displayName}${marker} ${dim}[${shortId}]${reset} (${age}s ago)`;
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
            ctx.ui.notify("Usage: /gondolin {start <name> | stop <name-or-id> | list | snapshot <vm-name> | restore <snapshot-name> | snapshots}", "info");
        }
      } catch (error) {
        ctx.ui.notify(`Error: ${error}`, "error");
      }
    },
  });

  // Cleanup on shutdown - only destroy VMs from current session
  pi.on("session_shutdown", async () => {
    try {
      // Query daemon to find all VMs
      const sessions = await listSessions();
      
      // Find only VMs from current session
      const currentSessionVMs = sessions.filter(s => {
        const label = s.label || "";
        if (!label.startsWith(PI_PREFIX)) {
          return false; // Only Pi VMs
        }
        
        // Parse label: "pi:sessionId:name"
        const parts = label.split(":");
        const vmSessionId = parts[1];
        return vmSessionId === (currentSessionId || "ephemeral");
      });

      // Destroy current session VMs via daemon (process kill)
      for (const session of currentSessionVMs) {
        try {
          process.kill(session.pid, 'SIGTERM');
        } catch {}
      }

      // Clean up local references
      vms.clear();
      vmIds.clear();
    } catch (error) {
      // Suppress errors during shutdown
    }
  });
}
