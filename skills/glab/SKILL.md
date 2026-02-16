---
name: glab
description: Guide for using glab cli tool to interact with gitlab
---

# glab CLI - Agent Usage Guide

## Core Concept
`glab` is the GitLab CLI for interacting with GitLab instances. Use it for querying merge requests, issues, pipelines, projects, and executing GitLab API calls directly from the terminal.

## Decision Tree: Which glab command to use?

### When user asks about Merge Requests:
- **List MRs**: `glab mr list [filters]`
- **View specific MR**: `glab mr view <IID>`
- **Create MR**: `glab mr create`
- **Approve MR**: `glab mr approve <IID>`
- **Merge MR**: `glab mr merge <IID>`

### When user asks about Issues:
- **List issues**: `glab issue list [filters]`
- **View specific issue**: `glab issue view <IID>`
- **Create issue**: `glab issue create`
- **Close issue**: `glab issue close <IID>`

### When user asks about Pipelines:
- **List pipelines**: `glab pipeline list`
- **View pipeline**: `glab pipeline view <PIPELINE_ID>`
- **Retry pipeline**: `glab pipeline retry <PIPELINE_ID>`
- **Pipeline status**: `glab pipeline status`

### When user asks about Projects/Repos:
- **List projects**: `glab project list`
- **View current project**: `glab repo view`
- **Clone project**: `glab repo clone <owner/repo>`

### When high-level commands lack needed filters/fields:
- Use `glab api <endpoint>` to call GitLab REST API directly
- Returns JSON by default (machine-readable)

## Authentication Flow

**Before any glab command works:**
1. Check if authenticated: `glab auth status`
2. If not authenticated:
   - Interactive: `glab auth login`
   - Non-interactive: Set `GITLAB_TOKEN` environment variable

**Multi-host setup:**
- Set `GITLAB_HOST` env var OR use `--hostname` flag per command

## Command Templates by Task

### Listing Merge Requests
```bash
# Basic list (current repo)
glab mr list

# Filter by state
glab mr list --state opened
glab mr list --state merged
glab mr list --state closed

# Filter by person
glab mr list --author <username>
glab mr list --assignee <username>

# Filter by label
glab mr list --label <label-name>

# Combine filters
glab mr list --state opened --author alice --label bug
```

### Viewing Merge Request Details
```bash
# View MR by IID (internal ID shown in list)
glab mr view 42

# View with more details
glab mr view 42 --web  # Opens in browser
```

### Listing Issues
```bash
# Basic list
glab issue list

# Filtered
glab issue list --state opened
glab issue list --assignee bob --label bug
glab issue list --author alice --state closed
```

### Viewing Issue Details
```bash
glab issue view <IID>
```

### Listing Pipelines
```bash
# Recent pipelines for current repo
glab pipeline list

# View specific pipeline
glab pipeline view <PIPELINE_ID>

# Check current branch pipeline status
glab pipeline status
```

### Listing Projects
```bash
# List your projects
glab project list

# List with more results
glab project list --per-page 50
```

### Direct API Calls
When you need custom fields, complex queries, or features not in high-level commands:

```bash
# Get project ID first (often needed)
glab repo view --json | jq -r '.id'

# Call API endpoint
glab api "projects/:id/merge_requests?state=opened" --method GET

# With pagination
glab api "projects/:id/issues?per_page=100&page=2" --method GET

# POST/PUT/DELETE operations
glab api "projects/:id/merge_requests/<IID>/approve" --method POST
```

## Output Control

**For human reading:**
- Default table output (just run the command)

**For scripts/parsing:**
- Add `--json` flag if supported by the command
- Use `glab api` which always returns JSON
- Pipe to `jq` for filtering: `glab mr list --json | jq '.[] | .title'`

## Common Patterns for Automation

```bash
# Export token for non-interactive use
export GITLAB_TOKEN="glpat-xxxxxxxxxxxx"

# Save MRs to file
glab mr list --json > mrs.json

# Use API to get full data
glab api "projects/:id/merge_requests?state=opened" > mrs_full.json

# Check if inside a repo context
glab repo view 2>/dev/null || echo "Not in a repo"

# Specify repo explicitly
glab mr list --repo owner/project-name
```

## Error Handling Guide

### "Error: Must be logged in"
→ Run `glab auth login` or set `GITLAB_TOKEN`

### "Error: could not find a remote"
→ Not in a git repo. Either:
  - `cd` to a repo directory, OR
  - Add `--repo owner/project` flag

### "Error: 404 Not Found"
→ Check IID/ID is correct, or you lack permissions

### Missing data fields in output
→ Switch to `glab api <endpoint>` for full JSON response

### Rate limiting
→ Use pagination: `&per_page=20&page=1` in API calls
→ Add delays between calls if scripting

## Discovery Pattern

**When unsure what flags exist:**
```bash
glab mr --help
glab issue --help
glab pipeline --help
glab api --help
```

**When you need to know available filters:**
1. Try `glab <resource> list --help`
2. If not enough, use `glab api` with GitLab REST API docs

## Key Differences from Git

- `glab` = GitLab operations (MRs, issues, CI/CD)
- `git` = Version control operations (commits, branches, push/pull)
- They complement each other; use both in workflows

## Typical Agent Workflow

1. **Understand user intent** → Map to resource type (MR/issue/pipeline)
2. **Choose command level** → High-level `glab <resource>` or low-level `glab api`
3. **Add filters** → State, author, labels as needed
4. **Execute command** → Use `run_in_terminal`
5. **Parse output** → JSON preferred for programmatic use
6. **Handle errors** → Auth issues, repo context, permissions

## Quick Reference Card

| User wants | Command pattern |
|-----------|-----------------|
| List open MRs | `glab mr list --state opened` |
| View MR #42 | `glab mr view 42` |
| List my issues | `glab issue list --author @me` |
| Recent pipelines | `glab pipeline list` |
| Custom API query | `glab api "endpoint"` |
| Check auth | `glab auth status` |

