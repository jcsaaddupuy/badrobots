# gondolin-vfs-environment

Environment Variables VFS Provider for Gondolin

## Overview

This provider exposes environment variables as a read-only virtual file system. Each environment variable becomes a file containing its value.

## Installation

```bash
npm install gondolin-vfs-environment
```

## Usage

The provider is automatically discovered and loaded by Gondolin at startup.

### Configuration

Add to your `~/.pi/config/gondolin.json`:

```json
{
  "vfs": {
    "environment": {
      "enabled": true,
      "prefix": "",
      "caseSensitive": false
    }
  }
}
```

### Configuration Options

- **enabled** (boolean, default: true): Enable or disable the provider
- **prefix** (string, default: ""): Optional prefix to filter variables (e.g., "APP_" to only show APP_* variables)
- **caseSensitive** (boolean, default: false): Whether to treat variable names as case-sensitive

## Capabilities

- **read**: Read environment variable values
- **list**: List all environment variables (or filtered by prefix)
- **stat**: Get metadata about environment variables

## Examples

### List all environment variables

```bash
/gondolin vfs list
```

### Get environment variable value

```bash
/gondolin config environment show
```

### Filter by prefix

Configure with prefix "APP_" to only show variables starting with "APP_":

```json
{
  "vfs": {
    "environment": {
      "prefix": "APP_"
    }
  }
}
```

## Limitations

- Read-only (cannot write or delete environment variables)
- Changes to environment variables are reflected immediately
- Sensitive variables are exposed as plain text (use with caution)

## Security

This provider exposes all environment variables as readable files. Be careful when:

- Storing sensitive data in environment variables
- Running Gondolin with elevated privileges
- Exposing Gondolin's VFS to untrusted users

## License

MIT
