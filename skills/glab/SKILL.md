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

### When user asks about Pipelines/CI:
- **List pipelines**: `glab pipeline list` or `glab ci list`
- **View pipeline status**: `glab pipeline status` or `glab ci status`
- **Retry pipeline**: `glab pipeline retry <PIPELINE_ID>` or `glab ci retry <PIPELINE_ID>`
- **View job trace/logs**: `glab ci trace <JOB_ID>` (most reliable for logs)
- **Get pipelines for MR**: Use GraphQL API (see Pipeline & CI Jobs section below)

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
# or
glab ci list

# Check current branch pipeline status
glab pipeline status
# or
glab ci status
```

### Viewing Pipeline & CI Jobs
```bash
# IMPORTANT: glab pipeline view <ID> and glab ci view <ID> are unreliable
# Use GraphQL API instead for pipeline details

# Get pipelines for a specific MR
glab api graphql -f query='
query {
  project(fullPath: "owner/repo-name") {
    mergeRequest(iid: "42") {
      pipelines {
        nodes {
          id
          iid
          status
          createdAt
        }
      }
    }
  }
}'

# Get pipeline details with jobs
glab api graphql -f query='
query {
  project(fullPath: "owner/repo-name") {
    pipeline(iid: "123") {
      id
      status
      createdAt
      jobs {
        nodes {
          id
          name
          status
          webPath
        }
      }
    }
  }
}' | jq

# View job logs/trace (this is the most reliable way)
glab ci trace <JOB_ID>

# Example: Extract job ID from GraphQL then get logs
# Step 1: Get jobs from pipeline
glab api graphql -f query='...' | jq -r '.data.project.pipeline.jobs.nodes[] | select(.status=="FAILED") | .id'
# Step 2: Extract numeric ID and get trace
glab ci trace 160208907
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

# Call REST API endpoint
glab api "projects/:id/merge_requests?state=opened" --method GET

# With pagination
glab api "projects/:id/issues?per_page=100&page=2" --method GET

# POST/PUT/DELETE operations
glab api "projects/:id/merge_requests/<IID>/approve" --method POST
```

### GraphQL API (Preferred for Complex Queries)
GraphQL is more reliable for pipelines, jobs, and detailed MR information:

```bash
# Basic GraphQL query structure
glab api graphql -f query='
query {
  project(fullPath: "owner/repo-name") {
    # Your query here
  }
}'

# Get MR with pipeline information
glab api graphql -f query='
query {
  project(fullPath: "owner/repo-name") {
    mergeRequest(iid: "42") {
      title
      sourceBranch
      targetBranch
      pipelines(first: 10) {
        nodes {
          id
          iid
          status
          createdAt
        }
      }
    }
  }
}'

# Get pipeline with jobs
glab api graphql -f query='
query {
  project(fullPath: "owner/repo-name") {
    pipeline(iid: "123") {
      id
      status
      createdAt
      jobs {
        nodes {
          id
          name
          status
          webPath
        }
      }
    }
  }
}'

# Pipe to jq for processing
glab api graphql -f query='...' | jq '.data.project.mergeRequest.pipelines.nodes[0]'
```

**Important Notes:**
- Use `fullPath: "owner/repo-name"` format (not numeric IDs)
- Use `iid` (internal ID) for MRs and pipelines, not `id`
- GraphQL `id` returns format like `gid://gitlab/Ci::Build/160208907` - extract numeric part for `glab ci trace`
- Always validate GraphQL field selections (e.g., `stage` is an object, needs `{ name }` not just `stage`)

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
→ Common causes:
  - Check IID/ID is correct
  - Verify you have permissions
  - **For pipelines**: Use GraphQL API instead of `glab pipeline view`
  - **For REST API**: Ensure proper URL encoding for project paths (use `%2F` for `/`)

### "Unknown flag: --xyz"
→ Flag doesn't exist. Common mistakes:
  - `--with-links` doesn't exist on `glab mr view`
  - `--merge-request` doesn't exist on `glab ci list`
  - `--pipeline-id` doesn't exist on `glab ci status`
  - Check `glab <command> --help` for actual flags

### Missing data fields in output
→ Switch to `glab api <endpoint>` for full JSON response or use GraphQL

### GraphQL errors: "Field must have selections"
→ Some fields are objects requiring nested selection:
```bash
# Wrong:
stage

# Correct:
stage { name }
```

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
2. **Choose command level**:
   - Simple queries: Use high-level `glab <resource>` commands
   - Pipeline/job details: Use GraphQL API with `glab api graphql`
   - Job logs: Use `glab ci trace <JOB_ID>`
3. **Add filters** → State, author, labels as needed
4. **Execute command** → Use bash tool
5. **Parse output** → JSON preferred for programmatic use (pipe to `jq`)
6. **Handle errors** → Auth issues, repo context, permissions, missing flags

### Example: Getting Pipeline Logs for an MR

```bash
# Step 1: Get the source branch from MR
glab api graphql -f query='
query {
  project(fullPath: "owner/repo") {
    mergeRequest(iid: "42") {
      sourceBranch
      pipelines(first: 1) {
        nodes {
          iid
          status
        }
      }
    }
  }
}'

# Step 2: Get pipeline jobs
glab api graphql -f query='
query {
  project(fullPath: "owner/repo") {
    pipeline(iid: "123") {
      jobs {
        nodes {
          id
          name
          status
        }
      }
    }
  }
}' | jq -r '.data.project.pipeline.jobs.nodes[] | "\(.id) \(.name) \(.status)"'

# Step 3: Extract job ID and get logs
# From GraphQL id like "gid://gitlab/Ci::Build/160208907"
# Extract just the number: 160208907
glab ci trace 160208907
```

### Working with GitLab Wikis

GitLab wikis are Git repositories that can be cloned and managed like code. There's no dedicated `glab wiki` command, but you can interact with wikis using the API and Git.

#### Listing Wiki Pages
```bash
# List all wiki pages for a project
glab api "projects/:fullpath/wikis"

# With URL encoding for project path
glab api "projects/some-org%2Fapps%2Fsome-folder%2Flanggraph%2Fsome-project/wikis"

# Get specific wiki page content
glab api "projects/:fullpath/wikis/page-slug"

# Example: Get page content as JSON
glab api "projects/:fullpath/wikis/ARCHITECTURE.md" | jq -r '.content'
```

#### Cloning Wiki Repository
```bash
# Wiki repo URL pattern: <project-url>.wiki.git
# Example for project: git@gitlab.com:owner/project.git
# Wiki would be:       git@gitlab.com:owner/project.wiki.git

# Clone wiki alongside project
git clone git@gitlab.org:owner/project.wiki.git ~/src/path/to/project.wiki

# Standard structure recommendation:
# ~/src/gitlab.com/owner/project      <- code repository
# ~/src/gitlab.com/owner/project.wiki <- wiki repository
```

#### Managing Wiki Pages via Git

You may pull and commit, but never push.

```bash
# After cloning wiki repo
cd ~/src/path/to/project.wiki

# Create/edit pages (markdown files)
echo "# New Page" > New-Page.md

# Commit
git add New-Page.md
git commit -m "Add new page"

# Never push directly

# Pull latest changes
git pull origin master
```

#### Creating/Updating Wiki Pages via API
```bash
# Create a new wiki page
glab api "projects/:fullpath/wikis" \
  --method POST \
  --field title="Page Title" \
  --field content="# Page Content" \
  --field format="markdown"

# Update existing wiki page
glab api "projects/:fullpath/wikis/page-slug" \
  --method PUT \
  --field content="# Updated Content" \
  --field format="markdown"

# Delete wiki page
glab api "projects/:fullpath/wikis/page-slug" --method DELETE
```

#### Best Practices for Wiki Management

**When to use Git clone approach:**
- Writing multiple pages or large documentation
- Need local editing with your preferred editor
- Want version control workflow (branches, reviews)
- Batch operations on multiple pages

**When to use API approach:**
- Quick single-page updates
- Automated documentation generation
- Reading wiki content programmatically
- Listing available pages

**Recommended workflow for documentation generation:**
1. Clone wiki repo alongside code repo: `project/` and `project.wiki/`
2. Write markdown files directly to wiki repo
3. Commit and push changes
4. Wiki pages appear immediately on GitLab

## Quick Reference Card

| User wants | Command pattern |
|-----------|-----------------|
| List open MRs | `glab mr list --state opened` |
| View MR #42 | `glab mr view 42` |
| Get MR branch | `glab api graphql -f query='...'` (see GraphQL section) |
| Get MR pipelines | `glab api graphql` (see Example workflow) |
| List pipelines | `glab pipeline list` or `glab ci list` |
| View job logs | `glab ci trace <JOB_ID>` |
| List my issues | `glab issue list --author @me` |
| List wiki pages | `glab api "projects/:fullpath/wikis"` |
| Get wiki page content | `glab api "projects/:fullpath/wikis/page-slug"` |
| Clone wiki repo | `git clone <project-url>.wiki.git path.wiki` |
| Custom API query | `glab api "endpoint"` or `glab api graphql` |
| Check auth | `glab auth status` |

## Common Pitfalls to Avoid

1. **Don't use** `glab pipeline view <ID>` or `glab ci view <ID>` - they're unreliable (404 errors)
   - **Use instead**: GraphQL API for pipeline details
   
2. **Don't use** non-existent flags like `--with-links`, `--merge-request`, `--pipeline-id`
   - **Always check**: `glab <command> --help` first

3. **Don't forget** to extract numeric ID from GraphQL `id` fields
   - GraphQL returns: `gid://gitlab/Ci::Build/160208907`
   - You need: `160208907` for `glab ci trace`

4. **Don't use** numeric project IDs in GraphQL
   - **Use**: `fullPath: "owner/repo-name"` format instead

5. **Don't query** object fields without nested selections in GraphQL
   - Wrong: `stage`
   - Correct: `stage { name }`

