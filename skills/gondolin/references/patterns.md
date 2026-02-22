# Gondolin Common Patterns

## Script Templates

### Basic Script Template

```javascript
import { VM } from "@earendil-works/gondolin";

async function main() {
  const vm = await VM.create();
  
  try {
    const result = await vm.exec("echo 'Hello VM'");
    console.log(result.stdout);
  } finally {
    await vm.close();
  }
}

main().catch(console.error);
```

### Portable Import Template

```javascript
// gondolin-import.mjs
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

function getGlobalNodeModules() {
  if (process.env.NODE_PATH) {
    const paths = process.env.NODE_PATH.split(':');
    for (const p of paths) {
      if (p && existsSync(p)) return p;
    }
  }
  
  try {
    return execSync('npm root -g', { encoding: 'utf-8' }).trim();
  } catch {}
  
  return process.platform === 'darwin' 
    ? '/opt/homebrew/lib/node_modules'
    : '/usr/local/lib/node_modules';
}

const gondolinPath = join(
  getGlobalNodeModules(),
  '@earendil-works/gondolin/dist/src/index.js'
);

if (!existsSync(gondolinPath)) {
  throw new Error('Gondolin not found');
}

export const { VM, createHttpHooks, MemoryProvider } = 
  await import(`file://${gondolinPath}`);
```

## Use Case Patterns

### Pattern: Test Package Installation

```javascript
import { VM } from "@earendil-works/gondolin";

async function testPackage(packageName) {
  const vm = await VM.create({
    sandbox: { rootOverlay: true }
  });
  
  try {
    const shell = vm.shell({ attach: false });
    shell.write('apk update\n');
    shell.write(`apk add ${packageName}\n`);
    shell.write(`${packageName} --version\n`);
    shell.write('exit\n');
    
    let output = '';
    for await (const chunk of shell) {
      output += chunk;
    }
    
    const result = await shell;
    return {
      success: result.exitCode === 0,
      output
    };
  } finally {
    await vm.close();
  }
}

// Usage
const result = await testPackage('nodejs');
console.log(result.success ? "✓ Installed" : "✗ Failed");
```

### Pattern: Run Untrusted Code

```javascript
import { VM, createHttpHooks } from "@earendil-works/gondolin";

async function runUntrustedCode(code) {
  const { httpHooks } = createHttpHooks({
    allowedHosts: []  // No network access
  });
  
  const vm = await VM.create({ httpHooks });
  
  try {
    const result = await vm.exec(
      ["node", "-e", code],
      { timeout: 5000 }  // 5 second timeout
    );
    
    return {
      success: result.exitCode === 0,
      output: result.stdout,
      error: result.stderr
    };
  } finally {
    await vm.close();
  }
}

// Usage
const result = await runUntrustedCode('console.log(2 + 2)');
console.log(result.output);  // "4\n"
```

### Pattern: Multi-Step Workflow

```javascript
import { VM } from "@earendil-works/gondolin";

async function buildProject() {
  const vm = await VM.create({
    vfs: {
      mounts: {
        "/project": new RealFSProvider("./my-project")
      }
    }
  });
  
  try {
    const shell = vm.shell({ attach: false });
    
    // Setup
    shell.write('cd /project\n');
    
    // Install dependencies
    shell.write('npm install\n');
    
    // Run tests
    shell.write('npm test\n');
    
    // Build
    shell.write('npm run build\n');
    
    shell.write('exit\n');
    
    for await (const chunk of shell) {
      process.stdout.write(chunk);
    }
    
    const result = await shell;
    return result.exitCode === 0;
  } finally {
    await vm.close();
  }
}

const success = await buildProject();
console.log(success ? "Build succeeded" : "Build failed");
```

### Pattern: Secret Injection for API Calls

```javascript
import { VM, createHttpHooks } from "@earendil-works/gondolin";

async function fetchDataSecurely(apiUrl) {
  const { httpHooks, env } = createHttpHooks({
    allowedHosts: [new URL(apiUrl).hostname],
    secrets: {
      API_KEY: {
        hosts: [new URL(apiUrl).hostname],
        value: process.env.API_KEY
      }
    }
  });
  
  const vm = await VM.create({ httpHooks, env });
  
  try {
    const result = await vm.exec(
      `curl -H "Authorization: Bearer $API_KEY" ${apiUrl}`
    );
    
    return JSON.parse(result.stdout);
  } finally {
    await vm.close();
  }
}

const data = await fetchDataSecurely('https://api.example.com/data');
```

### Pattern: Batch Processing

```javascript
import { VM } from "@earendil-works/gondolin";

async function processBatch(items) {
  const vm = await VM.create();
  
  try {
    const results = [];
    
    for (const item of items) {
      const result = await vm.exec(
        `process-command "${item}"`
      );
      results.push({
        item,
        output: result.stdout,
        success: result.exitCode === 0
      });
    }
    
    return results;
  } finally {
    await vm.close();
  }
}

// Process 100 items using same VM (fast!)
const results = await processBatch(items);
```

### Pattern: Custom Environment Setup

```javascript
import { VM } from "@earendil-works/gondolin";

async function createCustomEnv() {
  const vm = await VM.create({
    sandbox: { rootOverlay: true },
    env: {
      CUSTOM_VAR: "value",
      PATH: "/custom/bin:/usr/local/bin:/usr/bin:/bin"
    }
  });
  
  try {
    const shell = vm.shell({ attach: false });
    
    // Setup custom tools
    shell.write('mkdir -p /custom/bin\n');
    shell.write('cat > /custom/bin/mytool << EOF\n');
    shell.write('#!/bin/bash\n');
    shell.write('echo "Custom tool: $CUSTOM_VAR"\n');
    shell.write('EOF\n');
    shell.write('chmod +x /custom/bin/mytool\n');
    
    // Use it
    shell.write('mytool\n');
    shell.write('exit\n');
    
    for await (const chunk of shell) {
      console.log(chunk);
    }
  } finally {
    await vm.close();
  }
}
```

### Pattern: File Processing with VFS

```javascript
import { VM, MemoryProvider } from "@earendil-works/gondolin";

async function processFiles(files) {
  const vfsProvider = new MemoryProvider();
  
  const vm = await VM.create({
    vfs: {
      mounts: { "/workspace": vfsProvider }
    }
  });
  
  try {
    // Write files to VFS
    for (const [name, content] of Object.entries(files)) {
      await vm.exec(`cat > /workspace/${name} << 'EOF'\n${content}\nEOF`);
    }
    
    // Process files
    const result = await vm.exec(
      'cd /workspace && for f in *; do wc -l $f; done'
    );
    
    return result.stdout;
  } finally {
    await vm.close();
  }
}

const files = {
  "file1.txt": "line1\nline2\n",
  "file2.txt": "line1\n"
};

const lineCount = await processFiles(files);
```

### Pattern: Interactive Testing

```javascript
import { VM } from "@earendil-works/gondolin";

async function interactiveTest() {
  const vm = await VM.create();
  
  try {
    const shell = vm.shell({ attach: false });
    
    const commands = [
      'python3 -m http.server 8000 &',
      'sleep 2',
      'curl localhost:8000',
      'kill %1',
      'exit'
    ];
    
    for (const cmd of commands) {
      shell.write(cmd + '\n');
      await new Promise(r => setTimeout(r, 100));
    }
    
    for await (const chunk of shell) {
      console.log(chunk);
    }
  } finally {
    await vm.close();
  }
}
```

## CI/CD Patterns

### Pattern: GitLab CI

```yaml
test-in-gondolin:
  image: node:latest
  before_script:
    - npm install -g @earendil-works/gondolin
    - apt-get update && apt-get install -y qemu-system-x86-64
  script:
    - node test-in-vm.js
  cache:
    paths:
      - ~/.cache/gondolin/
```

### Pattern: GitHub Actions

```yaml
name: Test in Gondolin
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install Gondolin
        run: npm install -g @earendil-works/gondolin
      - name: Install QEMU
        run: sudo apt-get install -y qemu-system-x86-64
      - name: Run tests
        run: node test-in-vm.js
      - name: Cache guest images
        uses: actions/cache@v3
        with:
          path: ~/.cache/gondolin
          key: gondolin-${{ runner.os }}
```

### Pattern: Docker Build

```dockerfile
FROM node:20-alpine

RUN apk add --no-cache qemu qemu-img qemu-system-x86_64
RUN npm install -g @earendil-works/gondolin

WORKDIR /app
COPY . .

CMD ["node", "run-tests-in-vm.js"]
```

## Error Handling Patterns

### Pattern: Retry Logic

```javascript
async function executeWithRetry(vm, command, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await vm.exec(command);
      if (result.exitCode === 0) {
        return result;
      }
      console.log(`Attempt ${i + 1} failed, retrying...`);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}
```

### Pattern: Timeout Handling

```javascript
async function executeWithTimeout(vm, command, timeoutMs) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), timeoutMs)
  );
  
  const execution = vm.exec(command);
  
  return Promise.race([execution, timeout]);
}
```

### Pattern: Graceful Cleanup

```javascript
class VMPool {
  constructor() {
    this.vms = [];
  }
  
  async create() {
    const vm = await VM.create();
    this.vms.push(vm);
    return vm;
  }
  
  async closeAll() {
    await Promise.all(this.vms.map(vm => vm.close()));
    this.vms = [];
  }
}

// Usage
const pool = new VMPool();
try {
  const vm1 = await pool.create();
  const vm2 = await pool.create();
  // ... use VMs
} finally {
  await pool.closeAll();
}
```

## Debugging Patterns

### Pattern: Capture All Output

```javascript
async function debugExec(vm, command) {
  console.log("Executing:", command);
  
  const proc = vm.exec(command, { 
    stdout: "pipe", 
    stderr: "pipe" 
  });
  
  let stdout = '';
  let stderr = '';
  
  proc.stdout?.on('data', chunk => {
    stdout += chunk;
    console.log("[STDOUT]", chunk);
  });
  
  proc.stderr?.on('data', chunk => {
    stderr += chunk;
    console.error("[STDERR]", chunk);
  });
  
  const result = await proc;
  console.log("Exit code:", result.exitCode);
  
  return { result, stdout, stderr };
}
```

### Pattern: Enable Debug Logging

```javascript
const vm = await VM.create({
  sandbox: {
    debug: ["*"],
    debugLog: (component, message) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${component}] ${message}`);
    }
  }
});
```

### Pattern: Inspect Guest State

```javascript
async function inspectGuest(vm) {
  const info = {
    os: await vm.exec("uname -a"),
    memory: await vm.exec("free -h"),
    disk: await vm.exec("df -h"),
    network: await vm.exec("ip addr"),
    processes: await vm.exec("ps aux")
  };
  
  for (const [key, result] of Object.entries(info)) {
    console.log(`\n=== ${key.toUpperCase()} ===`);
    console.log(result.stdout);
  }
  
  return info;
}
```

## Testing Patterns

### Pattern: Unit Test Template

```javascript
import { VM } from "@earendil-works/gondolin";
import { describe, it, after } from 'node:test';
import assert from 'node:assert';

describe('Gondolin VM Tests', () => {
  let vm;
  
  beforeEach(async () => {
    vm = await VM.create();
  });
  
  afterEach(async () => {
    await vm.close();
  });
  
  it('should execute simple command', async () => {
    const result = await vm.exec('echo "test"');
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stdout.trim(), 'test');
  });
  
  it('should handle failures', async () => {
    const result = await vm.exec('exit 1');
    assert.strictEqual(result.exitCode, 1);
  });
});
```

### Pattern: Integration Test

```javascript
async function integrationTest() {
  const vm = await VM.create({
    vfs: {
      mounts: { "/project": new RealFSProvider(".") }
    }
  });
  
  try {
    // Test full workflow
    const steps = [
      'cd /project',
      'npm install',
      'npm test',
      'npm run build'
    ];
    
    for (const step of steps) {
      console.log(`Running: ${step}`);
      const result = await vm.exec(step);
      if (result.exitCode !== 0) {
        throw new Error(`Step failed: ${step}`);
      }
    }
    
    console.log("✓ All tests passed");
  } finally {
    await vm.close();
  }
}
```
