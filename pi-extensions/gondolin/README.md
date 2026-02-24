# Gondolin Extension for Pi

Seamless sandbox VM management for Pi, supporting both pi-managed Alpine Linux VMs and remote host-managed VMs.

## Features

- **Local VMs**: Create and manage pi-managed Alpine Linux sandboxes
- **Remote VMs**: Execute commands on host-managed Gondolin VMs via IPC
- **Dual Path Handling**: Workspace-constrained paths for local VMs, full filesystem for remote
- **Custom Guest Images**: Override default Alpine with custom images
- **Tool Integration**: Seamless `/read`, `/write`, `/edit`, `/bash` support in both VM types
- **Fast Command Execution**: `/gondolin exec <vm-id-or-name> <command>`

## Quick Start

```bash
# List all VMs (local and remote)
/gondolin list

# Create and attach to a local VM
/gondolin start myvm

# Execute command on any VM by ID or name
/gondolin exec myvm ls -la
/gondolin exec 02079628 pwd

# Write to remote VM (no path restrictions)
/write /tmp/test.txt
content here

# Read from remote VM (any path)
/read /etc/hostname
```

## Configuration

### Guest Images

Override the default Alpine Linux with a custom guest image.

```bash
# Show current configuration
/gondolin config guest-image show

# Set custom image (config override, highest priority)
/gondolin config guest-image set /path/to/image

# Reset to environment/default
/gondolin config guest-image unset
```

**Priority**:
1. Config override (`guestImage.imagePath`)
2. Environment variable (`GONDOLIN_GUEST_DIR`)
3. Gondolin default

### Other Configuration

```bash
# Workspace mounting
/gondolin config cwd on|off

# Skills mounting
/gondolin config skills {enable|default|read-only|add <path>|remove <index>}

# Auto-attach on session start
/gondolin config auto-attach on|off

# Environment variables and secrets
/gondolin config environment {add|remove|list}
/gondolin config secrets {add|remove|list}

# Edit/view configuration
/gondolin config edit
/gondolin config view
```

## VM Commands

```bash
# Lifecycle
/gondolin start <name> [--mount-skills]
/gondolin stop [name-or-id|session|all]
/gondolin recreate <name>

# Attachment
/gondolin attach [name-or-id]   # By name or ID prefix
/gondolin detach

# Execution
/gondolin exec <vm-id-or-name> <command>

# Management
/gondolin list
/gondolin gc
```

## Architecture

### Local (Pi-Managed) VMs
- Created via `VM.create()` from Gondolin SDK
- Workspace-constrained to `/root/workspace`
- Path validation prevents escape attacks
- Supports custom mounts and skill mounting

### Remote (Host-Managed) VMs
- Connected via IPC socket (`connectToSession()`)
- Full filesystem access (user controls sandbox)
- Dynamic `RemoteVM` creation on-demand
- Alpine Linux compatible (bash→sh, flags, PATH)

## Implementation Details

### Message Protocol
Commands use Gondolin's IPC protocol:
- Frame: `[4-byte big-endian length] + [JSON payload]`
- Fields: `type`, `id`, `cmd`, `argv`, `env`, `stdin`, `pty`

### Stream Management
- Proper async generator implementation
- `setImmediate()` prevents race conditions in stream closing
- Clean spinner handling with single-block output

### Alpine Compatibility
- Replace `/bin/bash` with `/bin/sh`
- Convert `-lc` to `-c` (login shell not available)
- Explicit PATH environment variable setup

## Troubleshooting

**VM not found with ID prefix**:
- IDs are looked up from daemon session registry
- Use `/gondolin list` to see all available VMs
- Prefix must match the full ID start

**Path escape errors on remote VMs**:
- Remote VMs use no path validation (feature, not bug)
- Full filesystem access is intentional
- For local VMs, paths must stay within `/root/workspace`

**Commands failing with exit 127**:
- Alpine sh requires explicit PATH setup
- PATH is automatically added during VM creation
- Ensure custom shell commands are available

## Files

- `index.ts`: Main extension, command handlers
- `remote-vm.ts`: RemoteVM wrapper for IPC connections
- `config.ts`: Configuration schema and getters
- `config-commands.ts`: Configuration command handlers
- `vm-builder.ts`: VM creation options builder
- `config-editor.ts`: TUI configuration editor

## Environment Variables

- `GONDOLIN_GUEST_DIR`: Default custom guest image path (overridable in config)

## License

Same as Pi project
