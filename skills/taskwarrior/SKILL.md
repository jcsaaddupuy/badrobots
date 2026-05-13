---
name: taskwarrior
description: "TaskWarrior workflow for AI agents: planning, implementation, dependencies, issue tracking"
---

# TaskWarrior - AI Agent Workflow

## Setup: recommended UDAs

Define these in `~/.taskrc` once. They let tasks carry issue tracker references without coupling to any specific tracker.

```ini
# Issue/ticket reference (URL or ID from any tracker)
uda.issue.type=string
uda.issue.label=Issue

# Commit message template for this task
uda.commit.type=string
uda.commit.label=Commit

# Complexity weight (Fibonacci: 1 2 3 5 8)
uda.weight.type=numeric
uda.weight.label=Weight

# Time estimate in decimal hours (e.g. 1.5 = 1h30m)
uda.estimate.type=numeric
uda.estimate.label=EstimateHours

# Calibrated velocity in hours/point for this project (stored as annotation on a sentinel task)
# See "Velocity calibration" below
```

Use them when creating tasks:
```bash
task add "implement auth module" project:myapp +feat \
  issue:"https://tracker/issues/42" \
  commit:"feat(auth): add JWT validation. Fix for #42" \
  weight:3 estimate:1.5
```

---

## Core commands

```bash
task add "description" project:p +tag depends:ID1,ID2   # create
task ID start                                            # mark active
task ID done                                            # mark complete
task ID modify depends:ID1,ID2                          # set deps
task ID modify issue:"url-or-id"                        # set issue ref
task ID annotate "note"                                  # add note
task project:myapp ls                                    # list project tasks
task project:myapp ids                                   # get IDs only
task synchronize                                         # sync to server
```

---

## Velocity calibration

Velocity = hours actually spent per story point. It is project-specific and improves
over time as more tasks are completed. It is stored as a **TaskWarrior annotation** on
a dedicated sentinel task so it persists across sessions without an external database.

### Bootstrap (no history yet)

Create the sentinel task once per project:
```bash
task add "[velocity] project calibration" project:myapp +velocity
task <ID> annotate "velocity:0.5"   # AI agent default prior
# For human developers use "velocity:1.5" as the prior
```

### Read current velocity

```bash
task project:myapp +velocity ls  # find the sentinel task ID
task <ID> _get annotations        # read annotations
# parse the most recent "velocity:N.NN" annotation
```

Or in one line:
```bash
task project:myapp +velocity export | \
  python3 -c "
import sys,json
tasks=json.load(sys.stdin)
anns=[a['description'] for t in tasks for a in t.get('annotations',[])]
velocity=next((float(a.split(':')[1]) for a in reversed(anns) if a.startswith('velocity:')),0.5)
print(velocity)
"
```

### Update velocity after completing tasks

After at least **5 tasks** have both `weight` and actual duration (start→end), recompute:

```bash
task project:myapp +COMPLETED export | python3 -c "
import sys, json
from datetime import datetime

tasks = json.load(sys.stdin)
samples = []
for t in tasks:
    w = t.get('weight')
    start = t.get('start')
    end = t.get('end')
    if not (w and start and end):
        continue
    s = datetime.fromisoformat(start.replace('Z','+00:00'))
    e = datetime.fromisoformat(end.replace('Z','+00:00'))
    actual_hours = (e - s).total_seconds() / 3600
    samples.append(actual_hours / w)

if len(samples) >= 5:
    velocity = sum(samples) / len(samples)
    print(f'velocity:{velocity:.2f}  (n={len(samples)})')
else:
    print(f'not enough data yet ({len(samples)}/5 tasks)')
"
```

Then annotate the sentinel task with the new value:
```bash
task <sentinel_ID> annotate "velocity:0.42"  # updated value
```

The most recent annotation wins. Old annotations are kept as history.

### Estimate from weight

```bash
# Read velocity, compute estimate, set on task
VELOCITY=0.5   # from sentinel task
WEIGHT=3
ESTIMATE=$(python3 -c "print($WEIGHT * $VELOCITY)")
task <ID> modify weight:$WEIGHT estimate:$ESTIMATE
```

The `estimate` UDA stores decimal hours. To display:
```bash
task <ID> _get estimate  # e.g. "1.5" = 1h30m
```

---

## Planning workflow

### 1. Break work into tasks

One task = one logical unit of work that ends in a single deliverable change.
Group by dependency layer, not by file or module.

Assign `weight` (Fibonacci: 1/2/3/5/8) based on complexity signals, then compute
`estimate` from weight × current velocity (read from sentinel task or use prior `0.5`).

```bash
task add "scaffold crate - Cargo.toml, module stubs, compiles clean" project:myapp +feat issue:"#13" commit:"feat(myapp): scaffold crate. Fix for #13" weight:1 estimate:0.5
task add "config module - clap struct, env vars, helpers"             project:myapp +feat issue:"#14" commit:"feat(myapp): add config module. Fix for #14" weight:2 estimate:1.0
task add "crypto module - encrypt/decrypt/fingerprint + unit tests"   project:myapp +feat issue:"#15" commit:"feat(myapp): add crypto module. Fix for #15" weight:3 estimate:1.5
```

### 2. Set dependencies

Use `depends:` so TaskWarrior blocks work that cannot start yet.
Blocked tasks show `D` in list view and get a negative urgency coefficient (-5).

```bash
task ID_config   modify depends:ID_scaffold
task ID_crypto   modify depends:ID_scaffold
task ID_storage  modify depends:ID_scaffold,ID_crypto
task ID_routes   modify depends:ID_storage,ID_auth
```

### 3. Identify parallelisable work

Tasks with the same dependency layer can be done in parallel.
```bash
task project:myapp ls   # D column = blocked, no D = ready to start
```

### 4. Always end with a delivery task

The final task carries no implementation — it validates, delivers the work remotely,
and opens a review request if applicable.
```bash
task add "final: tests pass, deliver remotely, open review request" project:myapp +release depends:ID_tests,ID_envoy
```

---

## Implementation workflow

```
for each ready task (not blocked, not done):
  1. task ID start                          ← records start timestamp
  2. implement
  3. verify / test / lint
  4. commit or save changes
  5. task ID done                           ← records end timestamp
  6. compute actual time from start→end timestamps (see below)
  7. report actual time to issue tracker
  8. move to next unblocked task

when all tasks in the batch are done and changes are delivered remotely:
  9. close each completed sub-task in the issue tracker
 10. add the completion signal to the parent issue (e.g. Done label)
 11. open a review request (MR/PR) if applicable
 12. task synchronize
```

**Never batch unrelated changes in a single unit of work.**
**Sub-tasks and issues are only updated in the tracker once the work is delivered
to the remote - not before. What "delivered" means depends on the workflow
(git push, upload, deploy, etc.).**

### Computing actual time from TaskWarrior timestamps

`task start` and `task done` record ISO8601 timestamps. After marking done, compute
actual hours and report them to the issue tracker:

```bash
# Get start and end for a just-completed task
ACTUAL_HOURS=$(task <ID> export | python3 -c "
import sys, json
from datetime import datetime
tasks = json.load(sys.stdin)
t = tasks[0]
start = t.get('start')
end   = t.get('end')
if start and end:
    s = datetime.fromisoformat(start.replace('Z','+00:00'))
    e = datetime.fromisoformat(end.replace('Z','+00:00'))
    hours = (e - s).total_seconds() / 3600
    print(round(hours, 2))
else:
    print(0)
")

# Convert to a duration string for the issue tracker (e.g. "1h 30m")
DURATION=$(python3 -c "
h = float('$ACTUAL_HOURS')
whole_h = int(h)
m = int((h - whole_h) * 60)
if whole_h and m: print(f'{whole_h}h {m}m')
elif whole_h:     print(f'{whole_h}h')
else:             print(f'{m}m')
")

# Report to issue tracker (see the tracker-specific skill for the exact command)
echo "Actual time: $DURATION"
```

Then pass `$DURATION` to the issue tracker's "add spent time" API.
See the active tracker skill (e.g. `glab` skill) for the exact command.

---

## Updating the issue tracker on done

Every task has an `issue` UDA referencing an item in the project's issue tracker
(e.g. `#25`, a URL, or a tracker-specific ID).

### Timing - when to act

| Event | Action |
|---|---|
| `task ID done` (after completing the work) | Compute and report actual time spent |
| Work **delivered remotely** (pushed, deployed, uploaded...) | Close each completed sub-task in the tracker |
| Work **delivered remotely** | Add completion signal to the parent issue (e.g. `Done` label) |
| Work **reviewed and accepted** (MR merged, PR approved...) | Close parent issue state (if applicable) |

**Do not close tasks or issues before the work is delivered remotely.**
What "delivered" means depends on your workflow: git push, file upload, deploy, etc.

### On delivery: close sub-tasks, signal issue

Once the work is on the remote, for each completed task:
1. Close the sub-task state in the issue tracker.
2. Once all sub-tasks are closed, add the completion signal to the parent issue
   (e.g. `Done` label). Do NOT close the issue state - that happens at review/merge.

How to perform these actions depends on the active issue tracker skill:
- **GitLab:** see the `glab` skill and the `gitlab-project-management` skill.
- **Other trackers:** consult the relevant skill loaded for this project.

---

## Commit message convention with issue refs

When working in a VCS (e.g. git), every commit should reference both the
**task item** and the **parent issue** in the issue tracker.

```
type(scope): short summary. Fix for #<task_id>. Ref #<issue_id>
```

- Use `Fix for #<task_id>` when this change is the **final and complete implementation**
  of the task (the task will be closed when delivered).
- Use `Ref #<task_id>` for **intermediate changes** that are part of the task but do
  not complete it.
- Always use `Ref #<issue_id>` for the parent issue - the issue is closed by the
  review/merge step, not by an individual commit.

```bash
# Final commit for a task (git example):
git commit -m "feat(auth): add JWT validation. Fix for #25. Ref #12"

# Intermediate commit:
git commit -m "feat(auth): add JWKS fetcher. Ref #25. Ref #12"
```

Retrieve the commit message template from the task:
```bash
task ID _get commit   # prints the uda.commit value
```

---

## Useful queries

```bash
task project:myapp ls                        # all tasks, blocked shown
task project:myapp +READY ls                 # unblocked, not started
task project:myapp +ACTIVE ls                # currently started
task project:myapp +BLOCKED ls               # waiting on deps
task rc.report.ls.columns+=issue ls          # show issue column
task project:myapp export | jq '.[].issue'   # all issue refs
```

---

## Dependency graph (visual check)

```bash
task project:myapp ls   # D = blocked by dependency
# Read the dependency chain from top (no D, high urgency) to bottom
# Parallelisable = same depth, both unblocked
```

---

## Rules for AI agents

- **One task = one unit of work.** Do not batch multiple logical changes.
- **Set `weight` and `estimate` on every task.** Read velocity from the sentinel task (or use prior `0.5` h/point for AI agents). Mirror weight and estimate in the issue tracker.
- **Set `depends:` before starting.** Never start a task whose dependencies are not done.
- **Never start a `task::underspecified` task.** If the linked issue tracker item carries the `task::underspecified` label, stop and resolve the open questions first. Check the item description for an `## Open questions` section.
- **Set dependencies in both systems.** When tasks have ordering constraints, set `depends:` in TaskWarrior AND the equivalent blocking link in your issue tracker. Keeping them in sync makes the dependency graph visible in both tools.
- **Set `issue:` on every task** that maps to a tracker item. Reference it in change messages (commit messages, changelogs, etc.).
- **`task ID start` before starting work.** `task ID done` immediately after completing the unit of work.
- **Report actual time spent after every `task ID done`.** Compute from start→end timestamps and post to the issue tracker. Never skip this - it is the data that calibrates future estimates.
- **Do not close tasks or the issue until work is delivered remotely.** Closing before delivery means closing work that hasn't been shared yet.
- **On delivery: close all completed sub-tasks, then signal the parent issue** (e.g. add `Done` label).
- **`task synchronize` after delivering.**
- **Update velocity after 5+ completions.** Annotate the sentinel task with the recalibrated value.
- **The delivery task is the gate.** Work is delivered only when that task is reached.
- **Do not create tasks for work already done.** Tasks are forward-looking only.
