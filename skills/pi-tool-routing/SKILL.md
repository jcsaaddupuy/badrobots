---
name: pi-tool-routing
description: "Route pi tools through custom backends (VMs, sandboxes) with state persistence"
---

# Pi Tool Routing and State Persistence

Building pi extensions that wrap or route tools requires patterns that don't appear in the basic extension documentation. This skill covers the advanced patterns needed to:

- **Route tools through custom backends** (VMs, sandboxes, proxies, remote systems)
- **Persist extension state across `/reload`** without losing long-lived resources
- **Map filesystems** between host and isolated environments
- **Handle environment variables** safely without leaking host configuration
- **Intercept both agent and user bash commands** consistently

## Core Concepts

### Why Route Tools?

When you want to route pi's built-in tools (read, write, edit, bash) through a custom backend, you're doing **tool wrapping**. Common scenarios:

| Scenario | Backend | Benefit |
|----------|---------|---------|
| Secure code execution | Gondolin VM | Isolation from host filesystem/network |
| OS-level sandboxing | bubblewrap/sandbox-exec | Restrict file and network access |
| Remote execution | SSH/Docker | Run on remote machines |
| Permission gates | Custom logic | Confirm destructive operations |
| Filesystem isolation | Virtual mounts | Hide host paths from LLM |

### Why Persist State Across `/reload`?

By default, `/reload` destroys all extension state. For long-lived resources (VMs, SSH connections, database pools), you need **cross-reload persistence**:

- **Problem**: Each `/reload` creates a new extension instance; local variables are lost
- **Solution**: Store references in `globalThis` (JavaScript global scope) which survives reloads
- **Trade-off**: State persists until the pi process exits; explicit cleanup needed

### Key Pattern: Register Once, Route at Runtime

The foundation of tool routing is this pattern:

```typescript
// Register ONCE at extension load time
pi.registerTool({
  ...localBash,  // Spread the original tool's metadata
  async execute(id, params, signal, onUpdate, ctx) {
    // Route DYNAMICALLY at execute time
    if (!attachedVm) {
      return localBash.execute(id, params, signal, onUpdate, ctx);
    }
    // Use custom operations
    const customTool = createBashTool(localCwd, {
      operations: createVmBashOps(attachedVm, localCwd),
    });
    return customTool.execute(id, params, signal, onUpdate, ctx);
  },
});
```

**Why this works:**
- Tool metadata is stable (name, description, parameters)
- Routing decision happens at runtime (when `attachedVm` might have changed)
- No pi caching issues (pi caches tool metadata, not execution logic)

## Quick Start: Route Bash Through Gondolin VM

Here's a minimal example wrapping bash commands through a Gondolin VM:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createBashTool, type BashOperations } from "@mariozechner/pi-coding-agent";
import { VM } from "@earendil-works/gondolin";

let attachedVm: VM | null = null;

function createVmBashOps(vm: VM, localCwd: string): BashOperations {
  return {
    exec: async (command, cwd, { onData, signal, timeout, env: _env }) => {
      // Don't pass host env - rely on VM's env set at creation
      const proc = vm.exec(["/bin/bash", "-lc", command], {
        cwd,
        signal,
        stdout: "pipe",
        stderr: "pipe",
      });

      for await (const chunk of proc.output()) {
        onData(chunk.data);
      }

      const r = await proc;
      return { exitCode: r.exitCode };
    },
  };
}

export default function (pi: ExtensionAPI) {
  const localCwd = process.cwd();
  const localBash = createBashTool(localCwd);

  pi.registerTool({
    ...localBash,
    async execute(id, params, signal, onUpdate, ctx) {
      if (!attachedVm) {
        return localBash.execute(id, params, signal, onUpdate, ctx);
      }
      const tool = createBashTool(localCwd, {
        operations: createVmBashOps(attachedVm, localCwd),
      });
      return tool.execute(id, params, signal, onUpdate, ctx);
    },
  });

  pi.registerCommand("attach", {
    description: "Attach to VM",
    handler: async (args, ctx) => {
      attachedVm = await VM.create();
      ctx.ui.notify("Attached to VM", "success");
    },
  });

  pi.registerCommand("detach", {
    description: "Detach from VM",
    handler: async (_args, ctx) => {
      if (attachedVm) {
        await attachedVm.close();
      }
      attachedVm = null;
      ctx.ui.notify("Detached from VM", "info");
    },
  });

  pi.on("session_shutdown", async () => {
    if (attachedVm) {
      await attachedVm.close();
    }
    attachedVm = null;
  });
}
```

## Detailed Patterns

See linked references for comprehensive coverage:

- **[Tool Wrapping Patterns](references/tool-wrapping.md)** - Register once/route at runtime, wrapping all four tools (read, write, edit, bash), handling streaming and errors
- **[State Persistence](references/state-persistence.md)** - Using `globalThis` for cross-reload persistence, loading state on startup, cleanup on shutdown
- **[Custom Operations](references/custom-operations.md)** - Creating ReadOperations, WriteOperations, EditOperations, BashOperations for isolation
- **[Filesystem Path Mapping](references/path-mapping.md)** - Mapping host paths to guest paths, hiding host filesystem from LLM

## Common Scenarios

### Scenario 1: Route bash through Gondolin VM

**Goal**: Run bash commands in isolated VM  
**Pattern**: Register once, route at execute time via `attachedVm`  
**Key files**: See [tool-wrapping.md](references/tool-wrapping.md#wrapping-bash)

**Gotcha**: Don't pass host environment variables to VM; Gondolin handles network mediation:
```typescript
// ❌ WRONG: Passes host proxy vars
const proc = vm.exec(cmd, { env: process.env });

// ✅ RIGHT: Let VM's env at creation time handle everything
const proc = vm.exec(cmd);  // No env parameter
```

### Scenario 2: Hide host filesystem from LLM

**Goal**: LLM sees `/root/workspace` instead of host path  
**Pattern**: Modify system prompt before agent starts  
**Implementation**:
```typescript
pi.on("before_agent_start", (event, ctx) => {
  if (!attachedVm) return;
  
  const hostPath = process.cwd();
  const guestPath = "/root/workspace";
  
  event.messages[0].content = event.messages[0].content.replace(
    hostPath,
    guestPath
  );
});
```

### Scenario 3: Persist VMs across `/reload`

**Goal**: VMs stay alive when user runs `/reload`  
**Pattern**: Store VM references in `globalThis`, reload on startup  
**Implementation**: See [state-persistence.md](references/state-persistence.md#persisting-long-lived-resources)

### Scenario 4: Intercept user bash (`!` commands)

**Goal**: Route `! curl` and `!! npm test` through VM  
**Pattern**: Handle `user_bash` event, return custom operations  
**Implementation**:
```typescript
pi.on("user_bash", (event, ctx) => {
  if (!attachedVm) return;
  return { operations: createVmBashOps(attachedVm, localCwd) };
});
```

## Best Practices

### ✅ DO

1. **Register tools at extension load time** - Tool metadata must be stable
2. **Make routing decisions at execute time** - Check `attachedVm` when tool runs
3. **Store long-lived resources in globalThis** - So they survive `/reload`
4. **Load from globalThis on startup** - Restore references in `session_start`
5. **Clean up on shutdown** - Close resources in `session_shutdown`
6. **Use descriptive environment** - Set VM env explicitly; don't assume host env applies
7. **Map filesystem paths** - Convert host paths to guest paths for isolation
8. **Handle streams properly** - Use `for await (const chunk of proc.output())`

### ❌ DON'T

1. **Don't register tools at command runtime** - Tools must be stable for pi caching
2. **Don't leak host proxy variables to VMs** - Let Gondolin handle network mediation
3. **Don't close resources in session_start** - Only detach; preserve for next reload
4. **Don't assume host env in isolated environments** - Explicitly configure VM env
5. **Don't ignore exit codes** - Always check `result.exitCode`
6. **Don't forget to spread `...originalTool`** - Metadata is needed for routing to work
7. **Don't mix local and VM paths without mapping** - Always convert paths consistently

## Debugging

### Tool routing not working

**Symptom**: Tool always uses local operations, never routes to VM  
**Check**: Is `attachedVm` being set? Log in execute:
```typescript
console.error(`[DEBUG] attachedVm=${attachedVm ? "yes" : "no"}`);
```

### State lost after `/reload`

**Symptom**: VMs closed, attachment cleared after `/reload`  
**Check**: Are you storing in `globalThis`? Register should only add to global registry:
```typescript
globalThis.vmRegistry = globalThis.vmRegistry || new Map();
globalThis.vmRegistry.set(name, vm);  // Survives reload
```

### Environment variables not available in VM

**Symptom**: `$PATH` or `$HOME` empty in VM commands  
**Check**: Did you pass env to `vm.create()`? Set explicitly:
```typescript
const vm = await VM.create({
  env: {
    PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    HOME: "/root",
  }
});
```

### Host proxy breaking Gondolin network

**Symptom**: VM curl fails with "Connection reset by peer"  
**Root cause**: Host `HTTP_PROXY` passed to VM confuses Gondolin's httpHooks  
**Fix**: Don't pass proxy vars to VM:
```typescript
// ❌ WRONG
vm.exec(cmd, { env: process.env });  // Includes HTTP_PROXY

// ✅ RIGHT - Empty env, let Gondolin handle
vm.exec(cmd);  // No env parameter
```

## Related Skills

- **gondolin** - Micro-VMs for secure code execution
- **pi (extensions.md)** - Extension fundamentals (events, UI, commands)
- **general** - Python/Node coding practices

## Summary

**Register once, route at runtime**: Tools are registered with stable metadata at extension load time. Routing decisions (local vs custom backend) happen at execute time by checking state variables like `attachedVm`.

**Persist state in globalThis**: Long-lived resources (VMs, connections) survive `/reload` by storing in JavaScript's global scope. Load from global registry on startup, cleanup on shutdown.

**Map filesystems explicitly**: When using isolated environments, convert host paths to guest paths consistently to hide host filesystem from LLM and prevent escapes.

**Handle environment carefully**: Don't assume host environment applies to isolated backends; configure VM/sandbox environment explicitly. Filter out proxy variables to prevent conflicts with network mediation layers.
