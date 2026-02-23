---
name: mq
description: Markdown Query Language CLI for extracting, filtering, and processing markdown content with a jq-like syntax. Use when needing to extract headings, code blocks, links, tables, or other markdown elements from files - especially when filtering by attributes (e.g. code blocks by language, headings by depth). Perfect for analyzing documentation, extracting code examples, building indexes, or processing multiple markdown files efficiently.
---

# mq - Markdown Query Language

A jq-like CLI for querying and filtering markdown AST nodes.
Repository available at https://github.com/harehare/mq

## Core Selectors

| Selector | Description |
|---|---|
| `.h`, `.h1`–`.h6` | Headings (any level or specific) |
| `.code` | Fenced code blocks |
| `.code_inline` | Inline code (backticks) |
| `.link` | Links |
| `.image` | Images |
| `.text` | Text nodes |
| `.strong` | Bold |
| `.emphasis` | Italic |
| `.blockquote` | Blockquotes |
| `.list` | List items |
| `.table` | Tables |
| `.yaml` | YAML frontmatter |
| `.toml` | TOML frontmatter |

## Node Attributes

Access with dot notation: `selector.attribute`

| Selector | Attributes |
|---|---|
| `.h` | `.depth` / `.level` (1–6), `.value` |
| `.code` | `.lang`, `.value`, `.meta`, `.fence` |
| `.code_inline` | `.value` |
| `.link` | `.url`, `.title`, `.value` |
| `.image` | `.url`, `.alt`, `.title` |
| `.list` | `.ordered`, `.checked`, `.level`, `.index` |
| `.table` | `.row`, `.column`, `.align` |

## Basic Usage

```bash
# Extract all headings
mq '.h' file.md

# H2 headings only
mq '.h2' file.md

# All code blocks
mq '.code' file.md

# All links
mq '.link' file.md

# Tables
mq '.table' file.md
```

## Output Formats

```bash
mq '.code' file.md               # markdown (default)
mq -F text '.code' file.md       # plain text - best for code content
mq -F json '.h' file.md          # JSON - best for parsing/analysis
mq -F html '.h' file.md          # HTML output
```

## Filtering with `select()`

`select()` is the primary filter mechanism. When the condition uses a node attribute, the selector is implicit:

```bash
# Code blocks by language
mq 'select(.code.lang == "typescript")' file.md
mq 'select(.code.lang == "bash")' file.md
mq 'select(.code.lang != "bash")' file.md   # exclude a language

# Headings by depth
mq 'select(.h.depth <= 2)' file.md          # H1 and H2 only
mq 'select(.h.depth == 3)' file.md          # H3 only

# Filter then extract attribute
mq 'select(.code.lang == "python") | .code.value' file.md
mq 'select(.h.depth == 2) | .h.value' file.md
```

## Filtering with `contains()` and `starts_with()`

```bash
# Heading containing a word
mq '.h | select(contains("Installation"))' file.md

# Link URL containing a domain
mq '.link | select(contains("github"))' file.md

# Code block containing specific content
mq 'select(.code) | select(contains("TODO"))' file.md

# Heading starting with prefix
mq '.h | select(starts_with("How"))' file.md
```

## Combining Selectors

```bash
# H1 or H2 (logical or)
mq 'select(or(.h1, .h2))' file.md

# Node is heading AND level 2 (logical and)
mq 'select(and(.h, .h2))' file.md
```

## Extracting Attribute Values

```bash
# Get all heading text
mq '.h.value' file.md

# Get all code languages used
mq '.code.lang' file.md

# Get all link URLs
mq '.link.url' file.md

# Get image alt texts
mq '.image.alt' file.md

# Get raw code content (no fences)
mq '.code.value' file.md
# or equivalently:
mq -F text '.code' file.md
```

## Multi-File Processing

```bash
# All headings across files
mq '.h' docs/**/*.md

# H1 from all Pi skills
mq '.h1' ~/.pi/agent/skills/*/SKILL.md

# Aggregate all code into single array
mq -A '.code' examples/*.md
```

## String Functions

```bash
mq '.h.value | upcase' file.md
mq '.h.value | downcase' file.md
mq '.code.value | replace("old", "new")' file.md
mq '.link.url | starts_with("https")' file.md
mq '.link.url | ends_with(".org")' file.md
mq '.h.value | split(" ")' file.md
```

## Custom Functions with `def`

```bash
# Define reusable filter
mq 'def is_lang(l): .lang == l; | select(.code) | select(is_lang("typescript"))' file.md
```

## In-place Update with `-U`

Remove or transform nodes in the file:

```bash
# Remove all bash code blocks from file
mq -U 'select(.code.lang != "bash")' file.md

# Keep only H1 and H2 headings
mq -U 'select(or(.h1, .h2))' file.md
```

## Practical Pi Agent Patterns

```bash
# Get all section titles (H2) from a skill
mq '.h2.value' ~/.pi/agent/skills/python/SKILL.md

# Get all code examples in a specific language
mq 'select(.code.lang == "bash") | .code.value' SKILL.md

# Extract all external links from docs
mq '.link.url' README.md

# Inspect code block structure
mq -F json '.code' file.md

# Check what languages are used in a doc
mq '.code.lang' file.md

# Find headings matching a topic
mq '.h | select(contains("Docker"))' SKILL.md

# Extract YAML frontmatter
mq '.yaml' SKILL.md
```

## Tips

- Use `select(.node.attr == val)` for filtering — the node selector is implicit in the condition
- Use `-F json` first to explore node structure when unsure of available attributes
- Use `-F text` for clean code extraction without fences
- Pipe `mq` output to standard tools: `mq '.code.lang' file.md | sort | uniq -c`
- For complex transformations, extract to JSON then pipe to `jq`
