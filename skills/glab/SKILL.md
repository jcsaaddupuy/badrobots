---
name: glab
description: "glab CLI for GitLab operations (MRs, issues, pipelines)"
---

# glab — AI Agent Reference

## Auth

```bash
glab auth status                          # check
glab auth login                           # interactive (non-interactive: set GITLAB_TOKEN)
GITLAB_HOST=gitlab-example.com glab ...   # multi-host: prefix every command, no --hostname flag
```

## Issues

```bash
glab issue list --state opened
glab issue view 42
glab issue close 42
glab issue create --title "..." --description "..." --no-editor
```

## Merge Requests

```bash
glab mr list --state opened --author alice --label bug
glab mr view 42
glab mr approve 42
glab mr merge 42
```

## Pipelines / CI

```bash
glab pipeline list
glab ci trace <JOB_ID>                    # job logs — most reliable
```

> **Never use** `glab pipeline view` or `glab ci view` — unreliable (404). Use GraphQL instead.

## REST API

```bash
glab api "projects/:fullpath/issues"                        # :fullpath resolved from git remote
glab api "projects/:fullpath/issues/3" --method PUT --field title="new title"
glab api "projects/:fullpath/issues?state=opened&per_page=50"
```

## GraphQL

```bash
GITLAB_HOST=gitlab-example.com glab api graphql -f query='
query {
  project(fullPath: "owner/repo") {
    mergeRequest(iid: "42") { title sourceBranch }
  }
}' | jq '.data.project.mergeRequest'
```

Rules:
- Use `fullPath: "owner/repo"` not numeric IDs
- Use `iid` (internal ID), not `id` (global GID)
- Object fields need nested selection: `stage { name }` not `stage`
- GraphQL GID format: `gid://gitlab/Ci::Build/160208907` → extract number for `glab ci trace`

## Update work item description

```bash
glab api graphql -f query='
mutation {
  workItemUpdate(input: {
    id: "gid://gitlab/WorkItem/<id>"
    descriptionWidget: { description: "multiline\ndescription\nhere" }
  }) { workItem { iid title } errors }
}'
```

> Use `\n` for newlines inside the GraphQL string. This is the only reliable way to update work item descriptions with multiline content — `glab api --field` does not handle multiline values correctly.


**Hierarchy rules:** Epic → Issue → Task. Issue cannot be child of Issue.

```bash
# 1. Get work item type IDs for the project
glab api graphql -f query='query { project(fullPath: "owner/repo") { workItemTypes { nodes { id name } } } }'
# Task typeId is typically: gid://gitlab/WorkItems::Type/5

# 2. Get parent issue's work item global ID
glab api graphql -f query='query { project(fullPath: "owner/repo") { workItems(iids: ["3"]) { nodes { id } } } }'
# Returns: gid://gitlab/WorkItem/243569

# 3. Create a Task child item
glab api graphql -f query='mutation {
  workItemCreate(input: {
    projectPath: "owner/repo"
    title: "My task"
    workItemTypeId: "gid://gitlab/WorkItems::Type/5"
    hierarchyWidget: { parentId: "gid://gitlab/WorkItem/243569" }
  }) { workItem { iid title } errors }
}'

# 4. Verify children
glab api graphql -f query='query { project(fullPath: "owner/repo") { workItems(iids: ["3"]) { nodes {
  widgets { ... on WorkItemWidgetHierarchy { children { nodes { iid title workItemType { name } } } } }
} } } }'
```

## Common Errors

| Error | Fix |
|---|---|
| `Unknown flag: --hostname` | Use `GITLAB_HOST=... glab ...` prefix instead |
| `Must be logged in` | `glab auth login` or set `GITLAB_TOKEN` |
| `could not find a remote` | Run from inside a git repo or check remote URL |
| `it's not allowed to add this type of parent item` | Issue→Issue hierarchy forbidden; use Task type as child |

## Closing a work item state

> **Only close the state when the user explicitly asks.** Adding the `Done` label is the default
> signal for completed work. Closing the state is a separate project management decision.

```bash
# Get global ID from iid
wid=$(GITLAB_HOST=... glab api graphql -f query='
query { project(fullPath: "owner/repo") {
  workItems(iids: ["42"]) { nodes { id } }
}}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['project']['workItems']['nodes'][0]['id'])")

# Close
GITLAB_HOST=... glab api graphql -f query="
mutation { workItemUpdate(input: { id: \"$wid\" stateEvent: CLOSE }) {
  workItem { iid state } errors } }"

# Reopen
GITLAB_HOST=... glab api graphql -f query="
mutation { workItemUpdate(input: { id: \"$wid\" stateEvent: REOPEN }) {
  workItem { iid state } errors } }"
```
