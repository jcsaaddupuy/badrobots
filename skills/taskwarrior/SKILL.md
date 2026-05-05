---
name: taskwarrior
description: "TaskWarrior workflow for AI agents: planning, implementation, dependencies, issue tracking"
---

# TaskWarrior — AI Agent Workflow

## Setup: recommended UDAs

Define these in `~/.taskrc` once. They let tasks carry issue tracker references without coupling to any specific tracker.

```ini
# Issue/ticket reference (URL or ID from any tracker)
uda.issue.type=string
uda.issue.label=Issue

# Commit message template for this task
uda.commit.type=string
uda.commit.label=Commit
```

Use them when creating tasks:
```bash
task add "implement auth module" project:myapp +feat issue:"https://tracker/issues/42" commit:"feat(auth): add JWT validation. Fix for #42"
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

## Planning workflow

### 1. Break work into tasks

One task = one logical unit that ends in a commit.
Group by dependency layer, not by file or module.

```bash
task add "scaffold crate — Cargo.toml, module stubs, compiles clean" project:myapp +feat issue:"#13" commit:"feat(myapp): scaffold crate. Fix for #13"
task add "config module — clap struct, env vars, helpers"             project:myapp +feat issue:"#14" commit:"feat(myapp): add config module. Fix for #14"
task add "crypto module — encrypt/decrypt/fingerprint + unit tests"   project:myapp +feat issue:"#15" commit:"feat(myapp): add crypto module. Fix for #15"
```

### 2. Set dependencies

Use `depends:` so TaskWarrior blocks work that cannot start yet.
Blocked tasks show `D` in list view and get a negative urgency coefficient (−5).

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

### 4. Always end with a push task

The final task carries no commit — it validates and pushes.
```bash
task add "final: clippy, tests pass, push branch, open MR" project:myapp +release depends:ID_tests,ID_envoy
```

---

## Implementation workflow

```
for each ready task (not blocked, not done):
  1. task ID start
  2. implement
  3. cargo test / lint / type-check
  4. git add <files>
  5. git commit -m "<commit field from task>"
  6. task ID done
  7. task synchronize
  8. move to next unblocked task
```

**Never commit unrelated changes together.**
**Never push until the push task is reached.**

---

## Commit message convention with issue refs

Include the issue reference in the commit body as `Fix for #N` (or `Ref #N` if not closing).

```bash
git commit -m "feat(scope): short summary" -m "Fix for #42"
# or inline for single-line commits:
git commit -m "feat(scope): short summary. Fix for #42"
```

Retrieve the commit message from the task:
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

- **One task = one commit.** Do not batch multiple logical changes.
- **Set `depends:` before starting.** Never start a task whose dependencies are not done.
- **Set `issue:` on every task** that maps to a tracker item. Use it in the commit message.
- **`task ID start` before touching code.** `task ID done` immediately after committing.
- **`task synchronize` after every done.** Keeps remote state current.
- **The push task is the gate.** Branch is pushed only when that task is reached.
- **Do not create tasks for work already done.** Tasks are forward-looking only.
