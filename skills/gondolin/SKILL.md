---
name: gondolin
description: Create isolated micro-VMs for secure code execution using Gondolin. Use for running untrusted code, package installation sandboxing, testing in clean environments, or cross-platform builds. Supports network policy, virtual filesystems, secret injection, and custom guest images.
---

# Gondolin - Secure Micro-VM Sandboxing

Run untrusted code, install packages, or execute commands in isolated Linux micro-VMs with full control over network, filesystem, and environment.

## Quick Start

### Basic VM

```javascript
import { VM } from "@earendil-works/gondolin";

const vm = await VM.create();
const result = await vm.exec("echo 'Hello from isolated VM'");
console.log(result.stdout);
await vm.close();
```

### Interactive Session (Best for Automation)

```javascript
const shell = vm.shell({ attach: false });
shell.write('cd /tmp\n');
shell.write('npm install lodash\n');
shell.write('node -e "console.log(require(\\"lodash\\").VERSION)"\n');
shell.write('exit\n');

for await (const chunk of shell) {
  process.stdout.write(chunk);
}
```

## Core Concepts

### Why Gondolin?

**Use Cases:**
- Run untrusted code safely
- Test package installations without polluting host
- Cross-platform builds (Alpine Linux guest)
- Network sandboxing with policy enforcement
- Ephemeral environments for CI/CD

**Key Features:**
- **Isolation:** Full Linux VM with QEMU
- **Speed:** Micro-VM boots in ~1s
- **Control:** Network policy, VFS, secret injection
- **Portable:** Same API on macOS, Linux, Docker

### VM Lifecycle

```
VM.create() → vm.exec() / vm.shell() → vm.close()
     ↓              ↓                      ↓
   Boot VM    Run commands            Destroy VM
```

**Important:** Always call `vm.close()` to free resources.

## Installation

### Global Install (Recommended)

```bash
# Install Gondolin
npm install -g @earendil-works/gondolin

# Install QEMU (required)
# macOS
brew install qemu

# Linux (Debian/Ubuntu)
sudo apt install qemu-system-x86-64 qemu-system-aarch64
```

### Portable Import Helper

Create `gondolin-import.mjs` for cross-environment compatibility:

```javascript
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

function getGlobalNodeModules() {
  // 1. Check NODE_PATH
  if (process.env.NODE_PATH) {
    const paths = process.env.NODE_PATH.split(':');
    for (const p of paths) {
      if (p && existsSync(p)) return p;
    }
  }
  
  // 2. Try npm root -g
  try {
    return execSync('npm root -g', { encoding: 'utf-8' }).trim();
  } catch {}
  
  // 3. Platform defaults
  return process.platform === 'darwin' 
    ? '/opt/homebrew/lib/node_modules'
    : '/usr/local/lib/node_modules';
}

const gondolinPath = join(
  getGlobalNodeModules(),
  '@earendil-works/gondolin/dist/src/index.js'
);

if (!existsSync(gondolinPath)) {
  throw new Error('Gondolin not found. Install: npm install -g @earendil-works/gondolin');
}

export const { VM, createHttpHooks, MemoryProvider, RealFSProvider } = 
  await import(`file://${gondolinPath}`);
```

Then use: `import { VM } from "./gondolin-import.mjs";`

## Common Patterns

### Pattern 1: Simple Command Execution

```javascript
import { VM } from "@earendil-works/gondolin";

const vm = await VM.create();

// Single command
const result = await vm.exec("uname -a");
console.log(result.stdout);
console.log(result.exitCode); // 0 = success

// Array syntax (no shell)
const result2 = await vm.exec(["python3", "-c", "print('Hello')"]);

await vm.close();
```

### Pattern 2: Interactive Shell (No TTY Required)

```javascript
const vm = await VM.create();
const shell = vm.shell({ attach: false });

// Send commands
shell.write('cd /tmp\n');
shell.write('mkdir workspace\n');
shell.write('echo "test" > file.txt\n');
shell.write('cat file.txt\n');
shell.write('exit\n');

// Stream output
for await (const chunk of shell) {
  process.stdout.write(chunk);
}

await vm.close();
```

### Pattern 3: Install Packages at Runtime

```javascript
const vm = await VM.create({
  sandbox: {
    rootOverlay: true  // Enable writable root filesystem
  }
});

const shell = vm.shell({ attach: false });
shell.write('apk update\n');
shell.write('apk add nodejs npm\n');
shell.write('node --version\n');
shell.write('exit\n');

for await (const chunk of shell) {
  process.stdout.write(chunk);
}

await vm.close();
```

**Note:** Changes are NOT persistent (lost when VM closes).

### Pattern 4: Network Policy with Secrets

```javascript
import { VM, createHttpHooks } from "@earendil-works/gondolin";

const { httpHooks, env } = createHttpHooks({
  allowedHosts: ["api.github.com"],
  secrets: {
    GITHUB_TOKEN: {
      hosts: ["api.github.com"],
      value: process.env.GITHUB_TOKEN
    }
  }
});

const vm = await VM.create({ httpHooks, env });

// Secret is injected only for allowed hosts
const result = await vm.exec(
  'curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user'
);

await vm.close();
```

**Security:** Secrets are never visible to guest, only injected by host.

### Pattern 4b: Accessing Internal/Private IPs

**Problem:** By default, Gondolin blocks requests to private IP ranges (10.x.x.x, 192.168.x.x, 172.16.x.x) for security.

**Solution:** Use `blockInternalRanges: false` when you need to access internal corporate services:

```javascript
import { VM, createHttpHooks } from "@earendil-works/gondolin";

const { httpHooks, env } = createHttpHooks({
  allowedHosts: [".*"],
  blockInternalRanges: false,  // ⚠️ Allow internal IPs
  secrets: {
    API_KEY: {
      hosts: ["internal-api.company.com"],
      value: process.env.API_KEY
    }
  }
});

const vm = await VM.create({ httpHooks, env });

// Can now access services that resolve to private IPs
const result = await vm.exec(
  'curl -H "Authorization: Bearer $API_KEY" https://internal-api.company.com/health'
);

await vm.close();
```

**How it works:**
1. Gondolin resolves hostnames on the **host** (not in guest)
2. Checks if resolved IP is in private ranges (10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12)
3. Blocks if `blockInternalRanges: true` (default)

**Troubleshooting:**
- If you get 403/blocked errors for internal services, check DNS resolution:
  ```bash
  nslookup internal-api.company.com
  # If it returns 10.x.x.x or 192.168.x.x, you need blockInternalRanges: false
  ```
- **CLI limitation:** The `gondolin` CLI does NOT expose this option - use SDK directly
- **Security:** Only disable for trusted code in controlled environments

### Pattern 5: Virtual Filesystem

```javascript
import { VM, MemoryProvider } from "@earendil-works/gondolin";

const vm = await VM.create({
  vfs: {
    mounts: {
      "/workspace": new MemoryProvider()  // In-memory filesystem
    }
  }
});

// Write to virtual filesystem
await vm.exec("echo 'data' > /workspace/file.txt");
await vm.exec("cat /workspace/file.txt");

await vm.close();
```

**VFS Providers:**
- `MemoryProvider()` - In-memory (fast, ephemeral)
- `RealFSProvider(hostPath)` - Mount host directory (read/write)
- `ReadonlyProvider(hostPath)` - Read-only mount

**Example: Mount host directory (from container context):**

```javascript
import { VM, RealFSProvider } from "@earendil-works/gondolin";

const vm = await VM.create({
  vfs: {
    mounts: {
      "/root/.pi": new RealFSProvider("/root/.pi")  // Mount host directory
    }
  }
});

// Files from host are accessible in VM
await vm.exec("ls -la /root/.pi/agent/extensions");

await vm.close();
```

**Common use case:** When running in Docker, mount the container's directory that's volume-mounted from the host:
```
Host: ~/.pi/agent/extensions/
  ↓ (Docker -v)
Container: /root/.pi/agent/extensions/
  ↓ (VFS RealFSProvider)
VM: /root/.pi/agent/extensions/
```

### Pattern 6: Streaming Output

```javascript
const vm = await VM.create();

const proc = vm.exec(["bash", "-c", "for i in {1..5}; do echo $i; sleep 1; done"], {
  stdout: "pipe"  // Required for streaming
});

// Stream output as it arrives
for await (const chunk of proc) {
  console.log("Output:", chunk);
}

const result = await proc;
console.log("Exit code:", result.exitCode);

await vm.close();
```

### Pattern 7: Build Custom Guest Image

**⚠️ IMPORTANT:** Building custom images requires the Gondolin Git repository. The npm package does NOT support this.

**For npm package users, use runtime installation instead (Pattern 3).**

For persistent packages with the Git repository:

**1. Clone repository:**

```bash
git clone https://github.com/earendil-works/gondolin.git
cd gondolin
npm install
```

**2. Install Zig (required for guest binaries):**

```bash
# macOS
brew install zig

# Linux
wget https://ziglang.org/download/0.15.2/zig-linux-x86_64-0.15.2.tar.xz
tar xf zig-linux-x86_64-0.15.2.tar.xz
export PATH=$PATH:$(pwd)/zig-linux-x86_64-0.15.2
```

**3. Create build-config.json:**

```json
{
  "arch": "aarch64",
  "distro": "alpine",
  "alpine": {
    "version": "3.23.0",
    "kernelPackage": "linux-virt",
    "kernelImage": "vmlinuz-virt",
    "rootfsPackages": [
      "linux-virt",
      "rng-tools",
      "bash",
      "ca-certificates",
      "curl",
      "nodejs",
      "npm",
      "python3",
      "git"
    ],
    "initramfsPackages": []
  },
  "rootfs": {
    "label": "gondolin-root"
  }
}
```

**Note:** Use `"arch": "x86_64"` for Intel/AMD processors.

**4. Build guest binaries:**

```bash
make -C guest
```

**5. Build the image:**

```bash
npx tsx host/bin/gondolin.ts build \
  --config build-config.json \
  --output ./custom-assets
```

**6. Use the custom image:**

```javascript
const vm = await VM.create({
  sandbox: {
    imagePath: "./custom-assets"
  }
});

// Packages already installed!
const result = await vm.exec("node --version");
```

Or set environment variable:

```bash
export GONDOLIN_GUEST_DIR=./custom-assets
node your-script.mjs
```

## VM Configuration Options

### VM.create() Options

```javascript
const vm = await VM.create({
  // Network policy
  httpHooks,      // From createHttpHooks()
  env,            // Environment variables
  
  // Virtual filesystem
  vfs: {
    mounts: {
      "/path": new MemoryProvider()
    },
    hooks: {
      // Intercept file operations
    }
  },
  
  // Sandbox configuration
  sandbox: {
    rootOverlay: true,        // Writable root (tmpfs)
    imagePath: "./assets",    // Custom guest image
    debug: ["*"],             // Enable debug logs
  }
});
```

### exec() Options

```javascript
vm.exec(command, {
  stdin: true,              // Enable stdin writing
  stdout: "pipe",           // Enable stdout streaming
  stderr: "pipe",           // Enable stderr streaming
  pty: true,                // Allocate pseudo-terminal
  env: { VAR: "value" },    // Additional env vars
  cwd: "/tmp"               // Working directory
})
```

### shell() Options

```javascript
vm.shell({
  command: ["/bin/bash", "-i"],  // Shell command
  attach: false,                  // Don't auto-attach (good for automation)
  env: { PS1: "vm> " },          // Environment
  cwd: "/root"                    // Working directory
})
```

## CLI vs SDK

### When to Use CLI

The `gondolin` CLI is great for quick interactive testing:

```bash
# Simple interactive shell
gondolin bash

# With host mounts
gondolin bash --mount-hostfs /data:/workspace

# With secrets
gondolin bash --host-secret GITHUB_TOKEN@api.github.com
```

### When to Use SDK

Use the SDK (Node.js) when you need:

1. **Internal IP access** - `blockInternalRanges: false` (not available in CLI)
2. **Custom hooks** - `onRequest`, `onResponse`, `onRequestHead`
3. **Advanced VFS** - Custom providers, hooks
4. **Programmatic control** - Automation, testing, CI/CD

### CLI Limitations

The CLI **does not expose** these SDK options:
- `blockInternalRanges` - Cannot disable internal IP blocking
- `onRequest`, `onResponse` - No custom HTTP hooks
- VFS hooks - No custom file operation interceptors
- Complex environment setups

**Example: Accessing internal services requires SDK:**

```javascript
// ✅ SDK - Can access internal IPs
import { VM, createHttpHooks } from "@earendil-works/gondolin";

const { httpHooks, env } = createHttpHooks({
  allowedHosts: [".*"],
  blockInternalRanges: false  // CLI cannot do this!
});

const vm = await VM.create({ httpHooks, env });
```

```bash
# ❌ CLI - Cannot disable internal IP blocking
gondolin bash --allow-host internal-api.company.com
# Still blocked if resolves to 10.x.x.x!
```

## Best Practices

### ✅ DO

1. **Always close VMs**
   ```javascript
   const vm = await VM.create();
   try {
     await vm.exec("...");
   } finally {
     await vm.close();
   }
   ```

2. **Use attach:false for automation**
   ```javascript
   const shell = vm.shell({ attach: false });
   ```

3. **Check exit codes**
   ```javascript
   const result = await vm.exec("command");
   if (result.exitCode !== 0) {
     console.error("Command failed:", result.stderr);
   }
   ```

4. **Stream output for long-running commands**
   ```javascript
   const proc = vm.exec(cmd, { stdout: "pipe" });
   for await (const chunk of proc) {
     console.log(chunk);
   }
   ```

5. **Use custom images for production**
   - Build once, reuse many times
   - Faster VM startup
   - Consistent environment

### ❌ DON'T

1. **Don't forget to close VMs**
   ```javascript
   // ❌ BAD: VM leaked
   const vm = await VM.create();
   await vm.exec("...");
   // Missing vm.close()
   ```

2. **Don't use attach:true without TTY**
   ```javascript
   // ❌ BAD: Will hang in automation
   vm.shell({ attach: true });
   ```

3. **Don't rely on runtime installs for production**
   ```javascript
   // ❌ BAD: Slow, not persistent
   vm.exec("apk add nodejs");
   
   // ✅ GOOD: Build custom image instead
   ```

4. **Don't ignore network policy**
   ```javascript
   // ❌ BAD: Unrestricted network access
   VM.create();
   
   // ✅ GOOD: Explicit allowlist
   VM.create({ 
     httpHooks: createHttpHooks({ 
       allowedHosts: ["api.example.com"] 
     }) 
   });
   ```

5. **Don't use array form exec() when shell expansion needed**
   ```javascript
   // ❌ BAD: $VAR sent literally, not expanded
   vm.exec(["curl", "-H", `Authorization: Bearer $SECRET`, ...])
   
   // ✅ GOOD: Shell expands variables
   vm.exec('curl -H "Authorization: Bearer $SECRET" ...')
   ```

6. **Don't add custom onRequest hooks without understanding**
   ```javascript
   // ❌ BAD: Bypasses secret injection
   createHttpHooks({
     secrets: {...},
     onRequest: (req) => req  // Breaks secret replacement!
   })
   
   // ✅ GOOD: Let Gondolin handle secret injection
   createHttpHooks({ secrets: {...} })
   ```

7. **Don't forget PATH in interactive shells**
   ```javascript
   // ❌ BAD: Commands might not be found
   vm.shell({ command: ["/bin/bash", "-i"] })
   
   // ✅ GOOD: Explicit PATH
   vm.shell({ 
     command: ["/bin/bash", "-i"],
     env: { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" }
   })
   ```

## Troubleshooting

### "QEMU not found"

```bash
# macOS
brew install qemu

# Linux
sudo apt install qemu-system-x86-64 qemu-system-aarch64

# Verify
which qemu-system-aarch64
```

### "Guest images not downloading"

Guest images (~200MB) auto-download on first run.

**Cache location:**
- macOS: `~/.cache/gondolin/`
- Linux: `~/.cache/gondolin/`

**Manual download:**
```bash
GONDOLIN_GUEST_DIR=/path/to/cache gondolin bash
```

### "Module not found"

**Check installation:**
```bash
npm list -g @earendil-works/gondolin
```

**Set NODE_PATH:**
```bash
export NODE_PATH=$(npm root -g)
node your-script.mjs
```

**Use portable import helper** (see Installation section).

### "Network access denied"

Add hosts to `allowedHosts`:

```javascript
const { httpHooks } = createHttpHooks({
  allowedHosts: [
    "registry.npmjs.org",
    "dl-cdn.alpinelinux.org"
  ]
});
```

### "403 Forbidden" or "Network blocked" for internal services

**Symptom:** Requests to corporate/internal services get 403 errors, but public APIs work fine.

**Diagnosis:**
```bash
# Check if the hostname resolves to private IPs
nslookup internal-api.company.com
# If you see 10.x.x.x, 192.168.x.x, or 172.16.x.x → internal IP blocking
```

**Solution:** Disable internal IP range blocking (SDK only, not available in CLI):
```javascript
const { httpHooks, env } = createHttpHooks({
  allowedHosts: [".*"],
  blockInternalRanges: false,  // Allow internal IPs
  secrets: {
    API_KEY: {
      hosts: ["internal-api.company.com"],
      value: process.env.API_KEY
    }
  }
});
```

**Why it happens:**
- Gondolin resolves hostnames on the host (not in VM)
- Blocks private IP ranges by default: 10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12
- This is a security feature to prevent SSRF attacks

**CLI limitation:** The `gondolin bash` command does NOT expose `blockInternalRanges` option. You must use the SDK directly with a custom script.

### "Build command not found" or Build Fails

**The npm package does NOT support building custom images.**

**Solution 1: Use runtime installation instead (recommended)**
```javascript
const vm = await VM.create({ 
  sandbox: { rootOverlay: true }
});
await vm.exec("apk add nodejs npm");
```

**Solution 2: Build from Git repository**
```bash
git clone https://github.com/earendil-works/gondolin.git
cd gondolin
npm install
make -C guest  # Build Zig binaries
npx tsx host/bin/gondolin.ts build --config config.json --output ./assets
```

**Why:** The npm package only includes compiled code for running VMs, not the guest source code (Zig) needed for building custom images.

### "Packages not persistent"

Runtime installations with `rootOverlay: true` are temporary.

**Solution:** Build a custom guest image (see Pattern 7).

### "Different behavior macOS vs Linux"

- **Architecture:** ARM64 (aarch64) vs x86_64
- **QEMU acceleration:** macOS (HVF) vs Linux (KVM)
- **Fallback:** TCG (slow, software emulation)

**Check architecture:**
```javascript
const result = await vm.exec("uname -m");
console.log(result.stdout); // aarch64 or x86_64
```

## Advanced Usage

### Custom Init Scripts

Modify guest boot process:

```javascript
const vm = await VM.create({
  sandbox: {
    imagePath: "./custom-assets",
    // Custom init scripts in image
  }
});
```

### VFS Hooks

Intercept file operations:

```javascript
const vm = await VM.create({
  vfs: {
    mounts: { "/data": new MemoryProvider() },
    hooks: {
      onRead: (path, data) => {
        console.log("Reading:", path);
        return data;
      },
      onWrite: (path, data) => {
        console.log("Writing:", path);
        return data;
      }
    }
  }
});
```

### SSH Access

Enable SSH to running VM:

```javascript
const vm = await VM.create();
const sshInfo = await vm.ssh();
console.log("SSH:", sshInfo.port);

// Connect: ssh -p <port> root@localhost
```

### Debug Logging

Enable debug output:

```javascript
const vm = await VM.create({
  sandbox: {
    debug: ["*"],  // All components
    // Or specific: ["sandbox", "network", "vfs"]
    
    debugLog: (component, message) => {
      console.log(`[${component}]`, message);
    }
  }
});
```

## Integration Examples

### With Python Scripts

```javascript
const pythonCode = `
import json
import sys
data = {"status": "ok", "version": sys.version}
print(json.dumps(data))
`;

const result = await vm.exec(["python3", "-c", pythonCode]);
const output = JSON.parse(result.stdout);
console.log(output);
```

### With npm Packages

```javascript
const shell = vm.shell({ attach: false });
shell.write('cd /tmp\n');
shell.write('npm init -y\n');
shell.write('npm install lodash\n');
shell.write('node -e "console.log(require(\\"lodash\\").VERSION)"\n');
shell.write('exit\n');

for await (const chunk of shell) {
  process.stdout.write(chunk);
}
```

### With Docker-like Workflows

```javascript
// Build phase (custom image)
// $ gondolin build --config config.json --output ./image

// Run phase
const vm = await VM.create({
  sandbox: { imagePath: "./image" }
});

await vm.exec("npm test");
await vm.close();
```

## Performance Tips

1. **Reuse VMs when possible**
   ```javascript
   const vm = await VM.create();
   await vm.exec("command1");
   await vm.exec("command2");  // Reuse same VM
   await vm.close();
   ```

2. **Cache guest images**
   - First run: ~5s (download)
   - Subsequent: ~1s (cached)

3. **Use custom images for speed**
   - Runtime install: ~30s for nodejs
   - Custom image: ~1s (pre-installed)

4. **Stream large outputs**
   ```javascript
   const proc = vm.exec(cmd, { stdout: "pipe" });
   for await (const chunk of proc) {
     // Process incrementally
   }
   ```

5. **Enable hardware acceleration**
   - macOS: HVF (automatic)
   - Linux: KVM (automatic if available)

## Quick Reference

### Common Commands

```javascript
// Create VM
const vm = await VM.create();
const vm = await VM.create({ httpHooks, env, vfs, sandbox });

// Execute
const result = await vm.exec("command");
const result = await vm.exec(["cmd", "arg1"], { options });

// Interactive shell
const shell = vm.shell({ attach: false });
shell.write('command\n');
for await (const chunk of shell) { }

// Streaming
const proc = vm.exec(cmd, { stdout: "pipe" });
for await (const chunk of proc) { }

// Close
await vm.close();

// Network policy
const { httpHooks, env } = createHttpHooks({
  allowedHosts: ["host.com"],
  secrets: { KEY: { hosts: ["host.com"], value: "secret" } }
});

// Network policy with internal IP access
const { httpHooks, env } = createHttpHooks({
  allowedHosts: [".*"],
  blockInternalRanges: false,  // Allow 10.x.x.x, 192.168.x.x, etc.
  secrets: { KEY: { hosts: ["internal-api.company.com"], value: "secret" } }
});

// VFS mount
import { RealFSProvider } from "@earendil-works/gondolin";
const vm = await VM.create({
  vfs: {
    mounts: {
      "/root/.pi": new RealFSProvider("/root/.pi")
    }
  }
});

// Build image
$ gondolin build --config config.json --output ./assets
```

### Common Pitfalls

| Issue | Problem | Solution |
|-------|---------|----------|
| 403 on internal APIs | Default blocks private IPs | Use `blockInternalRanges: false` (SDK only) |
| $VAR not expanded | Array form exec doesn't expand | Use string form: `vm.exec('cmd $VAR')` |
| Secret not injected | Custom onRequest hook | Remove custom hook or use SDK properly |
| Command not found | PATH not set in shell | Set `env.PATH` in shell options |
| CLI can't access internal | CLI limitation | Use SDK with custom script |

### Exit Codes

- `0` - Success
- `1-255` - Command failed
- Check: `result.exitCode`

### File Locations

- **Guest images:** `~/.cache/gondolin/`
- **Global install:** `$(npm root -g)/@earendil-works/gondolin`
- **Custom images:** User-specified path

## Related Skills

- **docker** - Container-based isolation (vs VM isolation)
- **python-uv** - Package management in isolated environments
- **gitlab-ci** - CI/CD integration with sandboxed builds

## Resources

- **GitHub:** https://github.com/earendil-works/gondolin
- **DeepWiki:** https://deepwiki.com/wiki/earendil-works/gondolin
- **Alpine Packages:** https://pkgs.alpinelinux.org/packages
- **QEMU:** https://www.qemu.org/

## Summary

Gondolin provides **secure, isolated Linux micro-VMs** for:
- ✅ Running untrusted code safely
- ✅ Package installation sandboxing
- ✅ Cross-platform testing
- ✅ Network policy enforcement
- ✅ Ephemeral CI/CD environments

**Key patterns:**
1. Simple commands: `vm.exec()`
2. Interactive: `vm.shell({ attach: false })`
3. Runtime packages: `rootOverlay: true`
4. Persistent packages: Custom images
5. Network control: `createHttpHooks()`

**Always remember:** `await vm.close()` to free resources!
