# Filesystem Path Mapping and Isolation

When routing tools through isolated environments (VMs, sandboxes), you must map filesystem paths consistently. This reference covers the patterns for transparent host↔guest path translation.

## The Problem: Host Paths Leak Host Filesystem Info

When LLM-initiated bash runs in a VM but receives host paths:

```
Agent sees: /Users/alice/projects/my-app
↓
LLM generates: "edit /Users/alice/projects/my-app/src/main.ts"
↓
But guest doesn't know about /Users/alice/...
```

Also, exposing host paths to the LLM leaks:
- Home directory structure
- Project organization
- Sensitive path information

## Solution: Map to Guest Paths

Map host paths to a stable guest path namespace:

```typescript
const WORKSPACE = "/root/workspace";

function toGuestPath(localCwd: string, localPath: string): string {
  // Convert /Users/alice/projects/app → /root/workspace
  // Convert /Users/alice/projects/app/src/main.ts → /root/workspace/src/main.ts
  
  const rel = path.relative(localCwd, localPath);
  
  if (rel === "") {
    return WORKSPACE;
  }
  
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`path escapes workspace: ${localPath}`);
  }
  
  const posixRel = rel.split(path.sep).join(path.posix.sep);
  return path.posix.join(WORKSPACE, posixRel);
}
```

**Host path** → **Guest path** mapping:
```
/home/user/project/               → /root/workspace/
/home/user/project/src/main.ts    → /root/workspace/src/main.ts
/home/user/project/package.json   → /root/workspace/package.json
```

## Mount Points: Connect Host to Guest

When creating the VM, mount the host project directory to `/root/workspace`:

```typescript
import { VM, RealFSProvider } from "@earendil-works/gondolin";

const vm = await VM.create({
  vfs: {
    mounts: {
      "/root/workspace": new RealFSProvider(process.cwd())
      // Host: /home/user/project/
      //   ↓ (mounted as)
      // Guest: /root/workspace/
    }
  }
});
```

Now:
- Files in host `/home/user/project/src/` appear in guest `/root/workspace/src/`
- Guest has full read/write access (RealFSProvider)
- Host and guest see the same filesystem

## Hiding Host Paths from LLM

The LLM should never see host paths. Modify the system prompt before agent starts:

```typescript
pi.on("before_agent_start", (event, ctx) => {
  if (!attachedVm) return;
  
  const hostPath = process.cwd();
  const guestPath = "/root/workspace";
  
  // Replace host paths in system prompt
  if (event.messages.length > 0) {
    const content = event.messages[0].content;
    const updated = content.replace(hostPath, guestPath);
    event.messages[0].content = updated;
  }
});
```

**Result:** LLM sees:
```
Working in: /root/workspace
Files in: /root/workspace/src/, /root/workspace/lib/
```

Instead of:
```
Working in: /Users/alice/project
Files in: /Users/alice/project/src/, /Users/alice/project/lib/
```

## Pattern: Shell-Quoting Paths

When passing paths to shell commands, properly escape them:

```typescript
function shQuote(value: string): string {
  // Single-quote and escape internal single quotes
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

// Usage in shell command
const guestPath = "/root/workspace/my file.txt";
const cmd = `cat ${shQuote(guestPath)}`;
// Result: cat '/root/workspace/my file.txt'

// Compare to unsafe version:
const unsafeCmd = `cat ${guestPath}`;
// Result: cat /root/workspace/my file.txt  ← Breaks on spaces!
```

## Implementation: Path Mapping in Operations

Apply path mapping consistently across all operations:

### Read Operations

```typescript
function createVmReadOps(vm: VM, localCwd: string): ReadOperations {
  return {
    readFile: async (p: string) => {
      const guestPath = toGuestPath(localCwd, p);
      const result = await vm.exec(["/bin/cat", guestPath]);
      // ↑ Automatically uses guestPath, never reveals host path to LLM
      if (!result.ok) throw new Error(`Failed to read: ${p}`);
      return result.stdoutBuffer;
    },
    
    access: async (p: string) => {
      const guestPath = toGuestPath(localCwd, p);
      const result = await vm.exec([
        "/bin/sh", "-c",
        `test -r ${shQuote(guestPath)}`
      ]);
      if (!result.ok) throw new Error(`Not accessible: ${p}`);
    },
  };
}
```

### Write Operations

```typescript
function createVmWriteOps(vm: VM, localCwd: string): WriteOperations {
  return {
    writeFile: async (p: string, content: string) => {
      const guestPath = toGuestPath(localCwd, p);
      const dir = path.posix.dirname(guestPath);
      
      // Encode content in base64 for safe shell passing
      const b64 = Buffer.from(content, "utf8").toString("base64");
      const script = [
        "set -eu",
        `mkdir -p ${shQuote(dir)}`,
        `echo ${shQuote(b64)} | base64 -d > ${shQuote(guestPath)}`
      ].join("\n");
      
      const result = await vm.exec(["/bin/sh", "-lc", script]);
      if (!result.ok) throw new Error(`Failed to write: ${p}`);
    },
  };
}
```

### Bash Operations

```typescript
function createVmBashOps(vm: VM, localCwd: string): BashOperations {
  return {
    exec: async (command, cwd, { onData, signal, timeout, env: _env }) => {
      // Map cwd from host to guest
      const guestCwd = toGuestPath(localCwd, cwd);
      
      const proc = vm.exec(["/bin/bash", "-lc", command], {
        cwd: guestCwd,  // ← Automatically mapped
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
```

## Security: Preventing Path Escapes

Always validate that paths don't escape the workspace:

```typescript
function toGuestPath(localCwd: string, localPath: string): string {
  const rel = path.relative(localCwd, localPath);
  
  // Reject attempts to go outside workspace
  if (rel.startsWith("..")) {
    throw new Error(`path escapes workspace: ${localPath}`);
  }
  
  // Reject absolute paths (shouldn't happen in practice)
  if (path.isAbsolute(rel)) {
    throw new Error(`path is absolute outside workspace: ${localPath}`);
  }
  
  // At this point, rel is guaranteed to be within workspace
  const posixRel = rel.split(path.sep).join(path.posix.sep);
  return path.posix.join(WORKSPACE, posixRel);
}

// Examples of what gets rejected:
toGuestPath("/project", "/etc/passwd");  // ❌ throws
toGuestPath("/project", "/project/../../../etc");  // ❌ throws after normalization
toGuestPath("/project", "/sensitive/data");  // ❌ throws
```

## Pattern: Dynamic Workspace Mounting

If workspace path changes between reloads, update mounts:

```typescript
declare global {
  var currentVm: VM | null;
  var currentWorkspace: string;
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("attach-dir", {
    description: "Attach to VM with specific directory",
    handler: async (args, ctx) => {
      const targetDir = args || process.cwd();
      
      if (globalThis.currentVm && globalThis.currentWorkspace !== targetDir) {
        // Directory changed - need new mount
        await globalThis.currentVm.close();
        globalThis.currentVm = null;
      }
      
      if (!globalThis.currentVm) {
        globalThis.currentVm = await VM.create({
          vfs: {
            mounts: {
              "/root/workspace": new RealFSProvider(targetDir)
            }
          }
        });
        globalThis.currentWorkspace = targetDir;
      }
      
      ctx.ui.notify(`Attached to ${targetDir}`, "success");
    }
  });
}
```

## Testing Path Mapping

Create a test to verify mapping works correctly:

```typescript
function testPathMapping() {
  const localCwd = "/users/alice/project";
  
  // Test 1: Root maps to workspace
  assert(
    toGuestPath(localCwd, localCwd) === "/root/workspace",
    "Root should map to workspace"
  );
  
  // Test 2: File in subdirectory
  assert(
    toGuestPath(localCwd, "/users/alice/project/src/main.ts") === 
    "/root/workspace/src/main.ts",
    "File in subdirectory"
  );
  
  // Test 3: Reject paths above workspace
  assert(
    () => toGuestPath(localCwd, "/users/alice"),
    "Should reject parent directory"
  );
  
  // Test 4: Reject absolute paths outside workspace
  assert(
    () => toGuestPath(localCwd, "/etc/passwd"),
    "Should reject absolute paths outside workspace"
  );
  
  console.log("✅ All path mapping tests passed");
}
```

## VFS Providers: Choosing the Right Mount Type

Three options for mounting directories in guest:

### RealFSProvider (Read/Write)

```typescript
import { RealFSProvider } from "@earendil-works/gondolin";

// Guest can read AND write host files
"/root/workspace": new RealFSProvider("/home/user/project")
```

**Use when:** You want guest to modify files on host (most common for coding tasks).

### ReadonlyProvider (Read-Only)

```typescript
import { ReadonlyProvider } from "@earendil-works/gondolin";

// Guest can only read host files
"/root/libs": new ReadonlyProvider("/home/user/libs")
```

**Use when:** Guest should access libs but not modify them.

### MemoryProvider (Ephemeral)

```typescript
import { MemoryProvider } from "@earendil-works/gondolin";

// In-memory filesystem, not connected to host
"/tmp": new MemoryProvider()
```

**Use when:** Guest needs temporary storage that doesn't persist.

## Summary

**Path mapping key points:**
- Map all host paths to `/root/workspace` prefix in guest
- Use `path.relative()` to compute relative paths
- Validate to prevent path escapes (`..`)
- Mount with `RealFSProvider` to connect host/guest filesystems
- Hide host paths from LLM via system prompt modification
- Shell-quote paths properly in commands
- Test mapping to catch issues early
