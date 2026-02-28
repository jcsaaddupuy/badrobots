# gondolin-vfs-secrets

VFS provider for Gondolin that exposes secrets from a host config file as read-only files in the VM.

## Features

- **File-based configuration**: Declare secrets in a simple text file (like `gondolin-vfs-environment`)
- **Live updates**: Config file is re-read on every guest access
- **Placeholder isolation**: Guest sees `GONDOLIN_SECRET_xxx` placeholders, never real values
- **Reference support**: Secrets can reference environment variables
- **HTTP injection**: Real values substituted only at HTTP egress for allowed hosts

## Configuration

### Config File Format

Create a secrets file (default: `~/.pi/secrets`) with one secret per line:

```
# Propagate secrets (read from host environment)
OPENAI_API_KEY
VAULT_TOKEN

# Propagate with host restrictions
OPENAI_API_KEY@llm.ubichat.ubisoft.org
PROD_TOKEN@api.prod,webhook.prod

# Static secrets (literal values, allowed for all hosts)
DB_PASSWORD=my-secret-password
API_KEY=sk-1234567890

# Static secrets with host restrictions
INTERNAL_SECRET@db.internal,cache.internal=secret-value
STAGING_API_KEY@api.staging=sk-staging-key

# Reference environment variables (allowed for all hosts)
VAULT_TOKEN=$VAULT_TOKEN
GITHUB_TOKEN=${GITHUB_TOKEN}

# Reference with host restrictions
PROD_TOKEN@api.prod,webhook.prod=$PROD_TOKEN

# Empty values
EMPTY_SECRET=

# Comments and blank lines are ignored
```

### Supported Syntax

**Propagate** (read from host environment variable with same name):
- `SECRET_NAME` — Propagate from `process.env[SECRET_NAME]` (hosts default to `["*"]`)
- `SECRET_NAME@host1,host2` — Propagate with host restrictions

**Static** (literal value):
- `SECRET_NAME=value` — Static literal value (hosts default to `["*"]`)
- `SECRET_NAME@host1,host2=value` — Static with host restrictions

**Reference** (expand environment variables):
- `SECRET_NAME=$ENV_VAR` — Reference to environment variable (expanded at access time)
- `SECRET_NAME=${ENV_VAR}` — Same as above, with braces
- `SECRET_NAME@host1,host2=$ENV_VAR` — Reference with host restrictions

**Comments and blank lines**:
- Lines starting with `#` — Comments (ignored)
- Blank lines — Ignored

### Host Patterns

Per-secret host restrictions are specified with `@` syntax:
- `API_KEY@api.example.com=sk-123` — Allowed only for `api.example.com`
- `DB_PASSWORD@db.internal,db.staging=secret` — Allowed for multiple hosts
- `PUBLIC_SECRET=value` — Allowed for all hosts (no `@` = `["*"]`)

Host patterns are matched against the request hostname using gondolin's host pattern matching (supports wildcards like `*.internal`).

### TUI Configuration

1. Go to Settings → VFS Providers
2. Select "Secrets File"
3. Configure "Secrets File" path (supports `~` expansion)
4. Enable the provider

### Programmatic Usage

```typescript
import createProvider from 'gondolin-vfs-secrets';

const provider = createProvider({
  secretsFile: '/path/to/secrets'
});
```

## How It Works

### At VM Creation

1. Provider scans the config file and extracts secret names
2. vm-builder generates `GONDOLIN_SECRET_<hex>` placeholder for each secret
3. Provider stores the placeholder map
4. Placeholders are added to VM exec env

### In the Guest

```bash
ls /run/secrets                    # Lists secret names
cat /run/secrets/DB_PASSWORD       # Shows placeholder: GONDOLIN_SECRET_xxx
echo $DB_PASSWORD                  # Shows placeholder in exec env
```

### At HTTP Egress

When the guest makes an HTTP request with a placeholder in a header:
- vm-builder's `onRequestHead` wrapper detects the placeholder
- Calls `provider.getSecretValue()` to fetch the current value
- Substitutes the real value in the header (only for allowed hosts)
- Sends the request with the real secret

## Security

- **Guest isolation**: Guest never sees real secret values
- **Live updates**: Changes to the config file are reflected immediately
- **Host-only substitution**: Real values only appear in HTTP headers at egress
- **Host pattern matching**: Secrets only sent to allowed hosts (configurable per secret in `config.secrets`)

## Testing

```bash
npm test
```

All 26 tests passing, including propagate, static, reference types and host pattern parsing.
