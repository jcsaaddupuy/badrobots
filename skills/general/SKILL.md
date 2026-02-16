---
name: general
description: General coding rules and principles for all projects
---

# General Coding Principles - Agent Usage Guide

## Core Philosophy
- **KEEP IT SIMPLE** - Prefer straightforward solutions over clever ones
- **DO NOT BE OVERLY VERBOSE** - Be concise in code and communication
- **AVOID OVER-COMPLICATION** - Don't add complexity without clear benefit

## Quick Decision Tree

```
User Request
    ↓
Is it a specific technology? → Use specialized skill
    ├─ Python → python skill
    ├─ Docker → docker skill  
    ├─ GitLab CI → gitlab-ci or pipeline-fix skill
    ├─ Git operations → commit skill
    └─ GitLab queries → glab skill
    ↓
General task → Follow General Workflow below
```

## General Workflow for Any Task

```
1. Understand the Request
   ├─ What is the user asking for?
   ├─ What technology/language is involved?
   └─ Is there an existing codebase to respect?
   ↓
2. Gather Context
   ├─ Check for existing project structure
   ├─ Identify coding style in use
   ├─ Look for configuration files (.gitignore, pyproject.toml, etc.)
   └─ Check for documentation or README
   ↓
3. Choose Appropriate Skill(s)
   ├─ Read relevant skill file(s)
   ├─ Follow skill-specific workflows
   └─ Combine multiple skills if needed
   ↓
4. Plan Implementation
   ├─ Keep it simple
   ├─ Follow existing patterns
   └─ Don't over-engineer
   ↓
5. Execute
   ├─ Write code/config
   ├─ Add tests if applicable
   └─ Validate/lint/format
   ↓
6. Verify
   ├─ Test the solution
   ├─ Check for errors
   └─ Ensure requirements met
   ↓
7. Communicate Results
   ├─ Be concise
   ├─ Show what was done
   └─ Report any issues
```

## Documentation & Reporting

### What NOT to Generate
- ❌ Emojis in generated markdown (unless user explicitly requests them)
- ❌ Excessive reporting (code comments, docstrings, markdown files, chat messages)
- ❌ README files unless absolutely necessary or requested
- ❌ Documentation files after each change unless requested
- ❌ Over-explained trivial code
- ❌ Redundant comments that repeat the code

### What to Generate
- ✅ Clear, concise code comments only when necessary
- ✅ Essential docstrings for public APIs
- ✅ Minimal but informative markdown when needed
- ✅ Inline comments for complex logic or non-obvious behavior
- ✅ Function/class docstrings with params, returns, raises

### Example: Good vs Bad Comments

```python
# ❌ BAD - States the obvious
# Increment counter by 1
counter += 1

# ✅ GOOD - Explains why
# Skip first item as it's always the header row
counter += 1

# ❌ BAD - Too verbose
"""
This function takes a list of numbers and returns the sum.
It iterates through each number in the list and adds it to
a running total, which is then returned at the end.
"""
def sum_numbers(numbers: list[int]) -> int:
    return sum(numbers)

# ✅ GOOD - Concise and informative
def sum_numbers(numbers: list[int]) -> int:
    """Return the sum of numbers."""
    return sum(numbers)
```

## Code Organization

### Standard Folder Structure
```
project/
├── src/                    # Source code
├── tests/                  # Test files (same level as src/)
├── scripts/                # Helper/utility scripts
├── examples/               # Example code and usage
├── reports/                # Generated reports/summaries
├── troubleshoot/           # Troubleshooting resources
│   └── scripts/            # Diagnostic scripts
├── docs/                   # Documentation (if extensive)
├── .gitignore             # Git ignore rules
├── README.md              # Project overview
└── pyproject.toml         # Project config (Python projects)
```

### Folder Usage Rules

**Helper Scripts** → `scripts/`
```bash
# Example: scripts/setup.sh
#!/bin/bash
# Setup development environment
```

**Reports & Summaries** → `reports/`
```bash
# Example: reports/analysis-2024-02-16.md
```

**Example Code** → `examples/`
```python
# Example: examples/basic_usage.py
```

**Troubleshooting** → `troubleshoot/scripts/`
```bash
# Example: troubleshoot/scripts/check_environment.sh
```

### Repository Structure Rules

1. **Verify before modifying**
   - Check `git log` to understand project history
   - Look at existing file organization
   - Read any CONTRIBUTING.md or style guides

2. **Respect existing style**
   - Match indentation (spaces vs tabs, 2 vs 4 spaces)
   - Follow naming conventions (camelCase, snake_case, etc.)
   - Use same quote style (single vs double)

3. **Respect existing architecture**
   - Don't introduce new patterns without good reason
   - Follow established separation of concerns
   - Use existing abstractions/interfaces

## Git Workflow

### Branch Naming Convention
```bash
# Standard format
copilot-feature/<feature-name>

# Examples
copilot-feature/add-authentication
copilot-feature/fix-memory-leak
copilot-feature/refactor-database-layer

# Create and switch to feature branch
git checkout -b copilot-feature/my-feature
```

### When to Create a Branch
- ✅ Always for new features
- ✅ Always for bug fixes
- ✅ Always for refactoring
- ❌ Not for trivial changes (typos, formatting) on existing branch
- ❌ Not if user specifies an existing branch to work on

### Branch Workflow Example
```bash
# Start new work
git checkout main
git pull
git checkout -b copilot-feature/new-feature

# Make changes, test, commit
# ... do work ...
git add <files>
git commit -m "feat(scope): description"

# Push when ready (see commit skill for guidance)
git push -u origin copilot-feature/new-feature
```

## Development Tasks

### Feature Implementation Checklist

When implementing a new feature:

- [ ] Understand requirements clearly
- [ ] Check existing codebase for similar patterns
- [ ] Choose appropriate location (src/, lib/, etc.)
- [ ] Write code with type hints (if applicable)
- [ ] Add docstrings for public APIs
- [ ] Create corresponding test file
- [ ] Write unit tests covering:
  - [ ] Happy path (expected usage)
  - [ ] Edge cases (empty input, null, extremes)
  - [ ] Error cases (invalid input, exceptions)
- [ ] Run tests locally
- [ ] Consider integration tests if applicable
- [ ] Lint/format code
- [ ] Commit with proper message format

### Testing Structure

**Unit Tests**:
- Location: `tests/` folder at same level as `src/`
- Naming: `test_<module>.py` for `src/<module>.py`
- Framework: pytest (Python), jest (JavaScript), etc.
- Coverage: Aim for 80%+ coverage on new code

**Integration Tests**:
- When: Testing multiple components together
- How: Use Docker Compose for dependencies (databases, services)
- Location: `tests/integration/` or separate from unit tests

**Example Test Structure**:
```
project/
├── src/
│   ├── auth.py
│   └── database.py
└── tests/
    ├── test_auth.py          # Unit tests for auth
    ├── test_database.py      # Unit tests for database
    └── integration/
        └── test_auth_flow.py # Integration tests
```

## Troubleshooting Workflow

### When Something Fails

```
1. Read the Error Message
   ├─ What is the actual error?
   ├─ What file/line is mentioned?
   └─ Is it a syntax, type, runtime, or logic error?
   ↓
2. Check Recent Changes
   ├─ What was modified last?
   ├─ git diff to see changes
   └─ Can you revert to working state?
   ↓
3. Isolate the Problem
   ├─ Can you reproduce it?
   ├─ Is it consistent or intermittent?
   └─ What's the minimal code to trigger it?
   ↓
4. Gather Information
   ├─ Check logs
   ├─ Add debug statements
   ├─ Run with verbose flags
   └─ Check environment (versions, config)
   ↓
5. Generate Diagnostic Script (if complex)
   └─ Save to troubleshoot/scripts/
   ↓
6. Apply Fix
   ├─ Make minimal change to fix
   ├─ Test the fix
   └─ Add test to prevent regression
   ↓
7. Document (if non-obvious)
   └─ Add comment explaining the fix
```

### Troubleshooting Script Example

```bash
# troubleshoot/scripts/check_environment.sh
#!/bin/bash
# Check if environment is properly configured

echo "=== Environment Check ==="

# Check Python version
python --version

# Check installed packages
pip list | grep -E "requests|pydantic"

# Check environment variables
echo "API_KEY set: $([ -n "$API_KEY" ] && echo "yes" || echo "no")"

# Check Docker
docker --version
docker compose version

# Check GitLab connectivity
glab auth status

echo "=== Check Complete ==="
```

## Cross-Skill Integration

### Combining Multiple Skills

**Example 1: Python + Docker + GitLab CI**
```
Task: Deploy Python app
1. Use python skill → Structure code, write tests
2. Use docker skill → Create Dockerfile
3. Use gitlab-ci skill → Setup CI/CD pipeline
4. Use commit skill → Commit all changes
```

**Example 2: Fix Failing Pipeline**
```
Task: Pipeline failed in MR
1. Use glab skill → Get pipeline info
2. Use pipeline-fix skill → Diagnose and fix
3. Use commit skill → Commit the fix
4. Verify with glab skill → Check new pipeline
```

**Example 3: New Python Project Setup**
```
Task: Create new Python project
1. Use python skill → Create project structure
2. Use gitignore skill → Generate .gitignore
3. Use gitlab-ci skill → Add CI/CD config
4. Use commit skill → Initial commit
```

## When to Use Which Skill

| Task | Primary Skill | Supporting Skills |
|------|---------------|-------------------|
| Write Python code | python | general, python-uv |
| Create Dockerfile | docker | general |
| Setup CI/CD | gitlab-ci | docker, python, pipeline-fix |
| Fix failed pipeline | pipeline-fix | glab, gitlab-ci |
| Query GitLab | glab | - |
| Make git commit | commit | general |
| Generate .gitignore | gitignore | - |
| Work with LangGraph | langgraph | python, openai |
| Create diagrams | mermaid | - |
| Use OpenAI API | openai | python |
| Control tmux | tmux | - |

## Common Anti-Patterns to Avoid

### 1. Over-Engineering
```python
# ❌ BAD - Over-complicated
class SingletonMetaclass(type):
    _instances = {}
    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]

class Config(metaclass=SingletonMetaclass):
    pass

# ✅ GOOD - Simple module-level instance
# config.py
class Config:
    def __init__(self):
        self.value = "default"

config = Config()  # Single instance
```

### 2. Premature Optimization
```python
# ❌ BAD - Optimizing before knowing it's slow
from functools import lru_cache

@lru_cache(maxsize=1000)
def simple_addition(a: int, b: int) -> int:
    return a + b

# ✅ GOOD - Write simple code first
def simple_addition(a: int, b: int) -> int:
    return a + b
# Optimize later if profiling shows it's a bottleneck
```

### 3. Not Following Existing Patterns
```python
# Existing code uses:
def get_user(id: int) -> User:
    ...

def get_post(id: int) -> Post:
    ...

# ❌ BAD - Different pattern
def fetch_comment(comment_id: int) -> Comment:
    ...

# ✅ GOOD - Follow existing pattern
def get_comment(id: int) -> Comment:
    ...
```

### 4. Ignoring Project Structure
```
# Existing structure:
src/
  services/
  models/
  utils/

# ❌ BAD - New pattern
src/
  helpers/  # Don't introduce new top-level folders
  
# ✅ GOOD - Use existing structure
src/
  utils/    # Add to existing folder
```

## Quick Reference

| Situation | Action |
|-----------|--------|
| New Python project | Read python skill |
| Docker container needed | Read docker skill |
| CI/CD pipeline failing | Read pipeline-fix skill |
| Need GitLab info | Read glab skill |
| Ready to commit | Read commit skill |
| Need .gitignore | Read gitignore skill |
| Complex system | Combine multiple skills |
| Unsure what to do | Follow General Workflow above |

## Cross-References

Read specific skill files for detailed guidance:

- **Commit & Git**: [commit](../commit/SKILL.md)
- **Python Development**: [python](../python/SKILL.md), [python-uv](../python-uv/SKILL.md)
- **Containers**: [docker](../docker/SKILL.md)
- **CI/CD**: [gitlab-ci](../gitlab-ci/SKILL.md), [pipeline-fix](../pipeline-fix/SKILL.md)
- **GitLab CLI**: [glab](../glab/SKILL.md)
- **AI/ML**: [langgraph](../langgraph/SKILL.md), [openai](../openai/SKILL.md)
- **Utilities**: [gitignore](../gitignore/SKILL.md), [mermaid](../mermaid/SKILL.md), [tmux](../tmux/SKILL.md)
