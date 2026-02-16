---
name: jq
description: Comprehensive guide for parsing and manipulating JSON using jq
---

# jq - JSON Processing - Agent Usage Guide

## Core Concept
`jq` is a lightweight and flexible command-line JSON processor. Use it instead of Python for JSON parsing in shell scripts for better performance and simpler syntax.

## Why Use jq Over Python

**Advantages:**
- ✅ **Faster** - Native C implementation, no interpreter startup
- ✅ **Simpler** - No need for try/except or import statements
- ✅ **Streaming** - Can process large JSON files efficiently
- ✅ **Built for pipes** - Perfect for shell script workflows
- ✅ **Compact** - One-liner instead of multi-line Python

**When to Use Python Instead:**
- Complex data transformations requiring multiple steps
- Need access to Python libraries
- Already in a Python script context

## Basic Syntax

### General Form
```bash
jq [options] 'filter' [file...]
```

**Common Options:**
- `-r` / `--raw-output` - Output raw strings (no quotes)
- `-c` / `--compact-output` - Compact instead of pretty-printed
- `-e` / `--exit-status` - Exit with status based on output (0 if non-null/non-false)
- `-n` / `--null-input` - Don't read input, useful with --arg
- `-s` / `--slurp` - Read entire input as single array
- `-M` / `--monochrome-output` - No colors

### Input/Output
```bash
# From stdin
echo '{"name":"Alice"}' | jq '.name'

# From file
jq '.name' data.json

# From command output
curl -s https://api.example.com/data | jq '.results[]'
```

## Essential Filters

### 1. Identity and Pretty Print
```bash
# Pretty print (identity filter)
echo '{"a":1,"b":2}' | jq '.'

# Compact output
echo '{"a": 1, "b": 2}' | jq -c '.'
```

### 2. Object Field Access
```bash
# Simple field
echo '{"name":"Alice","age":30}' | jq '.name'
# Output: "Alice"

# Nested field
echo '{"user":{"name":"Alice"}}' | jq '.user.name'
# Output: "Alice"

# Optional field (returns null if missing)
echo '{"name":"Alice"}' | jq '.age?'
# Output: null

# Alternative syntax
echo '{"name":"Alice"}' | jq '.["name"]'
# Output: "Alice"
```

### 3. Array Access
```bash
# First element
echo '[1,2,3]' | jq '.[0]'
# Output: 1

# Last element
echo '[1,2,3]' | jq '.[-1]'
# Output: 3

# Slice
echo '[1,2,3,4,5]' | jq '.[1:3]'
# Output: [2,3]

# All elements
echo '[1,2,3]' | jq '.[]'
# Output: 1 2 3 (three separate outputs)
```

### 4. Array of Objects
```bash
# Get all names
echo '[{"name":"Alice"},{"name":"Bob"}]' | jq '.[].name'
# Output: "Alice" "Bob"

# First object's name
echo '[{"name":"Alice"},{"name":"Bob"}]' | jq '.[0].name'
# Output: "Alice"
```

### 5. Raw Output (No Quotes)
```bash
# With quotes
echo '{"name":"Alice"}' | jq '.name'
# Output: "Alice"

# Without quotes (raw)
echo '{"name":"Alice"}' | jq -r '.name'
# Output: Alice
```

## Common Patterns

### Extract Single Value
```bash
# ❌ Python way
python3 -c "import sys, json; print(json.load(sys.stdin)['name'])"

# ✅ jq way
jq -r '.name'
```

### Extract from Array (First Match)
```bash
# ❌ Python way
python3 -c "import sys, json; data = json.load(sys.stdin); print(data['results'][0]['id'] if data.get('results') else '')"

# ✅ jq way
jq -r '.results[0].id // empty'
```

### Check if Field Exists
```bash
# Exit status 0 if field exists and is non-null
echo '{"name":"Alice"}' | jq -e '.name' > /dev/null && echo "exists"

# Check and use default
echo '{}' | jq -r '.name // "default"'
# Output: default
```

### Iterate Over Array
```bash
# Process each element
echo '[{"id":1},{"id":2}]' | jq -r '.[] | .id'
# Output: 1 2

# With index
echo '["a","b","c"]' | jq -r 'to_entries[] | "\(.key): \(.value)"'
# Output: 0: a  1: b  2: c
```

### Filter Array
```bash
# Select objects where age > 25
echo '[{"name":"Alice","age":30},{"name":"Bob","age":20}]' | jq '.[] | select(.age > 25)'
# Output: {"name":"Alice","age":30}

# Get just the names
echo '[{"name":"Alice","age":30},{"name":"Bob","age":20}]' | jq -r '.[] | select(.age > 25) | .name'
# Output: Alice
```

### Map Over Array
```bash
# Extract field from all objects
echo '[{"name":"Alice"},{"name":"Bob"}]' | jq '[.[].name]'
# Output: ["Alice","Bob"]

# Using map function
echo '[{"name":"Alice"},{"name":"Bob"}]' | jq 'map(.name)'
# Output: ["Alice","Bob"]
```

### Count Elements
```bash
# Count array elements
echo '[1,2,3]' | jq 'length'
# Output: 3

# Count object keys
echo '{"a":1,"b":2}' | jq 'length'
# Output: 2
```

### Sort
```bash
# Sort array
echo '[3,1,2]' | jq 'sort'
# Output: [1,2,3]

# Sort by field
echo '[{"name":"Bob"},{"name":"Alice"}]' | jq 'sort_by(.name)'
# Output: [{"name":"Alice"},{"name":"Bob"}]

# Reverse sort
echo '[{"age":30},{"age":20}]' | jq 'sort_by(.age) | reverse'
```

### Group and Aggregate
```bash
# Group by field
echo '[{"type":"A","val":1},{"type":"A","val":2},{"type":"B","val":3}]' | \
  jq 'group_by(.type)'

# Max/Min
echo '[{"age":30},{"age":20},{"age":25}]' | jq 'max_by(.age)'
echo '[{"age":30},{"age":20},{"age":25}]' | jq 'min_by(.age)'
```

## Advanced Filters

### Conditionals
```bash
# If-then-else
echo '{"status":"active"}' | jq 'if .status == "active" then "yes" else "no" end'
# Output: "yes"

# Ternary-like with //
echo '{"value":null}' | jq '.value // "default"'
# Output: "default"
```

### Pipe Chains
```bash
# Multiple operations
echo '[{"name":"Alice","age":30},{"name":"Bob","age":20}]' | \
  jq '.[] | select(.age > 25) | .name' | \
  jq -r '.'
# Output: Alice

# Or in one jq call
echo '[{"name":"Alice","age":30},{"name":"Bob","age":20}]' | \
  jq -r '.[] | select(.age > 25) | .name'
```

### String Operations
```bash
# String interpolation
echo '{"first":"Alice","last":"Smith"}' | jq -r '"\(.first) \(.last)"'
# Output: Alice Smith

# Split string
echo '{"path":"a/b/c"}' | jq '.path | split("/")'
# Output: ["a","b","c"]

# Join array
echo '["a","b","c"]' | jq 'join("/")'
# Output: "a/b/c"

# String contains
echo '{"text":"hello world"}' | jq '.text | contains("world")'
# Output: true

# String starts/ends with
echo '{"url":"https://example.com"}' | jq '.url | startswith("https")'
# Output: true
```

### Type Checking
```bash
# Check type
echo '{"value":123}' | jq '.value | type'
# Output: "number"

# Select by type
echo '[1,"two",3]' | jq '.[] | select(type == "number")'
# Output: 1 3
```

### Construct New Objects
```bash
# Build object from fields
echo '{"firstName":"Alice","lastName":"Smith"}' | \
  jq '{name: "\(.firstName) \(.lastName)", source: "api"}'
# Output: {"name":"Alice Smith","source":"api"}

# Rename fields
echo '{"old_name":"value"}' | jq '{new_name: .old_name}'
# Output: {"new_name":"value"}
```

### Error Handling
```bash
# Use // for default value
echo '{}' | jq -r '.missing // "default"'
# Output: default

# Use ? to suppress errors
echo '{"value":null}' | jq '.value.nested?'
# Output: null (no error)

# Without ?, would error
echo '{"value":null}' | jq '.value.nested' 2>&1
# Error: Cannot index null
```

### Multiple Outputs to Array
```bash
# Collect multiple values
echo '{"a":1,"b":2,"c":3}' | jq '[.a, .b, .c]'
# Output: [1,2,3]

# Array from iterations
echo '{"items":[1,2,3]}' | jq '[.items[] | . * 2]'
# Output: [2,4,6]
```

## Variables and Arguments

### Pass Arguments
```bash
# Using --arg for strings
jq --arg name "Alice" '.user = $name' <<< '{}'
# Output: {"user":"Alice"}

# Using --argjson for JSON values
jq --argjson age 30 '.user.age = $age' <<< '{"user":{}}'
# Output: {"user":{"age":30}}

# Multiple arguments
jq --arg key "name" --arg val "Alice" '.[$key] = $val' <<< '{}'
# Output: {"name":"Alice"}
```

### Variables in Scripts
```bash
# Assign and reuse
echo '{"x":5}' | jq '.x as $original | .y = ($original * 2) | .z = ($original + 1)'
# Output: {"x":5,"y":10,"z":6}
```

## Shell Script Integration

### Assign to Shell Variable
```bash
# Extract single value
NAME=$(echo '{"name":"Alice"}' | jq -r '.name')
echo "Name: $NAME"

# Extract with default
ID=$(echo '{}' | jq -r '.id // "unknown"')

# Check if empty and handle
RESULT=$(echo '{"items":[]}' | jq -r '.items[0]? // empty')
if [ -z "$RESULT" ]; then
    echo "No items found"
fi
```

### Exit Status for Conditionals
```bash
# jq -e exits with 0 if output is not null/false
if echo '{"active":true}' | jq -e '.active' > /dev/null; then
    echo "Active is true"
fi

# Check if field exists
if echo '{"name":"Alice"}' | jq -e '.name' > /dev/null 2>&1; then
    echo "Name field exists"
fi

# Check if array is empty
if echo '{"items":[]}' | jq -e '.items | length > 0' > /dev/null; then
    echo "Has items"
else
    echo "No items"
fi
```

### Process Each Line
```bash
# When jq outputs multiple values
echo '[{"id":1},{"id":2},{"id":3}]' | jq -r '.[].id' | while read -r id; do
    echo "Processing ID: $id"
done
```

### Build JSON from Shell Variables
```bash
NAME="Alice"
AGE=30

# Using --arg
jq -n --arg name "$NAME" --argjson age $AGE '{name: $name, age: $age}'
# Output: {"name":"Alice","age":30}

# Multiple variables
jq -n \
  --arg name "$NAME" \
  --argjson age $AGE \
  --arg city "NYC" \
  '{name: $name, age: $age, city: $city}'
```

### Read Multiple Fields
```bash
# Read into array
IFS=$'\n' read -r -d '' -a NAMES < <(echo '[{"name":"Alice"},{"name":"Bob"}]' | jq -r '.[].name' && printf '\0')

# Or using mapfile
mapfile -t NAMES < <(echo '[{"name":"Alice"},{"name":"Bob"}]' | jq -r '.[].name')

echo "${NAMES[@]}"
# Output: Alice Bob
```

## Common Use Cases

### Parse API Response
```bash
# Get single field
LIBRARY_ID=$(curl -s "https://api.example.com/libraries" | jq -r '.results[0].id')

# Get with fallback
LIBRARY_ID=$(curl -s "https://api.example.com/libraries" | jq -r '.results[0].id // empty')

# Check for errors
RESPONSE=$(curl -s "https://api.example.com/data")
if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error.message')
    echo "API Error: $ERROR_MSG" >&2
    exit 1
fi
```

### Transform JSON Structure
```bash
# Flatten nested structure
echo '{"user":{"name":"Alice","age":30}}' | jq '{name: .user.name, age: .user.age}'

# Merge objects
echo '{"a":1}' | jq '. + {"b":2}'
# Output: {"a":1,"b":2}

# Remove fields
echo '{"a":1,"b":2,"c":3}' | jq 'del(.b)'
# Output: {"a":1,"c":3}
```

### Validate JSON
```bash
# Check if valid JSON
if echo '{"valid":true}' | jq empty 2>/dev/null; then
    echo "Valid JSON"
else
    echo "Invalid JSON"
fi

# Validate and pretty-print
cat data.json | jq '.' > formatted.json
```

### Format for Display
```bash
# Create table-like output
echo '[{"name":"Alice","age":30},{"name":"Bob","age":25}]' | \
  jq -r '.[] | "\(.name)\t\(.age)"'
# Output:
# Alice   30
# Bob     25

# With headers
echo '[{"name":"Alice","age":30}]' | \
  jq -r '["NAME","AGE"], (.[] | [.name, .age]) | @tsv'
```

### Search and Filter
```bash
# Find object by field value
echo '[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]' | \
  jq '.[] | select(.id == 2)'

# Case-insensitive search
echo '[{"name":"Alice"},{"name":"bob"}]' | \
  jq -r '.[] | select(.name | ascii_downcase | contains("alice")) | .name'

# Multiple conditions (AND)
echo '[{"name":"Alice","age":30},{"name":"Bob","age":20}]' | \
  jq '.[] | select(.age > 25 and .name == "Alice")'

# Multiple conditions (OR)
echo '[{"name":"Alice","age":30},{"name":"Bob","age":20}]' | \
  jq '.[] | select(.age > 25 or .name == "Bob")'
```

## Best Practices

### 1. Use Raw Output for Shell Variables
```bash
# ❌ Bad - includes quotes
NAME=$(echo '{"name":"Alice"}' | jq '.name')
echo "$NAME"  # Output: "Alice"

# ✅ Good - raw output
NAME=$(echo '{"name":"Alice"}' | jq -r '.name')
echo "$NAME"  # Output: Alice
```

### 2. Handle Missing Fields
```bash
# ❌ Bad - will error if field doesn't exist
jq '.results[0].id'

# ✅ Good - use ? for optional
jq '.results[0]?.id'

# ✅ Good - use // for default
jq '.results[0].id // "default"'

# ✅ Good - use empty to skip null results
jq -r '.results[0]?.id // empty'
```

### 3. Combine Filters Efficiently
```bash
# ❌ Bad - multiple jq calls
cat data.json | jq '.results' | jq '.[0]' | jq '.name'

# ✅ Good - single jq call
cat data.json | jq -r '.results[0].name'
```

### 4. Use -e for Exit Status
```bash
# ❌ Bad - doesn't check if value exists
RESULT=$(jq -r '.value' data.json)

# ✅ Good - check with -e
if RESULT=$(jq -er '.value' data.json 2>/dev/null); then
    echo "Found: $RESULT"
else
    echo "Not found"
fi
```

### 5. Quote Field Names with Special Characters
```bash
# Field with dots or special chars
echo '{"api.key":"value"}' | jq '.["api.key"]'

# Field with spaces
echo '{"first name":"Alice"}' | jq '.["first name"]'
```

### 6. Use Compact Output for Logging
```bash
# ✅ Good for logs - one line per entry
jq -c '.' data.json

# Pretty print for humans
jq '.' data.json
```

## Debugging

### Print Intermediate Values
```bash
# Use | debug to see intermediate results
echo '{"a":1}' | jq '. | debug | .a'

# Or just pretty-print at each stage
echo '{"user":{"name":"Alice"}}' | jq '.user' | jq '.name'
```

### Check Filter Syntax
```bash
# Test filter on simple data
echo '{}' | jq 'YOUR_FILTER_HERE'

# Use null input for testing
jq -n 'YOUR_FILTER_HERE'
```

### Common Errors

**"Cannot index TYPE with string KEY"**
```bash
# Problem: trying to access field on null/non-object
echo 'null' | jq '.field'

# Solution: use ?
echo 'null' | jq '.field?'
```

**"Cannot iterate over TYPE"**
```bash
# Problem: using .[] on non-array
echo '{"a":1}' | jq '.[]'

# Solution: check type or use to_entries for objects
echo '{"a":1}' | jq 'to_entries | .[] | "\(.key)=\(.value)"'
```

## Quick Reference

### Most Common Commands
```bash
# Extract field
jq -r '.field'

# First array element field
jq -r '.[0].field'

# All array elements field
jq -r '.[].field'

# With default value
jq -r '.field // "default"'

# Filter array
jq -r '.[] | select(.age > 25) | .name'

# Check existence (exit status)
jq -e '.field' > /dev/null

# Pretty print
jq '.'

# Compact
jq -c '.'

# Count
jq 'length'

# Sort by field
jq 'sort_by(.field)'
```

### Comparison: Python vs jq

| Task | Python | jq |
|------|--------|-----|
| Extract field | `python3 -c "import json,sys; print(json.load(sys.stdin)['name'])"` | `jq -r '.name'` |
| First array item | `python3 -c "import json,sys; print(json.load(sys.stdin)[0])"` | `jq '.[0]'` |
| Filter array | `python3 -c "import json,sys; print([x for x in json.load(sys.stdin) if x['age']>25])"` | `jq '[.[] | select(.age>25)]'` |
| Check field exists | Try/except block | `jq -e '.field' >/dev/null` |

## Cross-References

Related skills:
- **Context7**: [../context7/SKILL.md](../context7/SKILL.md) - Use jq for parsing API responses
- **GitLab CI**: [../gitlab-ci/SKILL.md](../gitlab-ci/SKILL.md) - Parse pipeline JSON
- **Docker**: [../docker/SKILL.md](../docker/SKILL.md) - Parse docker inspect output
- **General**: [../general/SKILL.md](../general/SKILL.md) - When to use jq vs Python
