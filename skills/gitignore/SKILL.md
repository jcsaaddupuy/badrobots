---
name: gitignore
description: "Generate .gitignore files for projects"
---

# GitIgnore Generation Skill

## Overview

This skill provides instructions for generating `.gitignore` files using the toptal.com gitignore API via curl commands.

## API Endpoints

- **Generate gitignore**: `https://www.toptal.com/developers/gitignore/api/{templates}`
- **List available templates**: `https://www.toptal.com/developers/gitignore/dropdown/templates.json`

## Usage

### Listing Available Templates

To see all available templates:

```bash
curl --silent https://www.toptal.com/developers/gitignore/dropdown/templates.json | jq -r '.[].id'
```

This will output template IDs like:
- python
- node
- java
- c
- vuejs
- go
- etc.

### Generating a .gitignore File

To generate a `.gitignore` file for specific technologies, use comma-separated template names:

```bash
curl 'https://www.toptal.com/developers/gitignore/api/python,c,vuejs'
```

### Examples

#### Single Technology

```bash
# Python project
curl 'https://www.toptal.com/developers/gitignore/api/python' > .gitignore

# Node.js project
curl 'https://www.toptal.com/developers/gitignore/api/node' > .gitignore
```

#### Multiple Technologies

```bash
# Python + Docker + VS Code
curl 'https://www.toptal.com/developers/gitignore/api/python,docker,visualstudiocode' > .gitignore

# Full-stack JavaScript project
curl 'https://www.toptal.com/developers/gitignore/api/node,vuejs,macos,linux,windows' > .gitignore
```

#### Search for Specific Templates

```bash
# Find all templates containing "python"
curl --silent https://www.toptal.com/developers/gitignore/dropdown/templates.json | jq -r '.[].id' | grep -i python

# Find templates for specific IDE
curl --silent https://www.toptal.com/developers/gitignore/dropdown/templates.json | jq -r '.[].id' | grep -i "vscode\|intellij\|eclipse"
```

## Best Practices

1. **Multiple technologies**: Always combine all relevant technologies in a single request (e.g., language + OS + IDE)
2. **Direct output**: Redirect output directly to `.gitignore` file using `>`
3. **Review before committing**: Always review the generated `.gitignore` before committing
4. **Case-insensitive**: Template names are case-insensitive (Python, python, PYTHON all work)
5. **Append mode**: Use `>>` if you need to add to an existing `.gitignore`

## Common Template Combinations

### Python Projects
```bash
curl 'https://www.toptal.com/developers/gitignore/api/python,venv,pycharm,visualstudiocode' > .gitignore
```

### Node.js Projects
```bash
curl 'https://www.toptal.com/developers/gitignore/api/node,npm,visualstudiocode' > .gitignore
```

### Go Projects
```bash
curl 'https://www.toptal.com/developers/gitignore/api/go,goland,visualstudiocode' > .gitignore
```

### Multi-platform Development
```bash
curl 'https://www.toptal.com/developers/gitignore/api/macos,linux,windows,visualstudiocode' > .gitignore
```

## Workflow

When asked to create a `.gitignore` file:

1. **Identify technologies**: Determine the programming language, frameworks, OS, and IDE being used
2. **Search templates** (if needed): Use the templates.json endpoint to find exact template names
3. **Generate file**: Combine all relevant templates in a single curl command
4. **Verify**: Confirm the file was created and contains expected patterns

## Notes

- The API is free and doesn't require authentication
- Templates are community-maintained on GitHub (github/gitignore)
- You can combine unlimited templates in a single request
- Invalid template names are silently ignored


