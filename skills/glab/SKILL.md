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

### Opening an MR — always include `Closes #<issue_iid>`

When opening an MR for a feature branch, always include `Closes #<issue_iid>` in the
description. GitLab will automatically close the Issue when the MR is merged into the
default branch.

```bash
glab mr create \
  --title "feat: implement session management" \
  --description "$(cat <<'EOF'
## Summary
Refactors pi-rpc-server session management to support multiple sessions.

Closes #64
EOF
)" \
  --target-branch develop \
  --no-editor
```

> `Closes` only auto-closes **Issues**, not Tasks (child work items).
> Tasks must be closed manually via the GraphQL API (see `gitlab-project-management` skill).

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
> For descriptions with backticks or complex markdown, write to a temp file and use `glab api "projects/:fullpath/issues/$iid" --method PUT --field "description=@/tmp/file.md"`

## Dependencies between work items

GitLab work items support blocking/blocked-by relationships via the links API.

```bash
# Add a "blocks" relationship: item A blocks item B
# Get global IDs first:
wid_a=$(GITLAB_HOST=... glab api graphql -f query='query { project(fullPath: "owner/repo") { workItems(iids: ["A"]) { nodes { id } } }}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['project']['workItems']['nodes'][0]['id'])")
wid_b=$(GITLAB_HOST=... glab api graphql -f query='query { project(fullPath: "owner/repo") { workItems(iids: ["B"]) { nodes { id } } }}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['project']['workItems']['nodes'][0]['id'])")

# Create link (A blocks B)
GITLAB_HOST=... glab api graphql -f query="
mutation {
  workItemAddLinkedItems(input: {
    id: \"$wid_a\"
    workItemsIds: [\"$wid_b\"]
    linkType: BLOCKS
  }) { workItem { iid } errors }
}"

# linkType values: BLOCKS, IS_BLOCKED_BY, RELATES_TO
```

> Dependencies between work items are displayed in the GitLab UI under the item's detail view.
> For issues (not Tasks), the REST API also works:
> `glab api "projects/:fullpath/issues/$iid/links" --method POST --field "target_project_id=PROJECT_ID&target_issue_iid=OTHER_IID&link_type=blocks"`


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

## Weight and time estimate

```bash
# Set weight on an issue or task (integer)
glab api "projects/:fullpath/issues/42" --method PUT --field weight=3

# Set time estimate
glab api "projects/:fullpath/issues/42/time_estimate" --method POST --field duration="3h"
glab api "projects/:fullpath/issues/42/time_estimate" --method POST --field duration="1h 30m"

# Add actual time spent (cumulative — each call adds to the total)
# Call this after every task is done. Compute duration from task start→end timestamps.
glab api "projects/:fullpath/issues/42/add_spent_time" --method POST --field duration="2h"
glab api "projects/:fullpath/issues/42/add_spent_time" --method POST --field duration="45m"

# Read current weight and time stats
glab api "projects/:fullpath/issues/42" | jq '{weight, time_stats}'
glab api "projects/:fullpath/issues/42/time_stats"
# → {"time_estimate":10800,"total_time_spent":7200,"human_time_estimate":"3h","human_total_time_spent":"2h"}

# Reset time estimate or spent time
glab api "projects/:fullpath/issues/42/reset_time_estimate" --method POST
glab api "projects/:fullpath/issues/42/reset_spent_time" --method POST
```

> Tasks (child work items) share the same `/issues/:iid` REST path — weight and time tracking work identically.
>
> **Always call `add_spent_time` after completing a task.** Do not skip it even if the
> duration is short — accurate spent time is the foundation for velocity calibration.
