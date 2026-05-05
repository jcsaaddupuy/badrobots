---
name: gitlab-project-management
description: "GitLab project management via glab CLI and GraphQL: epics, issues, tasks, hierarchy"
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
GITLAB_HOST=gitlab.example.com glab api graphql -f query='mutation { workItemCreate(input: {
  projectPath: "owner/repo"
  title: "Subtask A"
  workItemTypeId: "gid://gitlab/WorkItems::Type/5"
  hierarchyWidget: { parentId: "gid://gitlab/WorkItem/<ISSUE_ID>" }
}) { workItem { iid } errors }}'

# 6. Update task descriptions with implementation detail
GITLAB_HOST=gitlab.example.com glab api graphql -f query='mutation { workItemUpdate(input: {
  id: "gid://gitlab/WorkItem/<TASK_ID>"
  descriptionWidget: { description: "detailed instructions\ncode snippets\netc" }
}) { workItem { iid } errors }}'
```

---

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| `Unknown flag: --hostname` | Flag does not exist | Use `GITLAB_HOST=... glab ...` prefix |
| `Must be logged in` | No token | `glab auth login` or set `GITLAB_TOKEN` |
| `it's not allowed to add this type of parent item` | Issue→Issue hierarchy | Use Task type (`Type/5`) as child, not Issue |
| Epic create fails with permission error | `projectPath` used instead of `namespacePath` | Use `namespacePath: "group"` for epics |
| Description truncated | Used `glab api --field description=` | Use `workItemUpdate + descriptionWidget` via GraphQL |
