---
name: gitlab-project-management
description: "GitLab project management via glab CLI and GraphQL: epics, issues, tasks, hierarchy, time tracking"
---

# GitLab Project Management — AI Agent Reference

## Auth

```bash
glab auth status
GITLAB_HOST=gitlab.example.com glab ...   # always prefix with GITLAB_HOST for non-gitlab.com instances
                                           # --hostname flag does NOT exist
```

---

## Work Item Hierarchy

GitLab enforces a strict three-level hierarchy:

```
Epic  (group-level work item)
  └── Issue  (project-level)
        └── Task  (project-level, child of Issue)
```

**Rules:**
- Epic → Issue: allowed (Epic must be created at group/namespace level)
- Issue → Task: allowed (Task is the only valid child type of an Issue)
- Issue → Issue: **forbidden** — `it's not allowed to add this type of parent item`
- Task → anything: not supported

**Work item type IDs** (fetch per-instance, they may vary):
```bash
GITLAB_HOST=gitlab.example.com glab api graphql -f query='
query { project(fullPath: "owner/repo") { workItemTypes { nodes { id name } } } }'
# Typical: Issue=Type/1  Task=Type/5  Epic=Type/8
```

---

## Epics

Epics are work items created at the **namespace (group) level**, not project level.

```bash
# Create epic
GITLAB_HOST=gitlab.example.com glab api graphql -f query='
mutation {
  workItemCreate(input: {
    namespacePath: "group-name"
    title: "My Epic"
    workItemTypeId: "gid://gitlab/WorkItems::Type/8"
  }) { workItem { id iid title } errors }
}'

# Attach an issue to an epic (set issue's parent to epic)
GITLAB_HOST=gitlab.example.com glab api graphql -f query='
mutation {
  workItemUpdate(input: {
    id: "gid://gitlab/WorkItem/<ISSUE_WORK_ITEM_ID>"
    hierarchyWidget: { parentId: "gid://gitlab/WorkItem/<EPIC_WORK_ITEM_ID>" }
  }) { workItem { iid title } errors }
}'
```

> Get the work item global ID of any issue: see "Resolve iid → global ID" below.

---

## Issues

```bash
# CRUD
glab issue create --title "..." --description "..." --no-editor
glab issue list --state opened
glab issue view 42
glab issue close 42

# Update via REST (single-line fields only)
glab api "projects/:fullpath/issues/42" --method PUT --field title="New title"

# Update description (multiline) — use GraphQL, not REST
GITLAB_HOST=gitlab.example.com glab api graphql -f query='
mutation {
  workItemUpdate(input: {
    id: "gid://gitlab/WorkItem/<ID>"
    descriptionWidget: { description: "line1\nline2\n```code```" }
  }) { workItem { iid title } errors }
}'
```

> `glab api --field description="..."` truncates or breaks on multiline content.
> Always use `workItemUpdate + descriptionWidget` for multiline descriptions.

---

## Tasks (child items of an Issue)

> **A task title alone is never acceptable.** Every task must have a detailed description
> that gives another agent enough context to implement it without asking questions.
> The description must include: what files to change, exact code snippets or templates,
> the expected outcome, and the commit message to use. Create the task first, then
> immediately update its description via `workItemUpdate + descriptionWidget`.

```bash
# Step 1 — get parent issue's work item global ID
GITLAB_HOST=gitlab.example.com glab api graphql -f query='
query { project(fullPath: "owner/repo") {
  workItems(iids: ["42"]) { nodes { id iid title } }
} }'
# id = "gid://gitlab/WorkItem/123456"

# Step 2 — create Task as child
GITLAB_HOST=gitlab.example.com glab api graphql -f query='
mutation {
  workItemCreate(input: {
    projectPath: "owner/repo"
    title: "My task"
    workItemTypeId: "gid://gitlab/WorkItems::Type/5"
    hierarchyWidget: { parentId: "gid://gitlab/WorkItem/<PARENT_ID>" }
  }) { workItem { id iid title } errors }
}'

# Update task description (same as issue)
GITLAB_HOST=gitlab.example.com glab api graphql -f query='
mutation {
  workItemUpdate(input: {
    id: "gid://gitlab/WorkItem/<TASK_ID>"
    descriptionWidget: { description: "task details here" }
  }) { workItem { iid title } errors }
}'

# List children of an issue
GITLAB_HOST=gitlab.example.com glab api graphql -f query='
query { project(fullPath: "owner/repo") {
  workItems(iids: ["42"]) { nodes {
    widgets { ... on WorkItemWidgetHierarchy {
      children { nodes { id iid title workItemType { name } } }
    }}
  }}
}}'
```

---

## Resolve iid → global Work Item ID

iid is the human-visible issue number (#42). The global ID (`gid://gitlab/WorkItem/...`) is required for GraphQL mutations.

```bash
GITLAB_HOST=gitlab.example.com glab api graphql -f query='
query { project(fullPath: "owner/repo") {
  workItems(iids: ["42", "43", "44"]) { nodes { id iid title } }
}}'
```

---

## Workflow: Planning a feature with Epic → Issues → Tasks

```bash
# 1. Create epic at group level
GITLAB_HOST=gitlab.example.com glab api graphql -f query='mutation { workItemCreate(input: {
  namespacePath: "my-group"
  title: "Feature X"
  workItemTypeId: "gid://gitlab/WorkItems::Type/8"
}) { workItem { id iid } errors }}'
# → save epic global ID

# 2. Create issue at project level
glab issue create --title "Implement feature X" --description "..." --no-editor
# → note issue iid (e.g. 7)

# 3. Resolve issue iid → global ID
GITLAB_HOST=gitlab.example.com glab api graphql -f query='
query { project(fullPath: "owner/repo") { workItems(iids: ["7"]) { nodes { id } } }}'

# 4. Attach issue to epic
GITLAB_HOST=gitlab.example.com glab api graphql -f query='mutation { workItemUpdate(input: {
  id: "gid://gitlab/WorkItem/<ISSUE_ID>"
  hierarchyWidget: { parentId: "gid://gitlab/WorkItem/<EPIC_ID>" }
}) { workItem { iid } errors }}'

# 5. Create tasks as children of the issue
# IMPORTANT: title alone is not enough — always follow with step 6 immediately.
GITLAB_HOST=gitlab.example.com glab api graphql -f query='mutation { workItemCreate(input: {
  projectPath: "owner/repo"
  title: "Subtask A"
  workItemTypeId: "gid://gitlab/WorkItems::Type/5"
  hierarchyWidget: { parentId: "gid://gitlab/WorkItem/<ISSUE_ID>" }
}) { workItem { iid id } errors }}'

# 6. Immediately update each task with a DETAILED description.
# Minimum required: files to change, what to do, code snippets, commit message.
# A task with only a title is incomplete and must not be left that way.
GITLAB_HOST=gitlab.example.com glab api graphql -f query='mutation { workItemUpdate(input: {
  id: "gid://gitlab/WorkItem/<TASK_ID>"
  descriptionWidget: { description: "## What\nChange X in file Y.\n\n## How\n```code snippet```\n\n## Commit\n`type(scope): summary. Fix for #N`" }
}) { workItem { iid } errors }}'

# 7. Set dependencies between tasks (A blocks B — B cannot start until A is done)
GITLAB_HOST=gitlab.example.com glab api graphql -f query='mutation {
  workItemAddLinkedItems(input: {
    id: "gid://gitlab/WorkItem/<TASK_A_ID>"
    workItemsIds: ["gid://gitlab/WorkItem/<TASK_B_ID>"]
    linkType: BLOCKS
  }) { workItem { iid } errors }
}'
# linkType: BLOCKS | IS_BLOCKED_BY | RELATES_TO
# Mirror in TaskWarrior: task B modify depends:A_TW_ID
```

> **Always set dependencies** when tasks have ordering constraints. Both GitLab
> (visible in the UI) and TaskWarrior (`depends:`) must be kept in sync.

---

## Time Tracking (estimates + spent time)

GitLab tracks two values per work item: **time estimate** (planned) and **time spent** (actual).
Both use the same duration string format: `Nh`, `Nm`, `Ns`, `NhNm`, `1h 30m`, `90m`.

### REST API — Issues and Tasks (iid-based)

```bash
# Set time estimate
glab api "projects/:fullpath/issues/42/time_estimate" --method POST --field duration="3h"

# Add time spent (cumulative — each call adds to the total)
glab api "projects/:fullpath/issues/42/add_spent_time" --method POST --field duration="1h 30m"

# Read current time stats
glab api "projects/:fullpath/issues/42/time_stats"
# → {"time_estimate":10800,"total_time_spent":5400,"human_time_estimate":"3h","human_total_time_spent":"1h 30m"}

# Reset spent time to zero
glab api "projects/:fullpath/issues/42/reset_spent_time" --method POST

# Reset estimate to zero
glab api "projects/:fullpath/issues/42/reset_time_estimate" --method POST
```

> Tasks created as child work items are also addressable by iid via the same `/issues/` REST path.

### Workflow: report actual time from TimeWarrior

See the **timewarrior** skill for how to extract seconds per issue from `timew export`.
Convert and report in one pipeline:

```bash
# 1. Compute seconds spent on issue #43 from TimeWarrior
SECS=$(timew export | python3 -c "
import sys, json, re
from datetime import datetime, timezone
records = json.load(sys.stdin)
total = 0
pat = re.compile(r'issue:#?43\\b')
for r in records:
    if not any(pat.search(t) for t in r.get('tags',[])): continue
    s = datetime.strptime(r['start'],'%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc)
    e = datetime.strptime(r['end'],'%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc) if 'end' in r else datetime.now(timezone.utc)
    total += int((e-s).total_seconds())
print(total)
")

# 2. Convert to GitLab duration string
DURATION=$(python3 -c "
secs=$SECS
h=secs//3600; m=(secs%3600)//60
parts=[f'{h}h'] if h else []
if m: parts.append(f'{m}m')
print(' '.join(parts) or '0m')
")

# 3. Post to GitLab
cd /path/to/repo
GITLAB_HOST=gitlab.example.com glab api "projects/:fullpath/issues/43/add_spent_time" \
  --method POST --field duration="$DURATION"
```

### When to report time

- Set **estimate** when creating or starting a task (before work begins).
- Add **spent time** when marking a task done (`task ID done`).
- Report at the **issue level** for user-visible tracking; task-level is optional.

---

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| `Unknown flag: --hostname` | Flag does not exist | Use `GITLAB_HOST=... glab ...` prefix |
| `Must be logged in` | No token | `glab auth login` or set `GITLAB_TOKEN` |
| `it's not allowed to add this type of parent item` | Issue→Issue hierarchy | Use Task type (`Type/5`) as child, not Issue |
| Epic create fails with permission error | `projectPath` used instead of `namespacePath` | Use `namespacePath: "group"` for epics |
| Description truncated | Used `glab api --field description=` | Use `workItemUpdate + descriptionWidget` via GraphQL |
| Task has no description | Title created but step 6 skipped | Always update description immediately after creation |
