---
name: commit
description: "Read this skill before making git commits"
---

# Git Commit - Agent Usage Guide

Create git commits using Conventional Commits format with clear, concise messages.

## Quick Decision: Should I Push?

**User says "commit"** → ✅ Commit only, do NOT push
**User says "commit and push"** → ✅ Commit AND push
**User says "push"** (after previous commit) → ✅ Push only

## Format

`<type>(<scope>): <summary>`

- `type` REQUIRED. Use `feat` for new features, `fix` for bug fixes. Other common types: `docs`, `refactor`, `chore`, `test`, `perf`.
- `scope` OPTIONAL. Short noun in parentheses for the affected area (e.g., `api`, `parser`, `ui`, `docker`, `ci`).
- `summary` REQUIRED. Short, imperative, <= 72 chars, no trailing period.

## Commit Type Guide

| Type | When to Use | Example |
|------|-------------|---------|
| `feat` | New feature or capability | `feat(auth): add OAuth2 support` |
| `fix` | Bug fix | `fix(api): handle null response` |
| `docs` | Documentation only | `docs(readme): update install steps` |
| `refactor` | Code change with no feature/fix | `refactor(parser): simplify logic` |
| `chore` | Maintenance, dependencies | `chore(deps): update numpy to 2.4.2` |
| `test` | Adding or updating tests | `test(auth): add login edge cases` |
| `perf` | Performance improvement | `perf(db): optimize query` |
| `style` | Code style/formatting | `style: apply black formatting` |
| `ci` | CI/CD changes | `ci: add coverage report` |
| `build` | Build system changes | `build: update webpack config` |

## Scope Selection

**Common scopes by project type:**

**Python Projects:**
- `api`, `cli`, `models`, `services`, `utils`, `tests`, `deps`

**Docker Projects:**
- `docker`, `compose`, `dockerfile`, `ci`

**Frontend Projects:**
- `ui`, `components`, `styles`, `router`, `store`

**Infrastructure:**
- `ci`, `deploy`, `config`, `scripts`

**To find commonly used scopes:**
```bash
git log -n 50 --pretty=format:%s | grep -E '^\w+\(' | sed 's/.*(\(.*\)):.*/\1/' | sort | uniq -c | sort -rn
```

## Message Guidelines

### Summary Rules
- Start with lowercase verb (imperative mood)
- No period at the end
- Keep under 72 characters
- Be specific and concise

### Good vs Bad Examples

```bash
# ✅ GOOD
feat(auth): add JWT token validation
fix(docker): update libglib2.0-0 to available version
chore(deps): upgrade numpy to 2.4.2
test(api): add edge cases for empty input
docs(readme): clarify installation steps

# ❌ BAD
feat: stuff  # Too vague
Fix bug  # No scope, not imperative, vague
feat(auth): Added the JWT token validation.  # Past tense, period
WIP  # No type, meaningless
Updated dependencies  # No type, too generic
```

## Handling Pre-commit Hooks

Pre-commit hooks may run automatically and:
- ✅ Format code (black, prettier)
- ✅ Lint code (ruff, eslint)
- ✅ Run security checks (gitleaks)
- ❌ Fail if issues found

### If Pre-commit Hook Fails

```bash
# 1. Read the error message
# Hook will show what failed (formatting, linting, security)

# 2. Fix the issues
# - For formatting: Let hook auto-fix, then re-stage
git add <files>
git commit -m "message"  # Hook auto-fixes
git add <fixes>          # Stage hook's fixes
git commit -m "message"  # Commit again

# - For linting: Fix manually
# Review linter output and fix issues
git add <files>
git commit -m "message"

# - For security: Remove secrets, never use --no-verify
# Remove the secret from code
git add <files>
git commit -m "message"

# 3. NEVER skip hooks with --no-verify unless absolutely necessary
# --no-verify bypasses security checks - only use in emergencies
```

### Pre-commit Hook Workflow Example

```bash
# Make changes
vim src/module.py

# Stage changes
git add src/module.py

# Attempt commit
git commit -m "feat(api): add new endpoint"

# If black reformats:
# black will auto-format and show changes
# Files were modified by hook
# Commit was blocked

# Re-stage formatted files
git add src/module.py

# Commit again (should succeed now)
git commit -m "feat(api): add new endpoint"
```

## Complete Workflow

### Basic Commit Workflow

```bash
# 1. Check status
git status

# 2. Review changes
git diff

# 3. Stage files
git add <file1> <file2>
# or stage all
git add .

# 4. Check commonly used scopes (optional)
git log -n 50 --pretty=format:%s | head -20

# 5. Commit with message
git commit -m "type(scope): summary"

# 6. If hooks fail, fix and re-commit
# See "Handling Pre-commit Hooks" section

# 7. Push if user requested it
git push
# or
git push -u origin branch-name  # First time pushing branch
```

### Commit with Body (For Complex Changes)

```bash
git commit -m "type(scope): summary" -m "
More detailed explanation of the change.

- Bullet points for multiple changes
- Can include reasoning
- Can reference issues
"
```

### Amending Last Commit

```bash
# Fix something in last commit (not pushed yet)
git add <forgotten-file>
git commit --amend --no-edit

# Change last commit message
git commit --amend -m "corrected message"

# ⚠️ NEVER amend commits that have been pushed (unless on feature branch alone)
```

## Special Cases

### Multiple Files, Different Changes

If changes don't belong together:

```bash
# Commit in logical groups
git add src/auth.py tests/test_auth.py
git commit -m "feat(auth): add OAuth2 support"

git add src/api.py tests/test_api.py  
git commit -m "fix(api): handle null response"
```

### Partial File Staging

```bash
# Stage only parts of a file
git add -p file.py

# Will prompt for each change:
# y - stage this hunk
# n - don't stage
# s - split into smaller hunks
# q - quit
```

### Stashing Changes

```bash
# Save uncommitted changes temporarily
git stash

# Do other work, make commits

# Restore stashed changes
git stash pop
```

## Notes

- Body is OPTIONAL. Use `-m` twice if needed (one for subject, one for body)
- Do NOT include breaking-change markers or footers (keep it simple)
- Do NOT add sign-offs (no `Signed-off-by`)
- Only commit; do NOT push unless user explicitly requests
- If unclear whether a file should be included, ask the user which files to commit
- Treat any caller-provided arguments as additional commit guidance

## Argument Handling

Common patterns:

- **Freeform instructions** → Influence scope, summary, and body
- **File paths/globs** → Limit which files to commit (only stage those)
- **Combined (files + instructions)** → Honor both

Examples:
```bash
# User: "commit the api changes"
# → Stage api-related files, use scope "api"

# User: "commit src/auth.py with message about OAuth"
# → Stage only src/auth.py, use message mentioning OAuth

# User: "commit all changes"
# → Stage all files (git add .)
```

## Steps (Agent Workflow)

1. **Infer from prompt**
   - Did user provide specific file paths/globs?
   - Did user provide additional instructions?
   - Did user say "push"?

2. **Review changes**
   - Run `git status` to see what's changed
   - Run `git diff` to understand the changes
   - Limit to argument-specified files if provided

3. **Check common scopes** (optional)
   - Run `git log -n 50 --pretty=format:%s` to see commonly used scopes
   - Helps maintain consistency

4. **Handle ambiguity**
   - If there are ambiguous extra files, ask the user for clarification
   - Don't assume what should be included

5. **Stage files**
   - Stage only the intended files (all changes if no files specified)
   - Use `git add <files>` or `git add .`

6. **Commit**
   - Run `git commit -m "<type>(<scope>): <summary>"`
   - Add `-m "<body>"` if a body is needed
   - If pre-commit hooks fail, fix issues and re-commit

7. **Push (if requested)**
   - Only push if user said "commit and push" or just "push"
   - Use `git push` or `git push -u origin <branch>` for new branches
   - Never push after just "commit" command

## Quick Reference

| User Request | Action |
|--------------|--------|
| "commit" | Commit only |
| "commit and push" | Commit then push |
| "push" | Push only (after commit) |
| "commit the api changes" | Stage api files, commit with scope "api" |
| "commit everything" | Stage all files, commit |
| "amend" or "fix last commit" | Use `git commit --amend` |

## Examples of Complete Messages

```bash
# Feature
git commit -m "feat(auth): add OAuth2 authentication flow"

# Bug fix  
git commit -m "fix(docker): update libglib2.0-0 to available version 2.80.0-6ubuntu3.8"

# Chore/dependency
git commit -m "chore(deps): upgrade numpy to 2.4.2 and polars to 1.38.1"

# Tests
git commit -m "test(api): add edge case tests for null responses"

# Documentation
git commit -m "docs(readme): add installation instructions for Docker"

# Refactoring
git commit -m "refactor(parser): simplify regex matching logic"

# Performance
git commit -m "perf(db): optimize user query with index"

# CI/CD
git commit -m "ci: add pipeline job for integration tests"

# With body
git commit -m "fix(api): handle timeout errors gracefully" -m "
Added retry logic with exponential backoff for API timeouts.
Prevents cascading failures when external service is slow.
"
```

## Common Mistakes to Avoid

1. ❌ **Pushing when user said "commit"** → ✅ Only commit
2. ❌ **Using --no-verify to skip hooks** → ✅ Fix the issues instead
3. ❌ **Vague messages like "fix stuff"** → ✅ Be specific
4. ❌ **Past tense "added feature"** → ✅ Imperative "add feature"
5. ❌ **Period at end of summary** → ✅ No period
6. ❌ **Multiple unrelated changes in one commit** → ✅ Split into logical commits
7. ❌ **Amending pushed commits** → ✅ Only amend unpushed commits
8. ❌ **Huge commits** → ✅ Commit logical units of work
