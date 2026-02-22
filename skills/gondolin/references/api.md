# Gondolin API Reference

## VM Class

### VM.create(options?)

Create and boot a new VM instance.

**Parameters:**
- `options.httpHooks` - Network policy from createHttpHooks()
- `options.env` - Environment variables object
- `options.vfs` - Virtual filesystem configuration
- `options.sandbox` - Sandbox options

**Returns:** Promise\<VM\>

**Example:**
```javascript
const vm = await VM.create({
  httpHooks,
  env: { VAR: "value" },
  vfs: { mounts: { "/data": new MemoryProvider() } },
  sandbox: { rootOverlay: true }
});
```

### vm.exec(command, options?)

Execute a command in the VM.

**Parameters:**
- `command` - String (runs via shell) or Array (direct execution)
- `options.stdin` - Boolean, enable stdin writing
- `options.stdout` - "pipe" to enable streaming
- `options.stderr` - "pipe" to enable streaming
- `options.pty` - Boolean, allocate pseudo-terminal
- `options.env` - Additional environment variables
- `options.cwd` - Working directory

**Returns:** Promise\<ExecResult\> | ExecProcess

**Example:**
```javascript
// Simple
const result = await vm.exec("echo hello");

// Streaming
const proc = vm.exec("long-command", { stdout: "pipe" });
for await (const chunk of proc) {
  console.log(chunk);
}
```

### vm.shell(options?)

Start an interactive shell session.

**Parameters:**
- `options.command` - Shell command array (default: ["/bin/bash", "-i"])
- `options.attach` - Boolean, auto-attach to terminal (default: true if TTY)
- `options.env` - Environment variables
- `options.cwd` - Working directory
- `options.signal` - AbortSignal for cancellation

**Returns:** ExecProcess

**Example:**
```javascript
const shell = vm.shell({ attach: false });
shell.write('cd /tmp\n');
shell.write('exit\n');
for await (const chunk of shell) {
  console.log(chunk);
}
```

### vm.close()

Shutdown and clean up the VM.

**Returns:** Promise\<void\>

**Example:**
```javascript
await vm.close();
```

### vm.ssh()

Get SSH connection information for running VM.

**Returns:** Promise\<{port: number, host: string}\>

**Example:**
```javascript
const { port } = await vm.ssh();
console.log(`ssh -p ${port} root@localhost`);
```

## Network API

### createHttpHooks(config)

Create network policy configuration.

**Parameters:**
- `config.allowedHosts` - Array of allowed hostnames
- `config.secrets` - Object mapping secret names to configurations
  - `secrets[name].hosts` - Array of hosts that can access this secret
  - `secrets[name].value` - Secret value (string)

**Returns:** { httpHooks, env }

**Example:**
```javascript
const { httpHooks, env } = createHttpHooks({
  allowedHosts: ["api.github.com", "registry.npmjs.org"],
  secrets: {
    GITHUB_TOKEN: {
      hosts: ["api.github.com"],
      value: process.env.GITHUB_TOKEN
    },
    NPM_TOKEN: {
      hosts: ["registry.npmjs.org"],
      value: process.env.NPM_TOKEN
    }
  }
});
```

## VFS (Virtual Filesystem) API

### MemoryProvider()

In-memory filesystem provider (fast, ephemeral).

**Example:**
```javascript
const vm = await VM.create({
  vfs: {
    mounts: {
      "/workspace": new MemoryProvider()
    }
  }
});
```

### RealFSProvider(hostPath)

Mount a host directory into the guest.

**Parameters:**
- `hostPath` - Path on host filesystem

**Example:**
```javascript
const vm = await VM.create({
  vfs: {
    mounts: {
      "/project": new RealFSProvider("./my-project")
    }
  }
});
```

### ReadonlyProvider(hostPath)

Mount a host directory as read-only.

**Parameters:**
- `hostPath` - Path on host filesystem

**Example:**
```javascript
const vm = await VM.create({
  vfs: {
    mounts: {
      "/src": new ReadonlyProvider("./source-code")
    }
  }
});
```

## ExecProcess

Returned by `vm.exec()` and `vm.shell()`.

### Methods

- `write(data: string)` - Write to stdin
- `end()` - Close stdin
- `attach()` - Attach to current terminal
- `[Symbol.asyncIterator]()` - Stream output

### Properties

- `PromiseLike<ExecResult>` - Await for final result

**Example:**
```javascript
const proc = vm.exec(["cat"], { stdin: true, stdout: "pipe" });
proc.write("hello\n");
proc.end();

for await (const chunk of proc) {
  console.log(chunk);
}

const result = await proc;
console.log(result.exitCode);
```

## ExecResult

Result of command execution.

### Properties

- `exitCode: number` - Exit code (0 = success)
- `stdout: string` - Standard output
- `stderr: string` - Standard error

**Example:**
```javascript
const result = await vm.exec("echo hello");
console.log(result.exitCode);  // 0
console.log(result.stdout);    // "hello\n"
console.log(result.stderr);    // ""
```

## Build API

### gondolin build

Build custom guest images.

**CLI:**
```bash
gondolin build --config build-config.json --output ./assets
```

**Build Config:**
```json
{
  "arch": "aarch64",
  "distro": "alpine",
  "alpine": {
    "version": "3.23.0",
    "kernelPackage": "linux-virt",
    "kernelImage": "vmlinuz-virt",
    "rootfsPackages": ["nodejs", "npm", "python3"],
    "initramfsPackages": []
  },
  "rootfs": {
    "label": "gondolin-root"
  }
}
```

**Architecture values:**
- `"aarch64"` - ARM64 (Apple Silicon, ARM servers)
- `"x86_64"` - Intel/AMD 64-bit

## Sandbox Options

### rootOverlay

Enable writable root filesystem (using tmpfs overlay).

**Type:** Boolean

**Example:**
```javascript
const vm = await VM.create({
  sandbox: { rootOverlay: true }
});

// Now can install packages
await vm.exec("apk add nodejs");
```

**Note:** Changes lost when VM closes.

### imagePath

Use custom guest image.

**Type:** String (path to assets directory)

**Example:**
```javascript
const vm = await VM.create({
  sandbox: { imagePath: "./custom-assets" }
});
```

**Or use environment variable:**
```bash
export GONDOLIN_GUEST_DIR=./custom-assets
node script.mjs
```

### debug

Enable debug logging.

**Type:** Array\<string\> or "*"

**Example:**
```javascript
const vm = await VM.create({
  sandbox: {
    debug: ["*"],  // All components
    // Or specific: ["sandbox", "network", "vfs"]
  }
});
```

### debugLog

Custom debug log handler.

**Type:** (component: string, message: string) => void

**Example:**
```javascript
const vm = await VM.create({
  sandbox: {
    debug: ["*"],
    debugLog: (component, msg) => {
      console.log(`[${component}]`, msg);
    }
  }
});
```

## Environment Variables

### GONDOLIN_GUEST_DIR

Override guest image location.

**Example:**
```bash
export GONDOLIN_GUEST_DIR=./custom-assets
node script.mjs
```

### NODE_PATH

Override Node.js module resolution path.

**Example:**
```bash
export NODE_PATH=/opt/homebrew/lib/node_modules
node script.mjs
```

## Error Handling

### Common Errors

**Guest image not found:**
```
Error: Guest image not found at: /path/to/assets
```
**Solution:** Build image or let it auto-download

**QEMU not found:**
```
Error: QEMU not found in PATH
```
**Solution:** Install QEMU (`brew install qemu` or `apt install qemu-system-*`)

**Network access denied:**
```
Error: Network access denied for host: example.com
```
**Solution:** Add to `allowedHosts` in `createHttpHooks()`

**Module not found:**
```
Error: Cannot find module '@earendil-works/gondolin'
```
**Solution:** `npm install -g @earendil-works/gondolin`

### Error Handling Pattern

```javascript
const vm = await VM.create();
try {
  const result = await vm.exec("command");
  if (result.exitCode !== 0) {
    throw new Error(`Command failed: ${result.stderr}`);
  }
} catch (error) {
  console.error("VM error:", error);
} finally {
  await vm.close();
}
```

## Performance Notes

### VM Boot Time
- First run with download: ~5s
- Cached image: ~1s
- Custom image: ~1s

### Hardware Acceleration
- macOS: HVF (automatic)
- Linux: KVM (automatic if available)
- Fallback: TCG (slow, software emulation)

### Guest Image Cache
- Location: `~/.cache/gondolin/`
- Size: ~200MB per version
- Automatic cleanup: No (manual)

### Optimization Tips

1. **Reuse VMs:**
   ```javascript
   const vm = await VM.create();
   await vm.exec("cmd1");
   await vm.exec("cmd2");  // Faster than creating new VM
   await vm.close();
   ```

2. **Use custom images for production:**
   - Build once: ~5 minutes
   - Boot time: ~1s
   - No runtime installation overhead

3. **Stream large outputs:**
   ```javascript
   const proc = vm.exec(cmd, { stdout: "pipe" });
   for await (const chunk of proc) {
     // Process incrementally
   }
   ```

4. **Cache guest images in CI/CD:**
   ```yaml
   cache:
     paths:
       - ~/.cache/gondolin/
   ```
