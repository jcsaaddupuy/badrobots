---
name: deepwiki
description: Extract comprehensive documentation from DeepWiki to generate custom skills. Use when user requests skill creation from DeepWiki documentation (e.g., "create a skill for FastAPI using deepwiki", "generate a Vue.js skill from deepwiki docs"). Searches 300+ indexed repositories via API, then uses mcporter to access DeepWiki MCP tools for documentation retrieval.
---

# DeepWiki Skill Generator

Extract comprehensive documentation from DeepWiki and generate custom skills for tools, frameworks, and libraries.

## Overview

DeepWiki (https://deepwiki.com/) provides AI-generated, navigable documentation for 300+ popular GitHub repositories. This skill enables you to:

1. **Search** for repositories in DeepWiki via API
2. **Fetch** documentation using mcporter MCP tools
3. **Generate** custom skills following skill-creator patterns

## Quick Start

### Generate a Skill from DeepWiki

```bash
# User request
"Create a skill for FastAPI using deepwiki"

# Workflow
1. Search DeepWiki API for "fastapi"
2. Select most appropriate match (by stars, recency, exact name)
3. Use mcporter to list available DeepWiki MCP tools
4. Call appropriate MCP tools to fetch documentation
5. Generate skill with SKILL.md + references/
```

## How It Works

### 1. Repository Search

Search the DeepWiki index for repositories:

```bash
# Search for a specific repository
SEARCH_TERM="fastapi"
RESULTS=$(bash -c "curl -s 'https://api.devin.ai/ada/list_public_indexes?search_repo=$SEARCH_TERM'")

# Select most appropriate match
# Priority: highest stars → most recent update → exact name match
BEST_MATCH=$(echo "$RESULTS" | jq -r '.indices | sort_by(-(.stargazers_count // 0), -(.last_modified // "")) | .[0]')
ORG=$(echo "$BEST_MATCH" | jq -r '.repo_name' | cut -d'/' -f1)
REPO=$(echo "$BEST_MATCH" | jq -r '.repo_name' | cut -d'/' -f2)
```

**API Response format:**
```json
{
  "indices": [
    {
      "id": "v1.9.9.5/PUBLIC/{org}/{repo}/{hash}",
      "repo_name": "{org}/{repo}",
      "last_modified": "2025-07-24T12:38:46.745692+00:00",
      "description": "...",
      "stargazers_count": 70369,
      "language": "JavaScript",
      "topics": ["tag1", "tag2"]
    }
  ],
  "needs_reindex": [],
  "pending_repos": []
}
```

**Handling no results:**
If repo not found in DeepWiki, inform user: "Repository not indexed in DeepWiki. Available similar repos: [list top 3 matches or inform unavailable]"

### 2. Discover DeepWiki MCP Tools

Use mcporter to list available tools from the DeepWiki MCP server:

```bash
# List all available DeepWiki MCP tools
npx mcporter list https://mcp.deepwiki.com/mcp
```

This will show available tools for fetching documentation. Use the appropriate tools to retrieve documentation for the selected repository.

### 3. Fetch Documentation

Use mcporter to call DeepWiki MCP tools with the repository information:

```bash
# Example: Call MCP tool to fetch documentation
# (Exact tool names and parameters depend on mcporter list output)
npx mcporter call https://mcp.deepwiki.com/mcp <tool-name> --args '{"org":"'$ORG'","repo":"'$REPO'"}'
```

### 4. Skill Generation

Generate skill following skill-creator patterns:

```
generated-skill/
├── SKILL.md (core workflow + quick start)
├── references/
│   ├── api.md (complete API reference)
│   ├── patterns.md (common usage patterns)
│   └── advanced.md (advanced features)
└── assets/
    └── (templates, examples if applicable)
```

**Section Priority for Skills:**
1. **SKILL.md content** (keep lean, <500 lines):
   - Overview/Introduction
   - Quick Start / Getting Started
   - Core Concepts
   - Common Patterns
   - Configuration Essentials

2. **references/ content** (detailed deep dives):
   - Complete API Reference
   - Advanced Features
   - Architecture Details
   - Examples & Patterns
   - Troubleshooting

**SKILL.md Structure:**
```markdown
---
name: [tool-name]
description: [What it does + when to use]
---

# [Tool Name]

## Quick Start
[Essential getting started info]

## Core Concepts
[Key ideas to understand]

## Common Patterns
[Most frequent use cases]

## Advanced Features
- See references/api.md for complete API
- See references/patterns.md for examples
- See references/advanced.md for deep dives
```

## Usage Patterns

### Pattern 1: Generate Skill from DeepWiki

```
User: "Create a skill for FastAPI using deepwiki"

Steps:
1. Search: bash -c "curl -s 'https://api.devin.ai/ada/list_public_indexes?search_repo=fastapi'"
2. Select: tiangolo/fastapi (highest stars)
3. List tools: npx mcporter list https://mcp.deepwiki.com/mcp
4. Fetch docs: npx mcporter call https://mcp.deepwiki.com/mcp <tool> --args '{"org":"tiangolo","repo":"fastapi"}'
5. Generate: Create skill with SKILL.md + references/
```

### Pattern 2: Handle Unavailable Repository

```
User: "Create a skill for my-private-lib using deepwiki"

Steps:
1. Search: bash -c "curl -s 'https://api.devin.ai/ada/list_public_indexes?search_repo=my-private-lib'"
2. Result: No matches found
3. Inform: "my-private-lib is not indexed in DeepWiki. 
   Available alternatives: [list similar repos if any]"
```

## Skill-Creator Integration

Generated skills follow skill-creator best practices:

- **Progressive disclosure:** SKILL.md stays lean (<500 lines), detailed content in references/
- **Concise instructions:** Only essential information in SKILL.md
- **Organized references:** Separate files by domain/feature
- **Clear navigation:** SKILL.md links to relevant references/
- **Practical examples:** Code examples preserved from DeepWiki docs

See `~/.pi/agent/skills/skill-creator/` for complete guidelines.

## Comparison with Context7

| Aspect | Context7 | DeepWiki |
|--------|----------|----------|
| Use Case | Code snippets, API examples | Architecture, comprehensive guides |
| Trigger | Automatic fallback | Explicit request only |
| Coverage | Most libraries | 300 top repos |
| Format | Snippets/chunks | Full wiki structure |
| Auth | API key required | Public access |
| Best For | Implementation details | Skill generation |

## Limitations & Notes

- **Coverage:** Only 300 most popular repositories indexed
- **Quality:** DeepWiki docs are AI-generated; quality varies by repo
- **Selection:** Multi-repo matches use automatic selection (stars → recency → name)
- **Errors:** Non-indexed repos inform user; no fallback to other sources

## Examples

### Example 1: FastAPI Skill

```
Request: "Create a FastAPI skill using deepwiki"

Generated skill structure:
fastapi-skill/
├── SKILL.md
│   - Quick Start (basic app setup)
│   - Core Concepts (routing, dependency injection)
│   - Common Patterns (middleware, error handling)
├── references/
│   ├── api.md (complete endpoint reference)
│   ├── patterns.md (authentication, validation, etc.)
│   └── advanced.md (background tasks, WebSockets, etc.)
└── assets/
    └── example-app.py (minimal FastAPI example)
```

### Example 2: Vue.js Skill

```
Request: "Generate a Vue skill from deepwiki"

Generated skill structure:
vue-skill/
├── SKILL.md
│   - Quick Start (component basics)
│   - Reactivity System
│   - Common Patterns
├── references/
│   ├── api.md (complete API reference)
│   ├── composition-api.md (modern Vue 3 patterns)
│   └── examples.md (real-world examples)
└── assets/
    └── hello-world.vue (minimal component)
```

## Troubleshooting

**Q: Repository not found in DeepWiki**
A: Only 300 most popular repos are indexed. Check if repo is in top 300 by stars on GitHub.

**Q: Documentation seems incomplete**
A: DeepWiki docs are AI-generated. Check the original GitHub repo for complete documentation.

**Q: mcporter command fails**
A: Ensure mcporter is installed: `npm install -g mcporter`. Check that the MCP server URL is correct.

## Quick Reference

### Search a Repository
```bash
bash -c "curl -s 'https://api.devin.ai/ada/list_public_indexes?search_repo=fastapi'" | jq '.indices[0]'
```

### List DeepWiki MCP Tools
```bash
npx mcporter list https://mcp.deepwiki.com/mcp
```

### Call DeepWiki MCP Tool
```bash
npx mcporter call https://mcp.deepwiki.com/mcp <tool-name> --args '{"org":"<org>","repo":"<repo>"}'
```
