# Tool Wrapping Patterns

This reference covers the detailed patterns for wrapping pi's four main tools (read, write, edit, bash) through custom backends.

## Core Principle: Register Once, Route at Runtime

```typescript
pi.registerTool({
  ...originalTool,  // Keep original metadata
  async execute(id, params, signal, onUpdate, ctx) {
    // Routing logic here - checked at EXECUTE time
    if (useBackend) {
      return createCustomTool(...).execute(...);
    }
    return originalTool.execute(...);
  },
});
```

**Why this works:**
- Tool names, descriptions, parameters are stable (pi caches these)
- Routing happens at runtime when state (like `attachedVm`) might have changed
- No conflicts with pi's caching mechanisms

## Wrapping Read Tool

Read tool provides `readFile()`, `access()`, and `detectImageMimeType()`.

### Creating Custom ReadOperations

```typescript
import type { ReadOperations } from "@mariozechner/pi-coding-agent";

function createVmReadOps(vm: VM, localCwd: string): ReadOperations {
  return {
    readFile: async (p: string) => {
      const guestPath = toGuestPath(localCwd, p);
      const result = await vm.exec(["/bin/cat", guestPath]);
      if (!result.ok) {
        throw new Error(`Failed to read: ${p}`);
      }
      return result.stdoutBuffer;
    },
    
    access: async (p: string) => {
      const guestPath = toGuestPath(localCwd, p);
      const result = await vm.exec([
        "/bin/sh", "-c",
        `test -r ${shQuote(guestPath)}`
      ]);
      if (!result.ok) {
        throw new Error(`Not accessible: ${p}`);
      }
    },
    
    detectImageMimeType: async (p: string) => {
      const guestPath = toGuestPath(localCwd, p);
      try {
        const result = await vm.exec([
          "/bin/sh", "-c",
          `file --mime-type -b ${shQuote(guestPath)}`
        ]);
        if (!result.ok) return null;
        
        const mime = result.stdout.trim();
        const supported = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        return supported.includes(mime) ? mime : null;
      } catch {
        return null;
      }
    },
  };
}
```

### Registering Custom Read Tool

```typescript
pi.registerTool({
  ...localRead,
  async execute(id, params, signal, onUpdate, ctx) {
    if (!attachedVm) {
      return localRead.execute(id, params, signal, onUpdate, ctx);
    }
    
    const tool = createReadTool(localCwd, {
      operations: createVmReadOps(attachedVm, localCwd),
    });
    return tool.execute(id, params, signal, onUpdate, ctx);
  },
});
```

## Wrapping Write Tool

Write tool provides `writeFile()` and `mkdir()`.

### Creating Custom WriteOperations

```typescript
import type { WriteOperations } from "@mariozechner/pi-coding-agent";

function createVmWriteOps(vm: VM, localCwd: string): WriteOperations {
  return {
    writeFile: async (p: string, content: string) => {
      const guestPath = toGuestPath(localCwd, p);
      const dir = path.posix.dirname(guestPath);
      
      // Use base64 to safely pass binary data through shell
      const b64 = Buffer.from(content, "utf8").toString("base64");
      const script = [
        "set -eu",
        `mkdir -p ${shQuote(dir)}`,
        `echo ${shQuote(b64)} | base64 -d > ${shQuote(guestPath)}`
      ].join("\n");
      
      const result = await vm.exec(["/bin/sh", "-lc", script]);
      if (!result.ok) {
        throw new Error(`Failed to write: ${p}`);
      }
    },
    
    mkdir: async (dir: string) => {
      const guestDir = toGuestPath(localCwd, dir);
      const result = await vm.exec(["/bin/mkdir", "-p", guestDir]);
      if (!result.ok) {
        throw new Error(`Failed to mkdir: ${dir}`);
      }
    },
  };
}
```

### Registering Custom Write Tool

```typescript
pi.registerTool({
  ...localWrite,
  async execute(id, params, signal, onUpdate, ctx) {
    if (!attachedVm) {
      return localWrite.execute(id, params, signal, onUpdate, ctx);
    }
    
    const tool = createWriteTool(localCwd, {
      operations: createVmWriteOps(attachedVm, localCwd),
    });
    return tool.execute(id, params, signal, onUpdate, ctx);
  },
});
```

## Wrapping Edit Tool

Edit tool provides file reading + writing for inline edits.

### Creating Custom EditOperations

```typescript
import type { EditOperations } from "@mariozechner/pi-coding-agent";

function createVmEditOps(vm: VM, localCwd: string): EditOperations {
  const r = createVmReadOps(vm, localCwd);
  const w = createVmWriteOps(vm, localCwd);
  
  return {
    readFile: r.readFile,
    access: r.access,
    writeFile: w.writeFile,
  };
}
```

### Registering Custom Edit Tool

```typescript
pi.registerTool({
  ...localEdit,
  async execute(id, params, signal, onUpdate, ctx) {
    if (!attachedVm) {
      return localEdit.execute(id, params, signal, onUpdate, ctx);
    }
    
    const tool = createEditTool(localCwd, {
      operations: createVmEditOps(attachedVm, localCwd),
    });
    return tool.execute(id, params, signal, onUpdate, ctx);
  },
});
```

## Wrapping Bash Tool

Bash tool provides `exec()` for running commands with streaming, timeouts, signals.

### Creating Custom BashOperations - Full Example

```typescript
import type { BashOperations } from "@mariozechner/pi-coding-agent";

function createVmBashOps(vm: VM, localCwd: string): BashOperations {
  return {
    exec: async (command, cwd, { onData, signal, timeout, env: _env }) => {
      // Path mapping: convert host cwd to guest cwd
      let guestCwd: string;
      try {
        guestCwd = toGuestPath(localCwd, cwd);
      } catch (e) {
        throw e;
      }

      // Setup abort controller for cancellation
      const ac = new AbortController();
      const onAbort = () => ac.abort();
      signal?.addEventListener("abort", onAbort, { once: true });

      // Setup timeout
      let timedOut = false;
      const timer =
        timeout && timeout > 0
          ? setTimeout(() => {
              timedOut = true;
              ac.abort();
            }, timeout * 1000)
          : undefined;

      try {
        // Execute in VM with mapped cwd
        // Note: We DON'T pass env parameter - use VM's environment set at creation
        const proc = vm.exec(["/bin/bash", "-lc", command], {
          cwd: guestCwd,
          signal: ac.signal,
          stdout: "pipe",
          stderr: "pipe",
        });

        // Stream output as it arrives
        for await (const chunk of proc.output()) {
          onData(chunk.data);
        }

        // Wait for completion
        const r = await proc;
        return { exitCode: r.exitCode };
      } catch (err) {
        // Check for abort/timeout before re-throwing
        if (signal?.aborted) throw new Error("aborted");
        if (timedOut) throw new Error(`timeout:${timeout}`);
        throw err;
      } finally {
        // Cleanup
        if (timer) clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
    },
  };
}
```

### Registering Custom Bash Tool

```typescript
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
```

### Intercepting User Bash Commands

To route user bash (`!` and `!!` prefix) through the same backend:

```typescript
pi.on("user_bash", (event, ctx) => {
  if (!attachedVm) return;
  
  // Return custom operations for this bash session
  return { operations: createVmBashOps(attachedVm, localCwd) };
});
```

## Path Mapping Utilities

Both read/write/edit tools need to convert host paths to guest paths. Create helper functions:

```typescript
const WORKSPACE = "/root/workspace";

function shQuote(value: string): string {
  // Shell-escape a value for safe passing to shell
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

function toGuestPath(localCwd: string, localPath: string): string {
  // Convert absolute host path to relative guest path
  const rel = path.relative(localCwd, localPath);
  
  if (rel === "") return WORKSPACE;
  
  // Prevent path escapes
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`path escapes workspace: ${localPath}`);
  }
  
  // Convert to POSIX for consistency in guest
  const posixRel = rel.split(path.sep).join(path.posix.sep);
  return path.posix.join(WORKSPACE, posixRel);
}
```

## Error Handling

Always check result codes:

```typescript
const result = await vm.exec(cmd);

if (!result.ok) {  // or if (result.exitCode !== 0)
  throw new Error(`Command failed (${result.exitCode}): ${result.stderr}`);
}
```

For optional operations, return null/undefined on error:

```typescript
detectImageMimeType: async (p: string) => {
  try {
    const result = await vm.exec([...]);
    if (!result.ok) return null;
    return result.stdout.trim();
  } catch {
    return null;  // Graceful fallback
  }
},
```

## Summary

**Key patterns:**
1. Create custom Operations objects (ReadOperations, WriteOperations, BashOperations)
2. Register tools at extension load with `...originalTool` spread
3. Route at execute time by checking state (`if (!attachedVm)`)
4. Map filesystem paths consistently (host → guest)
5. Handle streaming, timeouts, signals in bash
6. Don't pass host environment to isolated backends
