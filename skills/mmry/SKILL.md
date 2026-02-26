---
name: mmry
description: Persistent memory management for AI agents using the mmry system. Use when you need to capture principles, patterns, and insights that improve decision-making. Memories are a knowledge base of essence (what you learned), not a history log (what you did). Complement todos (ephemeral tasks) and skills (procedural knowledge). Supports semantic search, multiple memory types (episodic, semantic, procedural), categories, tags, and importance levels.
---

# mmry - Persistent Memory for Agents

## Overview

mmry is a local-first memory system that persists across sessions. Unlike todos (ephemeral, session-scoped) or skills (procedural knowledge), memories are designed for capturing **insights and principles** that improve decision-making:

- **Principles and patterns** - General insights that apply across situations
- **Learned lessons** - What worked, why it worked, and when to apply it
- **System knowledge** - How things work, constraints, and characteristics
- **Decision rationale** - Why choices were made and what alternatives were considered

**Key distinction:** Memories capture the *essence* of learning, not the *history* of tasks. They're a knowledge base, not a log.

## Memory vs Todos vs Skills

| Aspect | Todos | Memories | Skills |
|--------|-------|----------|--------|
| **Scope** | Session-only | Persistent (survives restarts) | Global (all projects) |
| **Purpose** | Track current tasks | Capture principles & insights | Procedural knowledge |
| **Content** | What to do now | Essence of learning | How-to guides |
| **Lifespan** | Ephemeral | Permanent (until deleted) | Permanent (reference material) |
| **Search** | Simple list | Semantic + keyword + fuzzy | Text search in docs |
| **Use Case** | "What do I need to do now?" | "What principles apply here?" | "How do I do X?" |

**When to use each:**

- **Todos**: Current sprint tasks, immediate action items, temporary reminders
- **Memories**: Principles, patterns, lessons learned, architectural decisions, system constraints, debugging insights
- **Skills**: How-to guides, API documentation, company policies, domain expertise

**What NOT to store in memories:**
- ❌ Task logs ("Fixed X", "Created Y", "Deployed Z")
- ❌ Session summaries ("Today I did...")
- ❌ History of events
- ❌ Duplicate information already in skills or docs

## Quick Start

### Add a Memory

```bash
# The agent can add memories
# This creates a persistent record

# Episodic: events and experiences (auto-detected or explicit)
mmry add "Deployed new API to production at 2pm, took 15 minutes"

# Semantic: facts and knowledge (auto-detected if contains "is"/"are")
mmry add "The database migration takes ~5 minutes to run"

# Procedural: how-to and instructions (auto-detected if contains "step"/"how to")
mmry add "To debug memory leaks: 1) Run profiler, 2) Check heap dumps, 3) Look for circular refs"

# With metadata
mmry add "API rate limit is 1000 req/min" --memory-type semantic --importance 9 --category api
mmry add "Sprint planning notes" --category work --tags "planning,team,q1"
```

### Search Memories

```bash
# Hybrid search (combines all strategies)
mmry search "database performance"

# Semantic search (conceptual similarity)
mmry search "slow queries" --mode semantic

# Fuzzy search (typo-tolerant)
mmry search "databse" --mode fuzzy

# Keyword search (exact matching)
mmry search "migration" --mode keyword
```

### List and Manage

```bash
# List all memories
mmry ls

# List by category
mmry ls --category work

# Search and filter
mmry search "api" --category technical

# Delete
mmry delete <id> --yes

# Update (delete old, add new with same metadata)
mmry update <id> "new content"
```

## Memory Types

### Episodic (Learned Lessons from Events)

Insights and lessons learned from specific experiences, not the events themselves.

**When to use:**
- Lessons from debugging sessions (what you learned, not what you did)
- Architectural decisions and their rationale
- Patterns discovered through troubleshooting
- Constraints discovered through integration work
- User preferences and work patterns
- Information about the project in current session that may be relevant in future sessions

**Examples:**
- "Defensive programming: Always check if external data fields exist before accessing them. Prevents crashes in rendering code."
- "Sandbox constraints: Mounted paths may not be recognized by validation logic. Design to work within constraints."
- "User prefers CLI mode, tmux sessions, and session analysis for debugging."

**What NOT to store:**
- ❌ "Fixed N+1 query issue today"
- ❌ "Client requested feature X during standup"
- ❌ "Database migration failed first time"

### Semantic (Facts & Principles)

Factual information, principles, and patterns that don't change frequently.

**When to use:**
- Technical specifications and limits
- System architecture and constraints
- Performance characteristics
- General programming principles
- Integration patterns and best practices

**Examples:**
- "The API rate limit is 1000 requests per minute"
- "Provider abstraction: Different providers support different parameters. Use provider-specific configuration rather than hardcoding assumptions."
- "Theme system only supports specific background colors: selectedBg, userMessageBg, customMessageBg, toolPendingBg, toolSuccessBg, toolErrorBg"

### Procedural (Workflow & Patterns)

Reusable workflows, patterns, and best practices.

**When to use:**
- Debugging workflows and troubleshooting patterns
- Integration patterns that work across projects
- Best practices for specific technologies
- Common problem-solving approaches
- Design patterns that proved effective

**Examples:**
- "Defensive programming pattern: When working with external data, always assume fields may be undefined. Use optional chaining (?.) or defaults (||)."
- "Runtime initialization timing: Defer API calls until after initialization completes. Use lifecycle events to safely access APIs."
- "UI state machines: Distinguish between input mode, display mode, and confirmation mode. Use explicit flags and invalidate cache on state changes."

## Search Modes

### Hybrid (Default)

Combines all search strategies for best results. Automatically weights each approach based on the query.

```bash
mmry search "what caused the api timeout last week" --mode hybrid
```

### Semantic

Finds conceptually similar memories using embeddings. Best for vague or high-level queries.

```bash
mmry search "performance issues" --mode semantic
```

### Keyword

Exact word matching. Best for specific technical terms.

```bash
mmry search "N+1 query" --mode keyword
```

### Fuzzy

Typo-tolerant matching. Best when you're not sure of exact wording.

```bash
mmry search "databse connection" --mode fuzzy
```

### BM25

Statistical relevance ranking (like search engines). Good for longer queries.

```bash
mmry search "how do I fix slow database queries" --mode bm25
```

### Sparse

Neural sparse embeddings (SPLADE++). Learned term importance.

```bash
mmry search "api timeout errors" --mode sparse
```

## Organizing Memories

### Categories

Group memories by domain or project.

```bash
mmry add "Sprint planning notes" --category work
mmry add "Rust ownership rules" --category learning
mmry search "notes" --category work
```

### Tags

Add multiple tags for flexible filtering.

```bash
mmry add "Fixed race condition" --tags "bugs,concurrency,fixed"
mmry add "Team meeting" --tags "team,planning,q1"
```

### Importance

Mark critical memories (1-10 scale).

```bash
mmry add "Production database is read-only" --importance 10
mmry add "Nice-to-know optimization" --importance 3
```

## Agent Memory Workflows

### Decision History

Track architectural decisions and their rationale.

```bash
# Agent adds after deciding to use PostgreSQL
mmry add "Chose PostgreSQL over MongoDB for: 1) ACID guarantees, 2) Complex queries, 3) Team expertise" \
  --category architecture --tags "database,decision" --importance 9
```

### Learning from Errors

Store debugging insights for future reference.

```bash
# Agent adds after fixing a bug
mmry add "N+1 query bug in user service: symptom was slow API, found with query profiler, fixed with eager loading" \
  --category debugging --tags "performance,sql" --importance 8
```

### Pattern Recognition

Search for similar past situations when facing new problems.

```bash
# Agent searches when encountering similar issue
mmry search "timeout errors" --mode semantic
# Returns: past timeout issues and how they were resolved
```

### Context Accumulation

Build richer context over time.

```bash
# Session 1: Learn about system
mmry add "API has 1000 req/min rate limit" --category api

# Session 2: Learn about deployment
mmry add "Deployments take ~15 min, need to coordinate with team" --category deployment

# Session 3: Search to understand system better
mmry search "api deployment" --mode semantic
# Returns both memories, providing full context
```

## Integration with Other Tools

### With Todos

- **Todos**: Current sprint tasks ("Fix bug X")
- **Memories**: Why bug X happened and how to prevent it

```bash
# During session: add todo
todo add "Fix N+1 query bug"

# After fixing: add memory
mmry add "N+1 query in user service, caused by missing eager loading" --category debugging
```

### With Skills

- **Skills**: How to use a framework
- **Memories**: How you used it in this project

```bash
# Skill: "How to use React hooks"
# Memory: "Used useCallback to optimize re-renders in dashboard component"
```

### With Session Context

- **Session history**: What happened in this conversation
- **Memories**: Persistent insights from many sessions

```bash
# Session 1: Discover issue
# Session 2: Search memories to find similar issues from past
# Session 3: Apply learned solution
```

## Memory Philosophy: Essence Over History

**Memories are for capturing insights and principles, not task logs.**

### What to Store

✅ **Store principles and patterns** - Insights that improve decision-making
- "Defensive programming: Always assume external data may be incomplete or malformed"
- "Sandbox constraints: Mounted paths may not be recognized by validation logic"
- "Provider abstraction: Different providers support different parameters"

✅ **Store learned lessons** - What worked and why
- "N+1 query problem in user service: symptom was slow API, root cause was missing eager loading"
- "TypeScript chosen over Python for: type safety, existing codebase, team expertise"

✅ **Store system knowledge** - How things work
- "API rate limit is 1000 req/min"
- "Database migration takes ~5 minutes"

❌ **Don't store task logs** - What you did or what happened
- "Fixed N+1 query bug today"
- "Deployed new API to production"
- "Created mmry extension with 525 lines of TypeScript"

❌ **Don't store session summaries** - Session history belongs in todos, not memories
- "Session 2026-02-25: Fixed X, created Y, extracted Z"
- "Completed mmry extension for badrobots project"

### Best Practices

### Be Specific About Essence

Good: "Defensive programming: Always check if external data fields exist before accessing them. Use optional chaining (?.) or defaults (||) to prevent crashes in rendering code."
Bad: "Fixed a bug"

Good: "Sandbox constraints: Network access and path validation are restricted by design. Design integrations to work within constraints rather than fight them."
Bad: "Network sandboxing in Gondolin"

### Include Context and Why

Good: "Database migration failed because of missing index on user_id. Solution: add index before migration. Lesson: always check dependencies before running migrations."
Bad: "Migration failed"

### Link Related Memories

Use consistent terminology and categories so searches find related memories.

```bash
mmry add "Defensive programming: Check external data before accessing" --category programming-principles
mmry add "TUI rendering: Always provide defaults for optional fields" --category programming-principles
# Now searching for "defensive" finds both related principles
```

### Regular Cleanup

Delete outdated memories and consolidate related ones.

```bash
# Delete: task logs, session summaries, duplicate principles
mmry delete <old-id> --yes

# Keep: principles, patterns, learned lessons
mmry ls --category programming-principles
```

### Use Importance Strategically

```bash
# Critical principles (importance 8-10)
mmry add "Always validate theme colors against allowed list" --importance 9

# Useful patterns (importance 6-7)
mmry add "Using batch queries can improve performance by 20%" --importance 6

# Nice-to-know (importance 1-5)
mmry add "Optional optimization technique" --importance 3
```

## Common Patterns

### Principle Extraction from Debugging

When you solve a problem, extract the principle, not the task.

```bash
# ❌ DON'T: Store the task
mmry add "Fixed N+1 query in user service today" --category debugging

# ✅ DO: Store the principle
mmry add "N+1 Query Pattern: Symptom is slow API response. Root cause is missing eager loading. Solution: add eager loading to relationship. Applies to all ORMs." \
  --category debugging --tags "performance,sql" --memory-type semantic

# Next time: search for the principle
mmry search "slow api performance" --mode semantic
# Returns the principle, applicable to new problems
```

### Constraint Discovery

When you discover a system constraint, capture it as a principle.

```bash
# ❌ DON'T: Store the event
mmry add "Gondolin path validation rejected mounted paths"

# ✅ DO: Store the principle
mmry add "Sandbox Boundary Principle: When integrating with sandboxed systems, recognize that path validation, network access, and environment variables are constrained by design. Design integrations to work within constraints rather than fight them." \
  --category system-design --tags "sandboxing,constraints" --memory-type semantic
```

### Pattern Recognition Across Projects

Build a knowledge base of patterns that apply everywhere.

```bash
# Session 1: Learn pattern in Project A
mmry add "Defensive Programming: Always assume external data may be incomplete or malformed. Use optional chaining (?.) or defaults (||) to prevent crashes." \
  --category programming-principles --importance 9

# Session 2: Apply pattern in Project B
mmry search "defensive programming" --mode semantic
# Returns the principle learned in Project A
# Apply it to prevent similar bugs in Project B
```

### Decision Rationale

Record why decisions were made, not just what was decided.

```bash
# ✅ GOOD: Capture the reasoning
mmry add "Chose TypeScript over Python for: 1) Type safety catches bugs early, 2) Existing codebase is TypeScript, 3) Team has more TypeScript expertise" \
  --category architecture --tags "decision,language" --importance 9

# Later: search for similar decisions
mmry search "language choice" --mode semantic
# Returns decision rationale for reference
```

## Configuration

mmry stores config at `~/.config/mmry/config.toml`. Key settings:

```toml
[search]
mode = "hybrid"              # Default search mode
similarity_threshold = 0.7   # Semantic similarity threshold

[embeddings]
model = "Xenova/all-MiniLM-L6-v2"  # Fast local model

[service]
enabled = true              # Enable service mode for faster embeddings
auto_start = true          # Auto-start service when needed
idle_timeout_seconds = 300  # Unload models after 5 minutes idle
```

## Troubleshooting

**Q: Memory not found in search**
A: Try different search modes (semantic vs keyword). Semantic search finds conceptually similar memories even if wording differs.

**Q: Embeddings are slow**
A: Enable service mode in config (`service.enabled = true`). First embedding takes 2-3s, then ~10-50ms with service running.

**Q: Want to rebuild embeddings**
A: Run `mmry reembed --force` after changing the embedding model.

**Q: How do I export memories?**
A: Use `mmry ls --json | jq` to export as JSON, then pipe to other tools.

## See Also

- **Todos**: For session-scoped task management
- **Skills**: For procedural knowledge and how-to guides
- **mmry GitHub**: https://github.com/byteowlz/mmry
