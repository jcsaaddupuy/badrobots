# State Persistence Across `/reload`

By default, `/reload` destroys all extension state. This reference covers patterns for persisting long-lived resources (VMs, connections, pools) across reloads.

## The Problem: Default Behavior

```typescript
export default function (pi: ExtensionAPI) {
  const vms = new Map<string, VM>();  // ❌ Lost on /reload
  let attachedVm: VM | null = null;    // ❌ Lost on /reload
  
  pi.registerCommand("attach", {
    handler: async () => {
      // After /reload, vms.size === 0 - old VMs lost!
      attachedVm = await VM.create();
      vms.set("vm1", attachedVm);
    }
  });
}
```

Each `/reload`:
1. Extension code is reloaded
2. Local variables reset to initial values
3. Previous VMs are orphaned (still running, but unreachable)
4. Next time you forget they exist

## The Solution: globalThis

JavaScript's `globalThis` object persists across module reloads. Store long-lived resources there:

```typescript
// At module level (outside default function)
declare global {
  var vmRegistry: Map<string, { name: string; vm: VM }>;
}

if (!globalThis.vmRegistry) {
  globalThis.vmRegistry = new Map();
}

export default function (pi: ExtensionAPI) {
  const vms = new Map<string, VM>();
  
  // LOAD from global registry on startup
  for (const [vmName, { vm }] of globalThis.vmRegistry) {
    vms.set(vmName, vm);
  }
  
  // SAVE to global registry when creating
  pi.registerCommand("start", {
    handler: async (args, ctx) => {
      const vm = await VM.create();
      vms.set(args, vm);
      
      // Also save to persistent registry
      globalThis.vmRegistry.set(args, { name: args, vm });
      ctx.ui.notify("Started: " + args, "success");
    }
  });
}
```

After `/reload`:
1. Code reloads
2. `globalThis.vmRegistry` still exists (unchanged)
3. Extension reloads VMs from registry into local `vms` map
4. Existing VMs are re-connected ✅

## Pattern: Three-Tier State

Use three tiers for robust state management:

```typescript
// Tier 1: TypeScript declaration (type safety)
declare global {
  var vmRegistry: Map<string, { name: string; vm: VM }>;
  var connectionPool: Record<string, Connection>;
}

// Tier 2: Initialization (create if missing)
if (!globalThis.vmRegistry) {
  globalThis.vmRegistry = new Map();
}
if (!globalThis.connectionPool) {
  globalThis.connectionPool = {};
}

export default function (pi: ExtensionAPI) {
  // Tier 3: Local references (load from global on startup)
  const vms = new Map<string, VM>();
  const connections: Record<string, Connection> = {};
  
  // On startup, load from global
  pi.on("session_start", async (_event, ctx) => {
    for (const [name, { vm }] of globalThis.vmRegistry) {
      vms.set(name, vm);
    }
    for (const [id, conn] of Object.entries(globalThis.connectionPool)) {
      connections[id] = conn;
    }
    
    ctx.ui.notify(
      `Loaded ${vms.size} VM(s) and ${Object.keys(connections).length} connection(s)`,
      "info"
    );
  });
  
  // On shutdown, DON'T close - just clear local references
  pi.on("session_shutdown", async () => {
    // Clear local maps only
    vms.clear();
    Object.keys(connections).forEach(k => delete connections[k]);
    
    // Resources stay in globalThis for next reload
  });
}
```

## Lifecycle: Create → Use → Reload → Use → Stop

```
User: /gondolin start myvm
  ↓
  VM created in globalThis.vmRegistry
  vms.set("myvm", vm)
  
User: /gondolin attach myvm
  ↓
  attachedVm = vms.get("myvm")
  
User: ! curl ...
  ↓
  Routed through attachedVm
  
User: /reload (or code changes)
  ↓
  session_shutdown: vms.clear() [local only]
  globalThis.vmRegistry unchanged ← IMPORTANT
  
Code reloads...
  ↓
  session_start: for (const vm of globalThis.vmRegistry) vms.set(...)
  
User: /gondolin list
  ↓
  Shows myvm (still running!) ✅
  
User: /gondolin attach myvm
  ↓
  attachedVm = vms.get("myvm")
  
User: /gondolin stop myvm
  ↓
  await vm.close()
  vms.delete("myvm")
  globalThis.vmRegistry.delete("myvm") ← NOW it's gone
```

## Pattern: Commands for State Inspection

Add commands to inspect and manage persistent state:

```typescript
pi.registerCommand("list", {
  description: "List all VMs (including from previous reloads)",
  handler: async (_args, ctx) => {
    const vms = Array.from(globalThis.vmRegistry.entries());
    
    if (vms.length === 0) {
      ctx.ui.notify("No VMs registered", "info");
      return;
    }
    
    const lines = vms.map(([name, { vm }]) => {
      const attached = vm === attachedVm ? " ◆" : "";
      return `  ${name} (${vm.id.substring(0, 8)})${attached}`;
    });
    
    ctx.ui.notify("Registered VMs:\n" + lines.join("\n"), "info");
  }
});

pi.registerCommand("cleanup", {
  description: "Close all VMs and clear registry",
  handler: async (_args, ctx) => {
    for (const [name, { vm }] of globalThis.vmRegistry) {
      try {
        await vm.close();
      } catch (err) {
        console.error(`Error closing ${name}:`, err);
      }
    }
    
    globalThis.vmRegistry.clear();
    attachedVm = null;
    
    ctx.ui.notify("Cleaned up all VMs", "success");
  }
});
```

## Pattern: Guarding Against Data Loss

Warn users before destructive operations:

```typescript
pi.on("session_before_switch", async (event, ctx) => {
  // When switching to a new session
  if (globalThis.vmRegistry.size > 0) {
    const ok = await ctx.ui.confirm(
      "VMs exist",
      `${globalThis.vmRegistry.size} VM(s) will be detached. Continue?`
    );
    if (!ok) return { cancel: true };
  }
});

pi.registerCommand("new-session", {
  description: "Create new session with cleanup",
  handler: async (_args, ctx) => {
    // Explicitly close all VMs before new session
    for (const [name, { vm }] of globalThis.vmRegistry) {
      try {
        await vm.close();
      } catch {
        // Ignore errors
      }
    }
    globalThis.vmRegistry.clear();
    
    // Now safe to start fresh
    ctx.ui.notify("Cleaned VMs, starting new session", "info");
  }
});
```

## Pattern: Detect Resource Leaks

Track resource lifecycle to catch orphaned resources:

```typescript
// Global resource tracker
declare global {
  var resourceLog: Array<{ resource: string; action: string; timestamp: number }>;
}

if (!globalThis.resourceLog) {
  globalThis.resourceLog = [];
}

function logResource(resource: string, action: "create" | "close" | "reload") {
  globalThis.resourceLog.push({
    resource,
    action,
    timestamp: Date.now(),
  });
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("resources", {
    description: "Show resource lifecycle",
    handler: async (_args, ctx) => {
      const lines = globalThis.resourceLog
        .slice(-10)
        .map(
          (r) =>
            `  [${new Date(r.timestamp).toLocaleTimeString()}] ${r.resource}: ${r.action}`
        );
      ctx.ui.notify("Recent resources:\n" + lines.join("\n"), "info");
    },
  });

  pi.registerCommand("start", {
    handler: async (args, ctx) => {
      const vm = await VM.create();
      logResource(args, "create");  // ← Track creation
      
      globalThis.vmRegistry.set(args, { name: args, vm });
      ctx.ui.notify(`Started: ${args}`, "success");
    },
  });

  pi.on("session_shutdown", async () => {
    // Track that we're reloading while keeping VMs
    for (const [name] of globalThis.vmRegistry) {
      logResource(name, "reload");
    }
  });
}
```

## Anti-Pattern: Don't Recreate Resources on Reload

❌ **BAD**: Closing and recreating on every reload

```typescript
pi.on("session_shutdown", async () => {
  // ❌ WRONG: Destroys resources user might need
  for (const vm of vms.values()) {
    await vm.close();
  }
  vms.clear();
});
```

✅ **GOOD**: Just detach and clear local references

```typescript
pi.on("session_shutdown", async () => {
  // ✅ RIGHT: Resources stay running in globalThis
  if (attachedVm) {
    attachedVm = null;  // Detach
  }
  vms.clear();  // Clear local refs only
});
```

## Summary

**Three-tier pattern:**
1. **Global TypeScript declarations** - Type safety via `declare global`
2. **Global initialization** - Create if missing via `if (!globalThis.registry)`
3. **Local references** - Load from global in `session_start`

**Lifecycle:**
- Create: Store in global registry
- Use: Access from local references
- Reload: Clear local refs (globals unchanged)
- Reuse: Load from global registry automatically
- Stop: Remove from global registry

**Benefits:**
- VMs survive `/reload` automatically
- No orphaned resources
- Clean separation: global (persistent) vs local (per-session)
- Commands can inspect and manage resources
- Users see consistent state across reloads
