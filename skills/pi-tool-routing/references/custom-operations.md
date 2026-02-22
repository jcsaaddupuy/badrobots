# Custom Operations Objects

This reference covers creating custom Operations objects (ReadOperations, WriteOperations, EditOperations, BashOperations) for use with pi's tool factories.

## Overview

Each tool factory (`createReadTool`, `createWriteTool`, `createEditTool`, `createBashTool`) accepts an optional `operations` parameter:

```typescript
const customTool = createBashTool(localCwd, {
  operations: customBashOps  // ← Your custom implementation
});
```

The custom operations replace the default local filesystem operations with your custom logic (VM, sandbox, remote, etc.).

## Operations Interfaces

### ReadOperations

```typescript
interface ReadOperations {
  readFile(path: string): Promise<Buffer>;
  access(path: string): Promise<void>;
  detectImageMimeType(path: string): Promise<string | null>;
}
```

**Responsibilities:**
- `readFile()` - Read file content as binary buffer
- `access()` - Check if path is readable (throw on not readable)
- `detectImageMimeType()` - Detect MIME type of images (return null if not image)

### WriteOperations

```typescript
interface WriteOperations {
  writeFile(path: string, content: string): Promise<void>;
  mkdir(dir: string): Promise<void>;
}
```

**Responsibilities:**
- `writeFile()` - Write string content to file (create if missing)
- `mkdir()` - Create directory recursively

### EditOperations

```typescript
interface EditOperations {
  readFile(path: string): Promise<Buffer>;
  access(path: string): Promise<void>;
  writeFile(path: string, content: string): Promise<void>;
}
```

**Responsibilities:** Subset of read + write (for in-place edits).

### BashOperations

```typescript
interface BashOperations {
  exec(
    command: string,
    cwd: string,
    options: {
      onData: (chunk: Uint8Array) => void;
      signal?: AbortSignal;
      timeout?: number;
      env?: Record<string, string>;
    }
  ): Promise<{ exitCode: number }>;
}
```

**Responsibilities:**
- Execute shell commands
- Stream output via `onData` callback
- Support abort signals for cancellation
- Support timeout
- Return exit code

## Implementation Pattern: Error Handling

Always handle errors appropriately:

### Read Operations - Throw on Failure

```typescript
readFile: async (p: string) => {
  try {
    const result = await vm.exec(["/bin/cat", p]);
    if (!result.ok) {
      throw new Error(`read failed (${result.exitCode}): ${result.stderr}`);
    }
    return result.stdoutBuffer;
  } catch (err) {
    throw new Error(`Failed to read ${p}: ${err}`);
  }
}
```

### Write Operations - Throw on Failure

```typescript
writeFile: async (p: string, content: string) => {
  try {
    const b64 = Buffer.from(content, "utf8").toString("base64");
    const cmd = `echo ${shQuote(b64)} | base64 -d > ${shQuote(p)}`;
    const result = await vm.exec(["/bin/sh", "-c", cmd]);
    
    if (!result.ok) {
      throw new Error(`write failed (${result.exitCode}): ${result.stderr}`);
    }
  } catch (err) {
    throw new Error(`Failed to write ${p}: ${err}`);
  }
}
```

### Access Check - Throw on Not Accessible

```typescript
access: async (p: string) => {
  try {
    const result = await vm.exec(["/bin/sh", "-c", `test -r ${shQuote(p)}`]);
    if (!result.ok) {
      throw new Error(`not readable: ${p}`);
    }
  } catch (err) {
    throw new Error(`access check failed for ${p}: ${err}`);
  }
}
```

### Mime Type Detection - Return null on Failure

```typescript
detectImageMimeType: async (p: string) => {
  try {
    const result = await vm.exec([
      "/bin/sh", "-c",
      `file --mime-type -b ${shQuote(p)}`
    ]);
    
    if (!result.ok) return null;
    
    const mime = result.stdout.trim();
    const imageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    return imageTypes.includes(mime) ? mime : null;
  } catch {
    return null;  // Graceful fallback
  }
}
```

## Bash Operations: Streaming and Signals

Bash operations must handle streaming properly:

```typescript
exec: async (command, cwd, { onData, signal, timeout, env }) => {
  // 1. Create abort controller for cancellation
  const ac = new AbortController();
  const onAbort = () => ac.abort();
  signal?.addEventListener("abort", onAbort, { once: true });

  // 2. Setup timeout
  let timedOut = false;
  const timer =
    timeout && timeout > 0
      ? setTimeout(() => {
          timedOut = true;
          ac.abort();
        }, timeout * 1000)
      : undefined;

  try {
    // 3. Start process
    const proc = vm.exec(cmd, {
      cwd,
      signal: ac.signal,
      stdout: "pipe",
      stderr: "pipe",
    });

    // 4. Stream output as it arrives
    for await (const chunk of proc.output()) {
      onData(chunk.data);  // ← Required for live streaming
    }

    // 5. Wait for completion
    const r = await proc;
    return { exitCode: r.exitCode };
  } catch (err) {
    // 6. Handle abort/timeout specially
    if (signal?.aborted) throw new Error("aborted");
    if (timedOut) throw new Error(`timeout:${timeout}`);
    throw err;
  } finally {
    // 7. Cleanup
    if (timer) clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
```

## Common Patterns

### Pattern 1: Composition (Edit from Read + Write)

```typescript
function createEditOps(vm: VM, cwd: string): EditOperations {
  const read = createReadOps(vm, cwd);
  const write = createWriteOps(vm, cwd);
  
  return {
    readFile: read.readFile,
    access: read.access,
    writeFile: write.writeFile,
    // ↑ No separate mkdir - edit uses writeFile
  };
}
```

### Pattern 2: Caching (Optional)

```typescript
const fileCache = new Map<string, Buffer>();

function createCachedReadOps(vm: VM, cwd: string): ReadOperations {
  const baseOps = createReadOps(vm, cwd);
  
  return {
    readFile: async (p: string) => {
      if (fileCache.has(p)) {
        return fileCache.get(p)!;
      }
      
      const content = await baseOps.readFile(p);
      fileCache.set(p, content);
      return content;
    },
    access: baseOps.access,
    detectImageMimeType: baseOps.detectImageMimeType,
  };
}
```

### Pattern 3: Logging

```typescript
function createLoggingOps(vm: VM, cwd: string): BashOperations {
  const baseOps = createBashOps(vm, cwd);
  
  return {
    exec: async (command, cwd, options) => {
      const startTime = Date.now();
      console.log(`[BASH] ${command} @ ${cwd}`);
      
      try {
        const result = await baseOps.exec(command, cwd, options);
        const duration = Date.now() - startTime;
        console.log(`[BASH] ✓ exit ${result.exitCode} (${duration}ms)`);
        return result;
      } catch (err) {
        console.log(`[BASH] ✗ error: ${err}`);
        throw err;
      }
    },
  };
}
```

## Testing Operations

Test custom operations independently:

```typescript
async function testBashOps(ops: BashOperations) {
  // Test 1: Simple command
  const result1 = await ops.exec("echo hello", "/root/workspace", {
    onData: () => {},
  });
  assert(result1.exitCode === 0);
  
  // Test 2: Capture output
  const chunks: Uint8Array[] = [];
  const result2 = await ops.exec("echo world", "/root/workspace", {
    onData: (chunk) => chunks.push(chunk),
  });
  const output = Buffer.concat(chunks).toString();
  assert(output.includes("world"));
  
  // Test 3: Failed command
  const result3 = await ops.exec("exit 42", "/root/workspace", {
    onData: () => {},
  });
  assert(result3.exitCode === 42);
  
  // Test 4: Timeout
  try {
    await ops.exec("sleep 10", "/root/workspace", {
      onData: () => {},
      timeout: 0.1,  // 100ms
    });
    throw new Error("Should have timed out");
  } catch (err) {
    assert(err.message.includes("timeout"));
  }
  
  console.log("✅ All bash ops tests passed");
}
```

## Pitfalls

### ❌ Don't modify parameters

```typescript
// Wrong: Modifying passed objects
async execute(id, params, signal, onUpdate, ctx) {
  params.command = "modified";  // ❌ Don't modify
  ...
}
```

### ❌ Don't forget error handling in streaming

```typescript
// Wrong: Unhandled error in stream loop
for await (const chunk of proc.output()) {  // ❌ No try/catch
  onData(chunk.data);
}
```

### ❌ Don't ignore timeout cleanup

```typescript
// Wrong: Timeout not cleaned up
const timer = setTimeout(() => { ... }, timeout);
// Missing: finally { clearTimeout(timer); }
```

### ❌ Don't assume env vars exist

```typescript
// Wrong: Assumes PATH is set
const result = await vm.exec(["npm", "test"]);

// Right: Explicitly set env
const result = await vm.exec(["npm", "test"], {
  env: { PATH: "/usr/local/bin:/usr/bin:/bin" }
});
```

## Summary

**Key patterns:**
- ReadOperations: readFile → Buffer, access → void, detectImageMimeType → mime
- WriteOperations: writeFile → void, mkdir → void  
- EditOperations: Compose from read + write
- BashOperations: Handle streaming, signals, timeouts carefully
- Error handling: Throw on read/write failures, return null on optional operations
- Test independently before integrating with tools

**Remember:**
- Stream output via onData callback
- Handle abort signals and timeouts
- Don't modify parameters
- Clean up resources in finally blocks
- Return exit codes faithfully for bash
