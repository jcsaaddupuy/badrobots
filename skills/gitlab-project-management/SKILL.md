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
>
> **For test tasks specifically**, the description must also include:
> - The exact test file(s) to modify or create (path relative to repo root)
> - Each planned test scenario as a named test function
> - A table mapping scenario → file → function name
> - **Correct test file placement**: tests must live in the directory that
>   matches their traffic path or scope (e.g. unit vs integration, per-service
>   vs end-to-end). The project's `AGENT.md` defines the exact convention.
> A test task with only a list of scenarios and no file/function mapping is incomplete.

### Detecting and flagging underspecified tasks

During planning, after writing each task description, the agent must review it against
these questions:

| Question | If answer is "no" or "unclear" → flag |
|---|---|
| Is the exact behaviour of the change defined (not just the goal)? | `task::underspecified` |
| Are edge cases and error paths mentioned? | `task::underspecified` |
| Could another agent implement it from the description alone, without asking questions? | `task::underspecified` |
| For async/concurrency/IPC tasks: is the protocol, framing, and connection lifecycle defined? | `task::underspecified` |
| For new types/modules: are the public API signatures specified? | `task::underspecified` |

If any answer is unclear, **add the `task::underspecified` label** and add a `## Open questions`
section to the description listing exactly what needs to be resolved.

A weight of **5 or 8** with design unknowns in the description is a strong signal the task
needs more refinement before it can be started safely.

```bash
# Flag a task as underspecified
glab api "projects/:fullpath/issues/<iid>" --method PUT \
  --field "add_labels=task::underspecified"

# Remove the flag once resolved
glab api "projects/:fullpath/issues/<iid>" --method PUT \
  --field "remove_labels=task::underspecified"
```

**A task carrying `task::underspecified` must never be started.** Resolve the open
questions first — either by refining the description or by splitting the task into
smaller, well-defined pieces.

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
# For TEST tasks: also include a scenario → file → function name table.
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
# Mirror in your local task manager (e.g. TaskWarrior: task B modify depends:A_ID)

# 8. When all tasks are committed and ready to push:
#    a. Push the branch
#    b. Close each completed Task via workItemUpdate stateEvent: CLOSE (see "Closing work items")
#    c. Add Done label to the parent Issue
#    d. Open MR — always include "Closes #<issue_iid>" in the MR description
#       so the Issue closes automatically on merge.
```

> **Always set dependencies** when tasks have ordering constraints. Both GitLab
> (visible in the UI) and your local task manager must be kept in sync.

---

## Weight and time estimation

### Weight scale (Fibonacci)

Weight expresses **relative complexity**, not duration. Always use Fibonacci values:
`1` `2` `3` `5` `8`

### Assigning weight — complexity signals

Score each signal and sum, then round to nearest Fibonacci:

| Signal | Points |
|---|---|
| 1–2 files changed, modifying existing code | +1 |
| 3–5 files, or introducing a new module/type | +2 |
| 6+ files, or new binary/service | +3 |
| New async/concurrency primitive (channel, mutex, socket) | +1 |
| Design unclear or significant unknowns | +2 |
| Tests are part of the task | +1 |
| Pure config / Ansible / docs only | −1 (min 1) |

Cap at 8. Round to nearest Fibonacci (1→1, 2→2, 3→3, 4→3, 5→5, 6→5, 7→8, 8→8).

### Time estimate

Time estimate = `weight × velocity` where **velocity = hours per story point**.

**Default velocity: `0.5 h/point`** (AI agent prior — roughly 3× faster than a human developer).
Use this prior until calibrated from real completed-task data.
For human developers, a typical prior is `1.5 h/point`.

If a local task manager (e.g. TaskWarrior) is available and has completed task history,
read the calibrated velocity from it before computing the estimate. See the taskwarrior
skill for how velocity is computed and stored. If not available, use the default.

```
weight=3, velocity=0.5  →  estimate = 1h 30m  →  set "1h 30m" on the work item
weight=5, velocity=0.5  →  estimate = 2h 30m  →  set "2h 30m" on the work item
weight=8, velocity=0.5  →  estimate = 4h      →  set "4h" on the work item
```

### Setting weight and estimate at task creation

After creating a task and writing its description, always set weight and time estimate:

```bash
# Set weight (integer)
glab api "projects/:fullpath/issues/<iid>" --method PUT --field weight=<N>

# Set time estimate (GitLab duration string: Nh, NhNm, Nm)
glab api "projects/:fullpath/issues/<iid>/time_estimate" --method POST --field duration="<Nh Nm>"
```

See the `glab` skill for the full time tracking API (spent time, reset, read stats).

### Reporting actual time spent on done

When marking a task done, **always** report the actual time spent. This is mandatory —
it feeds velocity calibration and makes the tracker's time stats meaningful.

Compute actual time from your local task manager's start→end timestamps (see the
taskwarrior skill for the exact computation). Then post it:

```bash
# actual duration string computed from start→end (e.g. "1h 30m", "45m", "3h")
glab api "projects/:fullpath/issues/<iid>/add_spent_time" \
  --method POST --field duration="<actual>"
```

If no local task manager is available, estimate from wall-clock time mentally and
still post it. An approximate value is far better than nothing.

This feeds into velocity calibration when using a local task manager.

---
## Closing work items

### Timing rules

| Event | Action |
|---|---|
| Branch **pushed** | Close each completed Task (child work item) |
| Branch **pushed** | Add `Done` label to the parent Issue |
| MR **merged** | Issue state closes automatically via `Closes #N` in MR description |

**Never close tasks or issues before the branch is pushed.**

### On push: close Tasks

After `git push`, close every Task that was completed on this branch:

```bash
# Get global ID from iid
wid=$(GITLAB_HOST=gitlab.example.com glab api graphql -f query='
query { project(fullPath: "owner/repo") {
  workItems(iids: ["<task_iid>"]) { nodes { id } }
}}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['project']['workItems']['nodes'][0]['id'])")

# Close the Task
GITLAB_HOST=gitlab.example.com glab api graphql -f query="
mutation { workItemUpdate(input: { id: \"$wid\" stateEvent: CLOSE }) {
  workItem { iid state } errors } }"
```

### On push: add Done label to Issue

Once all Tasks for an Issue are closed, add the `Done` label to the parent Issue:

```bash
glab api "projects/:fullpath/issues/<issue_iid>" \
  --method PUT --field "add_labels=Done"
```

This signals that all implementation work is complete. The issue state remains
open until the MR is merged.

### On MR merge: Issue closes automatically

When opening the MR, always include `Closes #<issue_iid>` in the MR **description**.
GitLab will close the issue state automatically when the MR is merged into the default branch.

```markdown
## Summary
<description of what this MR does>

Closes #<issue_iid>
```

> `Closes` only works for Issues, not Tasks. Tasks are closed manually via the API on push (above).

### Reopening

```bash
# Reopen a Task or Issue
GITLAB_HOST=gitlab.example.com glab api graphql -f query="
mutation { workItemUpdate(input: { id: \"$wid\" stateEvent: REOPEN }) {
  workItem { iid state } errors } }"
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
| Task has no description | Title created but step 6 skipped | Always update description immediately after creation |
| Test task has no file/function map | Scenarios listed but no file path or function name | Add scenario → file → function table to description |
| Task started with `task::underspecified` label | Design unknowns not resolved | Remove label only after all open questions in description are answered |
