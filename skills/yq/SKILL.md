---
name: yq
description: Comprehensive guide for parsing and manipulating YAML using yq
---

# yq - YAML/JSON Processing - Agent Usage Guide

## Core Concept
`yq` is a lightweight and portable YAML/JSON/XML processor. It's like `jq` but for YAML files. Use it for parsing, querying, and manipulating YAML configuration files in shell scripts.

**Important:** This guide covers `mikefarah/yq` v4+ (the Go implementation), not the older Python `yq` wrapper.

## Why Use yq

**Advantages:**
- ✅ **Native YAML support** - Parse and modify YAML without Python
- ✅ **JSON compatible** - Can process JSON too
- ✅ **Preserves comments** - Unlike most YAML parsers
- ✅ **In-place editing** - Modify files directly with `-i`
- ✅ **jq-like syntax** - Similar to jq for easy learning
- ✅ **Fast** - Go implementation, no interpreter startup

**Common Use Cases:**
- Parse Kubernetes manifests
- Modify Docker Compose files
- Update CI/CD configurations (.gitlab-ci.yml, .github/workflows)
- Extract values from config files
- Merge YAML files
- Convert between YAML and JSON

## Installation Check

```bash
# Check version
yq --version
# Should output: yq (https://github.com/mikefarah/yq/) version v4.x.x

# NOT the Python yq wrapper which shows: yq 3.x.x
```

## Basic Syntax

### General Form
```bash
yq [options] 'expression' [file...]
```

**Common Options:**
- `-i` / `--inplace` - Edit file in place
- `-o FORMAT` / `--output-format FORMAT` - Output format (yaml/json/xml/props)
- `-P` / `--prettyPrint` - Pretty print (default for YAML)
- `-I INDENT` / `--indent INDENT` - Set indent (default: 2)
- `-r` / `--raw-output` - Output raw strings (no quotes)
- `-n` / `--null-input` - Don't read input
- `-e` / `--exit-status` - Exit with status based on output

### Input/Output
```bash
# From file
yq '.name' config.yaml

# From stdin
echo 'name: Alice' | yq '.name'

# From command output
kubectl get pod mypod -o yaml | yq '.spec.containers[0].image'

# Multiple files
yq '.version' app1.yaml app2.yaml
```

## Essential Operations

### 1. Read Values

```bash
# Simple field
echo 'name: Alice' | yq '.name'
# Output: Alice

# Nested field
echo 'user: {name: Alice, age: 30}' | yq '.user.name'
# Output: Alice

# Array element
echo 'items: [a, b, c]' | yq '.items[0]'
# Output: a

# All array elements
echo 'items: [a, b, c]' | yq '.items[]'
# Output: a b c (three separate outputs)
```

### 2. Raw Output (No Quotes)

```bash
# With quotes (default YAML)
echo 'name: Alice' | yq '.name'
# Output: Alice

# Raw output (like jq -r)
echo 'name: Alice' | yq -r '.name'
# Output: Alice

# Useful for shell variables
VERSION=$(yq -r '.version' package.yaml)
```

### 3. Modify Values

```bash
# Update field
echo 'name: Alice' | yq '.name = "Bob"'
# Output: name: Bob

# Update nested field
echo 'user: {name: Alice}' | yq '.user.age = 30'
# Output: 
# user:
#   name: Alice
#   age: 30

# In-place file edit
yq -i '.version = "2.0.0"' config.yaml
```

### 4. Add/Delete Fields

```bash
# Add new field
echo 'name: Alice' | yq '.age = 30'
# Output:
# name: Alice
# age: 30

# Delete field
echo 'name: Alice
age: 30' | yq 'del(.age)'
# Output: name: Alice

# Delete array element
echo 'items: [a, b, c]' | yq 'del(.items[1])'
# Output: items: [a, c]
```

### 5. Arrays

```bash
# Append to array
echo 'items: [a, b]' | yq '.items += ["c"]'
# Output: items: [a, b, c]

# Prepend to array  
echo 'items: [b, c]' | yq '.items = ["a"] + .items'
# Output: items: [a, b, c]

# Get array length
echo 'items: [a, b, c]' | yq '.items | length'
# Output: 3

# Filter array
echo 'users:
  - name: Alice
    age: 30
  - name: Bob
    age: 20' | yq '.users[] | select(.age > 25)'
# Output:
# name: Alice
# age: 30
```

### 6. Merge YAML Files

```bash
# Merge two YAML files
yq eval-all '. as $item ireduce ({}; . * $item)' file1.yaml file2.yaml

# Simpler: merge operator
yq eval-all 'select(fileIndex == 0) * select(fileIndex == 1)' file1.yaml file2.yaml

# Merge with priority (file2 overrides file1)
yq eval-all 'select(fileIndex == 0) * select(fileIndex == 1)' file1.yaml file2.yaml
```

## Common Patterns

### Extract Single Value
```bash
# ❌ Python/grep way
grep "version:" config.yaml | cut -d: -f2 | tr -d ' '

# ✅ yq way
yq -r '.version' config.yaml
```

### Check if Field Exists
```bash
# Exit status 0 if field exists and is non-null
yq -e '.database.host' config.yaml > /dev/null && echo "exists"

# Get with default value
yq '.database.host // "localhost"' config.yaml
```

### Update Value In Place
```bash
# Update version in package.yaml
yq -i '.version = "2.0.0"' package.yaml

# Update nested value
yq -i '.database.password = env(DB_PASSWORD)' config.yaml

# Update multiple fields
yq -i '.version = "2.0.0" | .updated = now' config.yaml
```

### Iterate Over Array
```bash
# Get all container names from docker-compose.yml
yq '.services | keys | .[]' docker-compose.yml

# Get all image names
yq '.services[].image' docker-compose.yml

# With processing
yq '.services | to_entries | .[] | .key + ":" + .value.image' docker-compose.yml
```

### Filter YAML
```bash
# Select services with specific image
yq '.services | to_entries | .[] | select(.value.image == "nginx")' docker-compose.yml

# Get services with ports exposed
yq '.services | to_entries | .[] | select(.value.ports) | .key' docker-compose.yml

# Filter array by condition
yq '.users[] | select(.active == true)' users.yaml
```

### Convert YAML to JSON
```bash
# YAML to JSON
yq -o json '.' config.yaml

# Pretty JSON
yq -o json -P '.' config.yaml

# JSON to YAML
yq -P '.' config.json

# Compact JSON (no pretty print)
yq -o json -I=0 '.' config.yaml
```

### Work with Environment Variables
```bash
# Use env variable in expression
yq '.database.host = env(DB_HOST)' config.yaml

# Set from env var
DB_PASSWORD="secret123" yq -i '.database.password = env(DB_PASSWORD)' config.yaml

# Multiple env vars
yq '.host = env(HOST) | .port = env(PORT)' config.yaml
```

## Docker Compose Examples

### Read Docker Compose Values
```yaml
# docker-compose.yml
version: '3.8'
services:
  web:
    image: nginx:latest
    ports:
      - "8080:80"
  db:
    image: postgres:14
    environment:
      POSTGRES_PASSWORD: secret
```

```bash
# Get service names
yq '.services | keys | .[]' docker-compose.yml
# Output: web db

# Get web service image
yq '.services.web.image' docker-compose.yml
# Output: nginx:latest

# Get all images
yq '.services[].image' docker-compose.yml
# Output: nginx:latest postgres:14

# Get exposed port
yq '.services.web.ports[0]' docker-compose.yml
# Output: "8080:80"

# Get database password
yq '.services.db.environment.POSTGRES_PASSWORD' docker-compose.yml
# Output: secret
```

### Modify Docker Compose
```bash
# Update image version
yq -i '.services.web.image = "nginx:alpine"' docker-compose.yml

# Add new service
yq -i '.services.redis = {"image": "redis:latest"}' docker-compose.yml

# Add environment variable
yq -i '.services.web.environment.API_KEY = "xyz123"' docker-compose.yml

# Add port mapping
yq -i '.services.web.ports += ["443:443"]' docker-compose.yml

# Remove service
yq -i 'del(.services.redis)' docker-compose.yml
```

## Kubernetes Examples

### Read Kubernetes Manifests
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    spec:
      containers:
      - name: nginx
        image: nginx:1.14.2
        ports:
        - containerPort: 80
```

```bash
# Get deployment name
yq '.metadata.name' deployment.yaml
# Output: nginx-deployment

# Get replica count
yq '.spec.replicas' deployment.yaml
# Output: 3

# Get container image
yq '.spec.template.spec.containers[0].image' deployment.yaml
# Output: nginx:1.14.2

# Get all container names
yq '.spec.template.spec.containers[].name' deployment.yaml
# Output: nginx

# Get container port
yq '.spec.template.spec.containers[0].ports[0].containerPort' deployment.yaml
# Output: 80
```

### Modify Kubernetes Manifests
```bash
# Update image version
yq -i '.spec.template.spec.containers[0].image = "nginx:1.21"' deployment.yaml

# Scale replicas
yq -i '.spec.replicas = 5' deployment.yaml

# Add resource limits
yq -i '.spec.template.spec.containers[0].resources.limits.memory = "256Mi"' deployment.yaml

# Add label
yq -i '.metadata.labels.environment = "production"' deployment.yaml

# Add environment variable to container
yq -i '.spec.template.spec.containers[0].env += [{"name": "DEBUG", "value": "true"}]' deployment.yaml
```

## GitLab CI Examples

### Read .gitlab-ci.yml
```yaml
# .gitlab-ci.yml
stages:
  - build
  - test
  - deploy

build:
  stage: build
  script:
    - docker build -t myapp .
  
test:
  stage: test
  script:
    - pytest
  
deploy:
  stage: deploy
  script:
    - kubectl apply -f deployment.yaml
  only:
    - main
```

```bash
# Get all stages
yq '.stages[]' .gitlab-ci.yml
# Output: build test deploy

# Get build script
yq '.build.script[]' .gitlab-ci.yml
# Output: docker build -t myapp .

# Get job names
yq 'keys | .[] | select(. != "stages")' .gitlab-ci.yml
# Output: build test deploy

# Get jobs for specific stage
yq '. | to_entries | .[] | select(.value.stage? == "test") | .key' .gitlab-ci.yml
# Output: test

# Get deploy conditions
yq '.deploy.only[]' .gitlab-ci.yml
# Output: main
```

### Modify .gitlab-ci.yml
```bash
# Add new stage
yq -i '.stages += ["security"]' .gitlab-ci.yml

# Update script
yq -i '.build.script[0] = "docker build -t myapp:latest ."' .gitlab-ci.yml

# Add new job
yq -i '.security = {"stage": "security", "script": ["trivy scan"]}' .gitlab-ci.yml

# Add tags to job
yq -i '.build.tags = ["docker", "linux"]' .gitlab-ci.yml

# Add cache configuration
yq -i '.build.cache = {"paths": ["node_modules/"]}' .gitlab-ci.yml
```

## Advanced Patterns

### Conditionals
```bash
# Conditionals (yq v4+ uses select)
# Select if condition is true
echo 'status: active' | yq 'select(.status == "active") | "running"'
# Output: running

# Alternative/default with //
echo 'value: null' | yq '.value // "default"'
# Output: default

# Boolean check
echo 'enabled: true' | yq '.enabled == true'
# Output: true

# Multiple conditions with and/or
echo 'env: prod
replicas: 5' | yq 'select(.env == "prod" and .replicas > 3) | "scaled"'
# Output: scaled
```

### Loop and Map
```bash
# Map over array
echo 'items: [1, 2, 3]' | yq '.items | map(. * 2)'
# Output: [2, 4, 6]

# Map with select
echo 'users:
  - name: Alice
    age: 30
  - name: Bob
    age: 20' | yq '[.users[] | select(.age > 25) | .name]'
# Output: [Alice]

# Transform object keys
yq '.services | to_entries | map({"service": .key, "image": .value.image})' docker-compose.yml
```

### String Operations
```bash
# String concatenation
echo 'first: Alice
last: Smith' | yq '.first + " " + .last'
# Output: Alice Smith

# String interpolation
echo 'name: Alice' | yq '"Hello, \(.name)!"'
# Output: Hello, Alice!

# Split string
echo 'path: /usr/local/bin' | yq '.path | split("/")'
# Output: ["", "usr", "local", "bin"]

# Join array
echo 'parts: [usr, local, bin]' | yq '.parts | join("/")'
# Output: usr/local/bin

# String contains
echo 'url: https://example.com' | yq '.url | contains("https")'
# Output: true

# Regex test
echo 'email: alice@example.com' | yq '.email | test("@")'
# Output: true

# Regex match
echo 'version: v1.2.3' | yq '.version | capture("v(?<major>\\d+)\\.(?<minor>\\d+)")'
# Output: {major: "1", minor: "2"}
```

### Sort and Group
```bash
# Sort array
echo 'items: [3, 1, 2]' | yq '.items | sort'
# Output: [1, 2, 3]

# Sort by field
echo 'users:
  - name: Bob
    age: 30
  - name: Alice
    age: 25' | yq '.users | sort_by(.name)'

# Group by field
echo 'users:
  - name: Alice
    dept: IT
  - name: Bob
    dept: HR
  - name: Carol
    dept: IT' | yq 'group_by(.dept)'
```

### Multiple Documents
```bash
# YAML files can have multiple documents separated by ---
echo '---
name: Alice
---
name: Bob' | yq '.'

# Select specific document (0-indexed)
echo '---
name: Alice
---
name: Bob' | yq 'select(documentIndex == 0)'
# Output: name: Alice

# Process all documents
echo '---
name: Alice
---
name: Bob' | yq '.name'
# Output: Alice Bob
```

## Shell Script Integration

### Assign to Shell Variable
```bash
# Extract value
VERSION=$(yq -r '.version' config.yaml)
echo "Version: $VERSION"

# With default
DB_HOST=$(yq -r '.database.host // "localhost"' config.yaml)

# Check if empty
IMAGE=$(yq -r '.services.web.image' docker-compose.yml)
if [ -z "$IMAGE" ]; then
    echo "No image specified"
fi
```

### Exit Status for Conditionals
```bash
# yq -e exits with 0 if output is not null/false
if yq -e '.production' config.yaml > /dev/null 2>&1; then
    echo "Production config found"
fi

# Check if field exists
if yq -e '.database.password' config.yaml > /dev/null 2>&1; then
    echo "Database password is set"
else
    echo "Warning: No database password configured"
fi

# Check if array is not empty
if yq -e '.services | length > 0' docker-compose.yml > /dev/null 2>&1; then
    echo "Services defined"
fi
```

### Process Each Line
```bash
# Get all service names and process
yq -r '.services | keys | .[]' docker-compose.yml | while read -r service; do
    echo "Processing service: $service"
    image=$(yq -r ".services.$service.image" docker-compose.yml)
    echo "  Image: $image"
done
```

### Build YAML from Shell Variables
```bash
SERVICE_NAME="web"
IMAGE_NAME="nginx:alpine"
PORT="8080"

# Create new YAML
yq -n ".services.$SERVICE_NAME.image = \"$IMAGE_NAME\" | 
       .services.$SERVICE_NAME.ports = [\"$PORT:80\"]"

# Output:
# services:
#   web:
#     image: nginx:alpine
#     ports:
#       - "8080:80"

# Update existing file with variables
yq -i ".services.$SERVICE_NAME.image = \"$IMAGE_NAME\"" docker-compose.yml
```

### Read Multiple Fields
```bash
# Read into array
mapfile -t IMAGES < <(yq -r '.services[].image' docker-compose.yml)
echo "Found ${#IMAGES[@]} images: ${IMAGES[@]}"

# Read key-value pairs
while IFS=$'\t' read -r service image; do
    echo "Service $service uses image $image"
done < <(yq -r '.services | to_entries | .[] | [.key, .value.image] | @tsv' docker-compose.yml)
```

## Common Use Cases

### Update CI/CD Configuration
```bash
# Update Docker image in GitLab CI
yq -i '.build.script[0] = "docker build -t myapp:v2 ."' .gitlab-ci.yml

# Add deployment environment
yq -i '.deploy.environment.name = "production"' .gitlab-ci.yml

# Update runner tags
yq -i '.test.tags = ["docker", "linux"]' .gitlab-ci.yml
```

### Manage Kubernetes Resources
```bash
# Scale deployment
yq -i '.spec.replicas = 5' deployment.yaml

# Update image across multiple deployments
for file in deployments/*.yaml; do
    yq -i '.spec.template.spec.containers[0].image = "myapp:v2.0"' "$file"
done

# Add sidecar container
yq -i '.spec.template.spec.containers += [{"name": "sidecar", "image": "envoy:latest"}]' deployment.yaml
```

### Docker Compose Management
```bash
# Update all service images
for service in $(yq -r '.services | keys | .[]' docker-compose.yml); do
    current_image=$(yq -r ".services.$service.image" docker-compose.yml)
    new_image="${current_image%:*}:latest"
    yq -i ".services.$service.image = \"$new_image\"" docker-compose.yml
done

# Add health check to service
yq -i '.services.web.healthcheck = {
    "test": ["CMD", "curl", "-f", "http://localhost"],
    "interval": "30s",
    "timeout": "10s",
    "retries": 3
}' docker-compose.yml
```

### Configuration Management
```bash
# Merge environment-specific configs
yq eval-all 'select(fileIndex == 0) * select(fileIndex == 1)' \
    config/base.yaml config/production.yaml > config/final.yaml

# Extract secrets for validation
yq -r '.. | select(tag == "!!str") | select(. == "*secret*" or . == "*password*")' config.yaml

# Validate required fields
required_fields=("database.host" "database.port" "api.key")
for field in "${required_fields[@]}"; do
    if ! yq -e ".$field" config.yaml > /dev/null 2>&1; then
        echo "Error: Required field $field is missing"
        exit 1
    fi
done
```

### Extract and Transform Data
```bash
# Convert Kubernetes deployment to simple JSON summary
yq -o json '{
    "name": .metadata.name,
    "replicas": .spec.replicas,
    "image": .spec.template.spec.containers[0].image
}' deployment.yaml

# Create table from YAML
echo "Service | Image | Ports"
echo "--------|-------|------"
yq -r '.services | to_entries | .[] | 
    "\(.key) | \(.value.image) | \(.value.ports[0] // "none")"' docker-compose.yml
```

## Best Practices

### 1. Use Raw Output for Shell Variables
```bash
# ❌ Bad - includes YAML formatting
VERSION=$(yq '.version' config.yaml)
echo "$VERSION"  # Could have extra formatting

# ✅ Good - raw output
VERSION=$(yq -r '.version' config.yaml)
echo "$VERSION"  # Clean string
```

### 2. Always Use In-Place with Backup
```bash
# ❌ Risky - no backup
yq -i '.version = "2.0"' config.yaml

# ✅ Good - backup first
cp config.yaml config.yaml.bak
yq -i '.version = "2.0"' config.yaml

# Or use shell backup
cp config.yaml{,.bak} && yq -i '.version = "2.0"' config.yaml
```

### 3. Handle Missing Fields
```bash
# ❌ Bad - will error if field doesn't exist
yq '.database.password' config.yaml

# ✅ Good - use // for default
yq '.database.password // "not-set"' config.yaml

# ✅ Good - use -e for existence check
if yq -e '.database.password' config.yaml > /dev/null 2>&1; then
    echo "Password is configured"
fi
```

### 4. Quote Field Names with Special Characters
```bash
# Field with dots or special chars
yq '.["api.key"]' config.yaml

# Field with spaces
yq '.["first name"]' config.yaml

# Or use bracket notation consistently
yq '.services["my-app"].image' docker-compose.yml
```

### 5. Preserve Comments
```bash
# yq preserves comments by default
# This is a key feature over other YAML parsers

# Original file with comments:
# version: "3.8"  # Docker Compose version
# services:
#   web:
#     image: nginx  # Web server

# After modification, comments are preserved:
yq -i '.services.web.ports = ["80:80"]' docker-compose.yml
```

### 6. Validate YAML Before Processing
```bash
# Check if valid YAML
if yq -e '.' config.yaml > /dev/null 2>&1; then
    echo "Valid YAML"
else
    echo "Invalid YAML"
    exit 1
fi

# Or use eval (more strict)
yq eval '.' config.yaml > /dev/null 2>&1 || { echo "Invalid YAML"; exit 1; }
```

## Debugging

### Check Expression Output
```bash
# Test expression on simple data
echo 'name: Alice' | yq '.name'

# Pretty print to see structure
yq -P '.' config.yaml

# Output as JSON for clarity
yq -o json '.' config.yaml
```

### Common Errors

**"Error: bad file"**
```bash
# Problem: File doesn't exist or is not valid YAML
yq '.field' nonexistent.yaml

# Solution: Check file exists and is valid
test -f config.yaml && yq -e '.' config.yaml > /dev/null
```

**"Error: Pipe is not a valid function"**
```bash
# Problem: Wrong yq version (Python yq)
# Check version
yq --version

# Should show: yq (https://github.com/mikefarah/yq/)
# NOT: yq 3.x.x (Python)
```

**"Document is empty"**
```bash
# Problem: Empty YAML file
# Solution: Check file content or create default
if [ ! -s config.yaml ]; then
    echo '{}' > config.yaml
fi
```

## Comparison: yq vs Other Tools

| Task | Python/PyYAML | yq |
|------|---------------|-----|
| Read field | `python3 -c "import yaml; print(yaml.safe_load(open('f.yaml'))['name'])"` | `yq -r '.name' f.yaml` |
| Update field | Python script | `yq -i '.name = "Bob"' f.yaml` |
| Preserve comments | ❌ Lost | ✅ Preserved |
| Speed | ~50ms | ~5ms |
| Dependencies | Python + PyYAML | yq binary |
| YAML to JSON | Python script | `yq -o json '.' f.yaml` |

## Quick Reference

### Most Common Commands

```bash
# Read value
yq -r '.field' file.yaml

# Update value
yq -i '.field = "value"' file.yaml

# Add field
yq -i '.newfield = "value"' file.yaml

# Delete field
yq -i 'del(.field)' file.yaml

# Array operations
yq '.array[]' file.yaml                    # All elements
yq '.array[0]' file.yaml                   # First element
yq -i '.array += ["item"]' file.yaml       # Append

# Filter
yq '.items[] | select(.active == true)' file.yaml

# Convert
yq -o json '.' file.yaml                   # YAML to JSON
yq -P '.' file.json                        # JSON to YAML

# Merge files
yq eval-all 'select(fileIndex == 0) * select(fileIndex == 1)' f1.yaml f2.yaml

# With default
yq '.field // "default"' file.yaml

# Check existence
yq -e '.field' file.yaml > /dev/null

# Count
yq '.array | length' file.yaml

# Sort
yq '.items | sort_by(.name)' file.yaml
```

### Common Patterns Cheat Sheet

```bash
# Docker Compose
yq '.services | keys | .[]' docker-compose.yml              # Service names
yq '.services.web.image' docker-compose.yml                 # Service image
yq -i '.services.web.image = "nginx:alpine"' docker-compose.yml  # Update image

# Kubernetes
yq '.metadata.name' deployment.yaml                         # Deployment name
yq '.spec.replicas' deployment.yaml                         # Replica count
yq -i '.spec.replicas = 5' deployment.yaml                  # Scale
yq '.spec.template.spec.containers[0].image' deployment.yaml # Container image

# GitLab CI
yq '.stages[]' .gitlab-ci.yml                               # All stages
yq '.build.script[]' .gitlab-ci.yml                         # Build scripts
yq -i '.build.tags = ["docker"]' .gitlab-ci.yml             # Add tags

# Generic
yq -r '.database.host // "localhost"' config.yaml           # With default
yq -i '.version = env(VERSION)' config.yaml                 # From env var
yq '.users[] | select(.active)' users.yaml                  # Filter array
```

## Cross-References

Related skills:
- **jq**: [../jq/SKILL.md](../jq/SKILL.md) - JSON processing (similar syntax)
- **Docker**: [../docker/SKILL.md](../docker/SKILL.md) - Docker Compose files
- **GitLab CI**: [../gitlab-ci/SKILL.md](../gitlab-ci/SKILL.md) - CI/CD configuration
- **Kubernetes**: Use yq for manifest manipulation
- **General**: [../general/SKILL.md](../general/SKILL.md) - When to use yq vs Python
