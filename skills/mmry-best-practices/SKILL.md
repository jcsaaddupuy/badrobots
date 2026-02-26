---
name: mmry-best-practices
description: "Memory creation best practices: categorization, tagging, metadata"
---

# mmry Best Practices - Memory Creation Guidelines

## Core Rule: ALWAYS Add Categories and Tags

**NEVER create a memory without categories and tags.** Every memory must have:
1. **memory_type**: episodic | semantic | procedural | preferences
2. **category**: Organize by domain/topic
3. **tags**: 3-5 tags for filtering and discovery
4. **importance**: 1-10 scale (critical decisions)

## Memory Type Selection

### Semantic (Facts & Principles)
- Technical specifications and limits
- System architecture and constraints
- General programming principles
- Integration patterns and best practices
- Design decisions and their rationale
- Lessons learned from debugging
- Explicit user preferences and work patterns

**Tags**: Use domain-specific tags (e.g., `architecture`, `database`, `api`, `security`)

**Categories**: `Architecture`, `Design Principles`, `System Knowledge`, `Best Practices`

### Procedural (Workflows & Patterns)
- Debugging workflows and troubleshooting patterns
- Integration patterns that work across projects
- Best practices for specific technologies
- Common problem-solving approaches
- Design patterns that proved effective
- Tool usage patterns and CLI integrations

**Tags**: Use action-oriented tags (e.g., `debugging`, `workflow`, `pattern`, `integration`)

**Categories**: `Tool Development`, `Debugging`, `Workflows`, `Integration Patterns`

### Episodic (Events & Experiences)
- Insights and lessons from specific experiences
- Architectural decisions and their rationale
- Constraints discovered through integration work
- User preferences and work patterns
- Project-specific information for future reference

**Tags**: Use context tags (e.g., `project-name`, `decision`, `constraint`, `lesson`)

**Categories**: `Project Context`, `Lessons Learned`, `Constraints`, `Decisions`

## Category Guidelines

**Use consistent, reusable categories:**

- `Architecture` - System design, component relationships
- `Design Principles` - Patterns, anti-patterns, best practices
- `Tool Development` - Extension development, tool integration
- `Debugging` - Troubleshooting workflows, root cause analysis
- `Workflows` - Procedures, step-by-step processes
- `Integration Patterns` - How to integrate systems/tools
- `System Knowledge` - How things work, constraints
- `Storage` - Database, cache, persistence patterns
- `Performance` - Optimization, scaling, profiling
- `Security` - Authentication, authorization, encryption
- `Project Context` - Project-specific information
- `Lessons Learned` - What worked, why, when to apply

## Tag Guidelines

**Use 3-5 tags per memory. Tags should be:**
- Lowercase with hyphens (e.g., `json-parsing`, `cli-integration`)
- Specific enough to find related memories
- General enough to group similar concepts

**Common tag patterns:**

- **Technology tags**: `postgresql`, `redis`, `typescript`, `nodejs`, `python`
- **Domain tags**: `database`, `api`, `ui`, `testing`, `deployment`
- **Pattern tags**: `debugging`, `integration`, `optimization`, `validation`
- **Scope tags**: `architecture`, `tool-development`, `extension`, `workflow`
- **Status tags**: `best-practice`, `anti-pattern`, `pitfall`, `lesson-learned`

## Importance Scale

```
10 - Critical: Production-breaking, security issues, core principles
9  - High: Important patterns, major design decisions, key constraints
8  - Important: Useful patterns, common workflows, helpful techniques
7  - Moderate: Nice-to-know optimizations, alternative approaches
6  - Low: Interesting but not immediately useful
1-5 - Optional: Experimental, edge cases, nice-to-haves
```

## Memory Creation Template

### Semantic Memory
```
memory action=add \
  content="PRINCIPLE NAME: Description of principle. Why it matters. When to apply it. Example." \
  type=semantic \
  category="Design Principles" \
  tags="tag1,tag2,tag3" \
  importance=9
```

### Procedural Memory
```
memory action=add \
  content="WORKFLOW NAME: (1) Step one, (2) Step two, (3) Step three. Why this works. When to use. Common pitfalls." \
  type=procedural \
  category="Workflows" \
  tags="workflow,debugging,tool-name" \
  importance=8
```

### Episodic Memory
```
memory action=add \
  content="INSIGHT NAME: What I learned. Why it matters. How to apply it. Context where discovered." \
  type=episodic \
  category="Lessons Learned" \
  tags="project-name,lesson,decision" \
  importance=8
```

## Search & Discovery

### Searching by Category
```
# Find all architecture principles
memory action=search query="architecture" type=semantic category="Architecture"

# Find all debugging workflows
memory action=search query="debugging" type=procedural category="Debugging"
```

### Searching by Tags
```
# Find memories about JSON parsing
memory action=search query="json" mode=semantic

# Then filter by tags in results
```

### Semantic Search
```
# Find conceptually similar memories
memory action=search query="infrastructure vs storage" mode=semantic

# This finds related principles even with different wording
```

## Real Examples

### ✅ GOOD: Semantic Memory with Full Metadata
```
memory action=add \
  content="STORAGE ARCHITECTURE FOR TEXT-TO-SQL AGENT: PostgreSQL + pgvector for whatisit embeddings (persistent). Redis for whatisit RQ queue (ephemeral). Agent is stateless (no storage). Key insight: Don't confuse infrastructure components with application storage needs." \
  type=semantic \
  category="Architecture - Storage" \
  tags="postgresql,redis,storage,architecture,text-to-sql" \
  importance=10
```

### ✅ GOOD: Procedural Memory with Full Metadata
```
memory action=add \
  content="TOOL DEBUGGING PATTERN: When tool returns 0 results but CLI works: (1) Test CLI directly, (2) Check JSON structure with jq, (3) Verify parser handles all formats, (4) Test multiple commands, (5) Fix at parser level. Root cause usually JSON parsing." \
  type=procedural \
  category="Tool Development" \
  tags="debugging,tool-development,json-parsing,cli-integration" \
  importance=8
```

### ❌ BAD: Bare Memory (No Categories/Tags)
```
memory action=add content="Some random principle"
# Missing: type, category, tags, importance
```

### ❌ BAD: Task Log (Not Essence)
```
memory action=add content="Fixed JSON parser bug in mmry tool today"
# This is history, not essence. Should be: "JSON Parser Pattern: ..."
```

## Checklist Before Adding Memory

- [ ] Memory captures **essence** (principle/pattern), not **history** (what I did)
- [ ] **memory_type** is correct (semantic/procedural/episodic)
- [ ] **category** is consistent with existing categories
- [ ] **tags** are 3-5 specific, lowercase, hyphenated
- [ ] **importance** is 1-10 scale (not vague)
- [ ] **content** is clear, actionable, includes "why" and "when"
- [ ] No duplicates of existing memories (search first)

## Maintenance

### Regular Cleanup
- Delete duplicate memories (same principle, different wording)
- Delete task logs (history, not essence)
- Delete outdated information (update instead)
- Consolidate related memories if they overlap

### Regular Updates
- Update memories when new insights emerge
- Add examples when patterns become clearer
- Expand "when to apply" sections with real use cases
- Update importance if understanding changes

## Integration with Other Tools

### With Todos
- **Todos**: Current sprint tasks ("Fix bug X")
- **Memories**: Why bug X happened and how to prevent it

### With Skills
- **Skills**: How to use a framework/tool
- **Memories**: How you used it in this project, patterns discovered

### With Session Context
- **Session history**: What happened in this conversation
- **Memories**: Persistent insights from many sessions
