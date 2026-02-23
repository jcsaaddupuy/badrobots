# Gondolin Extension

Run Pi's tools (read, write, edit, bash) inside isolated Linux micro-VMs. Perfect for sandboxing untrusted code, testing, and secure execution.

## Quick Start

### Auto-Attach (Recommended)

Enable auto-attach to automatically create and connect to a sandbox on session start:

```
/gondolin config auto-attach on
```

That's it! Your tools now run in a sandbox.

### Manual Control

```
/gondolin start default          # Create a VM named "default"
/gondolin list                   # Show all VMs
/gondolin attach default         # Connect to a VM
/gondolin detach                 # Disconnect from current VM
/gondolin stop default           # Stop a VM
```

## Features

### Isolation
- Each VM is a lightweight Linux micro-VM (boots in ~1s)
- Runs Alpine Linux by default
- Fully isolated filesystem, network, and processes
- No access to host system unless explicitly mounted

### Tool Routing
When attached to a VM, all Pi tools route through the sandbox:
- `/read` → reads files inside the VM
- `/write` → writes files inside the VM  
- `/edit` → edits files inside the VM
- `/bash` → executes commands inside the VM

### Workspace Mounting
By default, your current working directory is mounted inside the VM at `/root/workspace`:

```
/gondolin config cwd on          # Enable (default)
/gondolin config cwd off         # Disable
```

Make it writable:
```
/gondolin config cwd on          # Enable mounting
# Then edit config to set cwdWritable: true
```

### Skills Support
Mount Pi skills inside the VM so they're available for use:

```
/gondolin config skills enable           # Enable skills
/gondolin config skills default on       # Mount default skills (enabled by default)
/gondolin config skills read-only on     # Make skills read-only (recommended)
/gondolin config skills add /path/to/skill  # Add custom skill path
/gondolin config skills remove 0         # Remove skill by index
```

### Network Control
Control what hosts the VM can access:

```
/gondolin config edit            # Edit full config
```

In the config, set `network.allowedHosts` to restrict access:
```json
{
  "network": {
    "allowedHosts": ["api.github.com", "registry.npmjs.org"],
    "blockInternalRanges": true
  }
}
```

**Note:** By default, private IP ranges (10.x.x.x, 192.168.x.x, 172.16.x.x) are blocked for security. Set `blockInternalRanges: false` to access internal services.

### Environment Variables
Inject environment variables into the VM:

```
/gondolin config environment add MY_VAR propagate    # Copy from host
/gondolin config environment add MY_VAR static value # Set static value
/gondolin config environment add MY_VAR reference ${HOME}/file  # Reference other vars
/gondolin config environment remove MY_VAR
/gondolin config environment list
```

### Secrets
Inject secrets securely (never logged or displayed):

```
/gondolin config secrets add MY_SECRET propagate api.example.com
/gondolin config secrets add MY_SECRET static mysecretvalue api.example.com
/gondolin config secrets remove MY_SECRET
/gondolin config secrets list
```

Secrets are only injected for specified hosts:
```json
{
  "secrets": {
    "GITHUB_TOKEN": {
      "type": "propagate",
      "hosts": ["api.github.com", "github.com"]
    }
  }
}
```

### Custom Mounts
Mount additional host directories inside the VM:

```
/gondolin config edit            # Edit full config
```

Add custom mounts:
```json
{
  "customMounts": {
    "/data": {
      "hostPath": "/home/user/data",
      "writable": false
    },
    "/tmp": {
      "hostPath": "/tmp",
      "writable": true
    }
  }
}
```

## Configuration

### Config File Location
`~/.pi/agent/settings.json` under the `gondolin` key

### Full Config Schema

```json
{
  "gondolin": {
    "workspace": {
      "mountCwd": true,           // Mount current directory
      "cwdWritable": false,       // Make it writable
      "defaultVmName": "default"  // Default VM name
    },
    "skills": {
      "enabled": false,           // Enable skills mounting
      "mountDefault": true,       // Mount default skills
      "customPaths": [],          // Additional skill paths
      "readOnly": true            // Make skills read-only
    },
    "autoAttach": false,          // Auto-create VM on session start
    "customMounts": {},           // Custom directory mounts
    "network": {
      "allowedHosts": ["*"],      // Allowed hosts (wildcards supported)
      "blockInternalRanges": true // Block private IPs
    },
    "environment": {},            // Environment variables
    "secrets": {}                 // Secrets (never logged)
  }
}
```

### Quick Config Commands

```
/gondolin config view                    # Show current config
/gondolin config reset                   # Reset to defaults
/gondolin config edit                    # Edit in text editor
/gondolin config cwd [on|off]            # Toggle workspace mounting
/gondolin config skills [enable|disable] # Toggle skills
/gondolin config auto-attach [on|off]    # Toggle auto-attach
```

## Commands Reference

| Command | Description |
|---------|-------------|
| `start [name]` | Create a new VM |
| `start [name] --mount-skills` | Create VM with skills pre-mounted |
| `stop [name\|id\|session\|all]` | Stop VM(s) |
| `list` | Show all VMs |
| `attach [name\|id]` | Connect to a VM |
| `detach` | Disconnect from current VM |
| `recreate [name]` | Recreate a VM |
| `gc` | Garbage collect unused VMs |
| `config view` | Show current config |
| `config edit` | Edit config in editor |
| `config reset` | Reset to defaults |

## Examples

### Example 1: Safe Code Execution

```
/gondolin config auto-attach on
# Now all your tools run in a sandbox
/bash
npm install some-untrusted-package
# Package is installed in sandbox, not on your host
```

### Example 2: Isolated Testing

```
/gondolin start test-env
/gondolin attach test-env
/bash
python -m pytest tests/
# Tests run in isolated environment
/gondolin detach
/gondolin stop test-env
```

### Example 3: Secure API Access

```
# In ~/.pi/agent/settings.json:
{
  "gondolin": {
    "secrets": {
      "GITHUB_TOKEN": {
        "type": "propagate",
        "hosts": ["api.github.com"]
      }
    },
    "network": {
      "allowedHosts": ["api.github.com"]
    }
  }
}

# In Pi:
/gondolin config auto-attach on
/bash
curl -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user
# Token is safely injected, never logged
```

### Example 4: Multi-Environment Testing

```
/gondolin start node-18
/gondolin start node-20
/gondolin attach node-18
/bash
node --version  # v18.x.x
/gondolin detach

/gondolin attach node-20
/bash
node --version  # v20.x.x
```

## Troubleshooting

### "QEMU not found"
Install QEMU:
```bash
# macOS
brew install qemu

# Linux (Debian/Ubuntu)
sudo apt install qemu-system-x86-64 qemu-system-aarch64
```

### "403 Forbidden" for internal services
Your internal service resolves to a private IP (10.x.x.x, 192.168.x.x, etc). Fix:

```json
{
  "gondolin": {
    "network": {
      "blockInternalRanges": false
    }
  }
}
```

### VM not starting
Check logs:
```
/gondolin list
# Look for error messages
```

### Tools not routing through VM
Make sure you're attached:
```
/gondolin list
# Look for ◆ marker next to VM name (indicates current session)
```

## How It Works

1. **VM Creation**: When you start a VM, Gondolin boots a lightweight Linux micro-VM using QEMU
2. **Mounting**: Your workspace and skills are mounted as read-only (or writable) filesystems
3. **Tool Routing**: When attached, Pi's tools intercept calls and route them through the VM
4. **Cleanup**: When you stop a VM, all changes are discarded (ephemeral by default)

## Performance

- **VM Boot**: ~1 second
- **First Run**: ~5 seconds (downloads guest image, ~200MB)
- **Subsequent Runs**: ~1 second (cached)
- **Tool Overhead**: Minimal (network-based communication)

## Security Notes

- VMs are **ephemeral** by default (changes lost on stop)
- **Secrets are never logged** or displayed in output
- **Network is restricted** by default (allowlist model)
- **Filesystem is isolated** (only mounted paths are accessible)
- **Private IPs are blocked** by default (prevents SSRF attacks)

## Related

- **Gondolin Skill**: `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/skills/gondolin/SKILL.md`
- **Gondolin GitHub**: https://github.com/earendil-works/gondolin
- **Docker Skill**: For container-based isolation instead of VMs
