---
name: git-worktree
description: "Manage multiple working directories with git worktree for parallel development"
---

# Git Worktree - Parallel Development Guide

## Core Concept

Git worktree allows you to maintain **multiple working directories** from a single repository. Each worktree can check out a different branch simultaneously, enabling parallel development without the need for stashing, switching branches, or cloning the repository multiple times.

**Key Benefits:**
- ✅ Work on multiple branches simultaneously
- ✅ Avoid constant branch switching and stashing
- ✅ Share the same `.git` directory (saves disk space)
- ✅ Faster than cloning repositories multiple times
- ✅ Perfect for hotfixes, feature development, code reviews

## How It Works

```
my-project/                    # Main worktree (original clone)
├── .git/                      # Shared Git database
│   └── worktrees/             # Worktree metadata
│       ├── feature-login/
│       └── hotfix-bug/
└── src/

my-project-feature-login/      # Linked worktree
└── src/                       # Same repo, different branch

my-project-hotfix/             # Another linked worktree
└── src/                       # Same repo, yet another branch
```

All worktrees share the same `.git` directory but have independent:
- Working directories (files you see)
- HEAD references
- Index (staging area)
- Checked out branches

## Command Reference

### 1. Add a Worktree

**Basic Usage:**
```bash
# Create new worktree with existing branch
git worktree add <path> <branch>

# Create new worktree with new branch
git worktree add -b <new-branch> <path> <start-point>
```

**Examples:**
```bash
# Checkout existing branch in new worktree
git worktree add ../my-project-feature feature/login

# Create new branch from main and check it out
git worktree add -b feature/new-ui ../my-project-ui main

# Create worktree for hotfix from current branch
git worktree add ../hotfix-123 -b hotfix/fix-crash

# Detached HEAD worktree (for testing specific commit)
git worktree add --detach ../test-commit abc1234

# Force add even if branch is already checked out elsewhere
git worktree add -f ../duplicate-work feature/login
```

**Options:**
- `-b <branch>` - Create new branch
- `-B <branch>` - Create/reset branch (overwrites if exists)
- `-f, --force` - Allow checking out branch already used by another worktree
- `--detach` - Create detached HEAD worktree
- `--lock` - Lock the worktree immediately after creation
- `--orphan` - Create new orphan branch (no history)
- `--checkout` / `--no-checkout` - Control whether to checkout files

### 2. List Worktrees

**Basic Usage:**
```bash
git worktree list
```

**Examples:**
```bash
# Default format (human-readable)
git worktree list

# Verbose output (includes branch, commit, lock status)
git worktree list -v

# Machine-parseable format
git worktree list --porcelain

# For scripting with null-terminated output
git worktree list --porcelain -z
```

**Sample Output:**
```bash
$ git worktree list
/Users/me/project              abc123 [main]
/Users/me/project-feature      def456 [feature/login]
/Users/me/project-hotfix       789ghi (detached HEAD)

$ git worktree list -v
/Users/me/project              abc123 [main]
/Users/me/project-feature      def456 [feature/login]
/Users/me/project-hotfix       789ghi (detached HEAD) locked
```

### 3. Remove a Worktree

**Basic Usage:**
```bash
git worktree remove <path>
```

**Examples:**
```bash
# Remove clean worktree
git worktree remove ../my-project-feature

# Force remove worktree with uncommitted changes
git worktree remove -f ../my-project-feature

# Force remove locked worktree (use -f twice)
git worktree remove -f -f ../locked-worktree
```

**Options:**
- `-f, --force` - Remove even with uncommitted changes
- Use `-f -f` (twice) to remove locked worktrees

**Manual Removal:**
If you delete a worktree directory manually:
```bash
# Clean up stale worktree references
git worktree prune
```

### 4. Move a Worktree

**Basic Usage:**
```bash
git worktree move <old-path> <new-path>
```

**Examples:**
```bash
# Move worktree to new location
git worktree move ../project-feature ../renamed-feature

# Move to different parent directory
git worktree move ../hotfix ~/workspace/hotfix
```

**Limitations:**
- Cannot move the main worktree
- Cannot move worktrees with submodules

### 5. Lock/Unlock Worktrees

**Purpose:** Prevent accidental removal or administrative pruning

**Lock:**
```bash
# Lock with reason
git worktree lock --reason "CI/CD in progress" ../ci-worktree

# Lock without reason
git worktree lock ../important-worktree
```

**Unlock:**
```bash
git worktree unlock ../ci-worktree
```

**Use Cases:**
- Worktree on network drive (prevent automatic pruning)
- Long-running CI/CD processes
- Shared worktrees in team environments
- Preventing accidental cleanup

### 6. Prune Stale Worktrees

**Purpose:** Clean up metadata for manually deleted worktrees

**Basic Usage:**
```bash
git worktree prune
```

**Examples:**
```bash
# Dry-run (show what would be removed)
git worktree prune -n

# Verbose output
git worktree prune -v

# Prune worktrees unused for 30 days
git worktree prune --expire 30.days.ago

# Prune everything immediately
git worktree prune --expire now
```

**When to Use:**
- After manually deleting worktree directories
- Cleaning up after disk failures
- Regular repository maintenance

### 7. Repair Worktrees

**Purpose:** Fix broken connections after moving repositories or worktrees manually

**Basic Usage:**
```bash
# Repair all worktrees
git worktree repair

# Repair specific worktree
git worktree repair ../broken-worktree

# Repair from within a worktree
cd ../broken-worktree
git worktree repair
```

**When to Use:**
- After moving the main repository directory
- After moving worktree directories manually
- When worktrees show errors about missing `.git` directory
- After restoring from backup

## Common Workflows

### Workflow 1: Feature Development + Hotfix

**Scenario:** Working on feature, urgent hotfix needed

```bash
# Currently working on feature in main worktree
cd ~/project
git checkout -b feature/new-ui

# Urgent bug reported! Create hotfix worktree
git worktree add -b hotfix/critical-bug ../project-hotfix main

# Work on hotfix in separate directory
cd ../project-hotfix
# ... fix bug ...
git commit -am "Fix critical bug"
git push origin hotfix/critical-bug

# Return to feature work (no branch switching!)
cd ~/project
# Continue working on feature...

# Clean up hotfix worktree after merge
git worktree remove ../project-hotfix
```

### Workflow 2: Code Review While Developing

**Scenario:** Review PR without interrupting current work

```bash
# Working on feature
cd ~/project
git checkout feature/payment

# Need to review teammate's PR
git worktree add ../project-review feature/teammate-work

# Review in separate window/IDE
cd ../project-review
# ... review code, test, comment ...

# Back to your work immediately
cd ~/project
# No stashing or branch switching needed!

# Clean up review worktree
git worktree remove ../project-review
```

### Workflow 3: Parallel Feature Development

**Scenario:** Working on multiple features simultaneously

```bash
cd ~/project

# Create worktrees for different features
git worktree add -b feature/auth ../project-auth main
git worktree add -b feature/payments ../project-payments main
git worktree add -b feature/analytics ../project-analytics main

# Work on each in separate terminal/IDE instance
# Each has its own uncommitted changes, no conflicts!

# List all active worktrees
git worktree list

# Clean up completed features
git worktree remove ../project-auth
```

### Workflow 4: Testing Across Branches

**Scenario:** Test multiple branches before release

```bash
# Create worktrees for release candidates
git worktree add ../test-v1 release/v1.0
git worktree add ../test-v2 release/v2.0
git worktree add ../test-main main

# Run tests in each
cd ../test-v1 && make test
cd ../test-v2 && make test
cd ../test-main && make test

# Compare results without branch switching
```

### Workflow 5: Long-Running CI/CD

**Scenario:** Dedicated worktree for automated builds

```bash
# Create locked worktree for CI
git worktree add --lock --reason "Jenkins build agent" ../ci-build main

# CI system uses this directory
# Lock prevents accidental removal

# When no longer needed
git worktree unlock ../ci-build
git worktree remove ../ci-build
```

## Best Practices

### 1. Naming Conventions

**Use descriptive paths:**
```bash
# ✅ Good - clear purpose
git worktree add ../project-feature-login feature/login
git worktree add ../project-hotfix-123 hotfix/issue-123
git worktree add ../project-review-pr456 feature/teammate-work

# ❌ Avoid - unclear names
git worktree add ../temp feature/login
git worktree add ../test hotfix/issue-123
```

**Consistent structure:**
```bash
# Pattern: <project>-<purpose>-<identifier>
~/workspace/
├── myapp/                    # Main worktree
├── myapp-feature-auth/       # Feature development
├── myapp-hotfix-crash/       # Hotfix
└── myapp-review-pr123/       # Code review
```

### 2. Worktree Placement

**Keep worktrees close to main:**
```bash
# ✅ Good - easy to find and manage
~/project/
~/project-feature-login/
~/project-hotfix/

# ❌ Avoid - scattered across filesystem
~/project/
~/Documents/temp-feature/
/tmp/hotfix/
```

**Alternative: Parent directory approach:**
```bash
~/workspace/myapp/
├── main/              # Main worktree (renamed)
├── feature-login/     # Worktrees at same level
├── hotfix-123/
└── review-pr456/
```

### 3. Cleanup Regularly

```bash
# Weekly cleanup routine
git worktree list
git worktree remove <completed-worktrees>
git worktree prune --dry-run
git worktree prune
```

**Automate cleanup:**
```bash
#!/bin/bash
# cleanup-worktrees.sh

echo "Current worktrees:"
git worktree list

echo -e "\nStale worktrees to prune:"
git worktree prune -v --dry-run

read -p "Proceed with pruning? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git worktree prune -v
fi
```

### 4. Branch Management

**One branch per worktree (mostly):**
```bash
# ✅ Good - each worktree has unique branch
git worktree add -b feature/login ../project-login
git worktree add -b feature/payments ../project-payments

# ⚠️ Use force sparingly - can cause confusion
git worktree add -f ../duplicate main  # Both have main checked out
```

**Create branches explicitly:**
```bash
# ✅ Good - clear intent
git worktree add -b feature/new-api ../api-work main

# ❌ Avoid - auto-generated branch name
git worktree add ../api-work
# Creates branch like "api-work" automatically
```

### 5. Lock Critical Worktrees

```bash
# Lock worktrees that shouldn't be deleted
git worktree lock --reason "Production deployment staging" ../deploy

# Lock CI/CD worktrees
git worktree lock --reason "Jenkins workspace" ../jenkins-build

# Always unlock when done
git worktree unlock ../deploy
```

### 6. Handle Submodules Carefully

**Worktrees with submodules have limitations:**
```bash
# Cannot move worktrees containing submodules
# Must remove and recreate instead

# If you need to work with submodules
cd worktree-with-submodules
git submodule update --init --recursive
```

## Troubleshooting

### Problem: "Fatal: 'path' is already checked out"

**Cause:** Branch is checked out in another worktree

**Solutions:**
```bash
# Option 1: Remove the other worktree first
git worktree remove <other-path>

# Option 2: Use --force (be careful!)
git worktree add -f ../duplicate-work feature/branch

# Option 3: Create new branch instead
git worktree add -b feature/branch-v2 ../new-work feature/branch
```

### Problem: Worktree directory deleted manually

**Solution:**
```bash
# Git still tracks it - clean up metadata
git worktree prune -v

# Verify it's gone
git worktree list
```

### Problem: Moved repository, worktrees broken

**Solution:**
```bash
# Repair all connections
git worktree repair

# Or repair from within broken worktree
cd broken-worktree
git worktree repair

# Check status
git worktree list
```

### Problem: Cannot remove worktree (uncommitted changes)

**Solution:**
```bash
# Option 1: Commit or stash changes first
cd worktree
git stash
git worktree remove .

# Option 2: Force remove (loses changes!)
git worktree remove -f ../worktree
```

### Problem: Cannot remove locked worktree

**Solution:**
```bash
# Option 1: Unlock first
git worktree unlock ../worktree
git worktree remove ../worktree

# Option 2: Force remove (use -f twice)
git worktree remove -f -f ../locked-worktree
```

### Problem: Worktree shows wrong branch

**Solution:**
```bash
# This shouldn't happen normally
# If it does, worktree might be corrupted

# Check actual state
cd worktree
git status
git branch

# If broken, remove and recreate
cd ..
git worktree remove worktree
git worktree add worktree branch-name
```

## Scripting and Automation

### Helper Function: Quick Worktree Creation

```bash
# Add to ~/.bashrc or ~/.zshrc
wtadd() {
    local branch="$1"
    local path="$2"
    
    if [ -z "$branch" ]; then
        echo "Usage: wtadd <branch> [path]"
        return 1
    fi
    
    # Default path if not provided
    if [ -z "$path" ]; then
        # Extract repo name from current directory
        local repo=$(basename $(git rev-parse --show-toplevel))
        path="../${repo}-${branch//\//-}"
    fi
    
    git worktree add "$path" "$branch"
}

# Usage
wtadd feature/login                           # Auto path
wtadd hotfix/bug-123 ../fix                  # Custom path
```

### Helper Function: List with Status

```bash
wtlist() {
    echo "Active Worktrees:"
    echo "================="
    git worktree list | while read -r line; do
        local path=$(echo "$line" | awk '{print $1}')
        local branch=$(echo "$line" | grep -o '\[.*\]' | tr -d '[]')
        
        if [ -n "$branch" ]; then
            echo "📁 $path"
            echo "   Branch: $branch"
            
            # Show if there are uncommitted changes
            if [ -d "$path" ]; then
                cd "$path" &>/dev/null
                if ! git diff-index --quiet HEAD 2>/dev/null; then
                    echo "   ⚠️  Uncommitted changes"
                fi
                cd - &>/dev/null
            fi
        fi
    done
}
```

### Helper Function: Clean Merged Worktrees

```bash
wtclean() {
    local main_branch="${1:-main}"
    
    echo "Finding merged branches..."
    git worktree list --porcelain | grep -A 3 "^worktree" | while read -r line; do
        if [[ $line =~ ^worktree ]]; then
            local wt_path=$(echo "$line" | awk '{print $2}')
        elif [[ $line =~ ^branch ]]; then
            local branch=$(echo "$line" | sed 's/^branch refs\/heads\///')
            
            # Check if branch is merged
            if git branch --merged "$main_branch" | grep -q "^[* ] $branch$"; then
                echo "✓ $branch is merged - removing worktree at $wt_path"
                git worktree remove "$wt_path"
            fi
        fi
    done
    
    # Cleanup stale metadata
    git worktree prune -v
}
```

### Integration with Scripts

```bash
#!/bin/bash
# parallel-tests.sh - Test multiple branches in parallel

branches=("main" "develop" "feature/new-api")

for branch in "${branches[@]}"; do
    worktree="../test-${branch//\//-}"
    
    # Create worktree
    git worktree add "$worktree" "$branch" || continue
    
    # Run tests in background
    (
        cd "$worktree"
        echo "Testing $branch..."
        make test > "../test-${branch//\//-}.log" 2>&1
        echo "✓ $branch tests complete"
    ) &
done

# Wait for all background jobs
wait

# Show results
for branch in "${branches[@]}"; do
    echo "Results for $branch:"
    cat "../test-${branch//\//-}.log"
done

# Cleanup
for branch in "${branches[@]}"; do
    git worktree remove "../test-${branch//\//-}"
done
```

## Advanced Usage

### Worktree for Each Open PR

```bash
#!/bin/bash
# create-review-worktrees.sh

# Get open PRs (using GitHub CLI)
gh pr list --json number,headRefName | jq -r '.[] | "\(.number) \(.headRefName)"' | \
while read -r number branch; do
    worktree="../review-pr-$number"
    
    if [ ! -d "$worktree" ]; then
        echo "Creating worktree for PR #$number ($branch)"
        git worktree add "$worktree" "$branch"
    fi
done
```

### Temporary Worktrees for Testing

```bash
# Create temporary worktree for quick test
test-commit() {
    local commit="${1:-HEAD}"
    local temp_dir=$(mktemp -d)
    
    echo "Creating test worktree at $temp_dir"
    git worktree add --detach "$temp_dir" "$commit"
    
    # Open in new terminal or editor
    cd "$temp_dir"
    
    # Cleanup on exit
    trap "git worktree remove -f '$temp_dir'" EXIT
}
```

### Worktree with Different Git Config

```bash
# Create worktree with specific config
git worktree add ../work-email feature/work

cd ../work-email
git config user.email "work@company.com"
git config user.name "Work Name"

# Main worktree keeps personal config
cd -
git config user.email "personal@example.com"
```

## Performance Considerations

**Advantages:**
- ✅ Shared object database (saves disk space)
- ✅ Faster than cloning (no network, shared refs)
- ✅ Instant branch switching (just `cd`)
- ✅ No need to re-download dependencies per branch

**Limitations:**
- ⚠️ Cannot checkout same branch in multiple worktrees (without `--force`)
- ⚠️ Each worktree needs its own build artifacts
- ⚠️ `node_modules`, `venv`, etc. not shared
- ⚠️ Git operations in one worktree can affect others (ref updates)

**Disk Space Example:**
```bash
# Full clone approach
repo1/    1.2 GB
repo2/    1.2 GB
repo3/    1.2 GB
Total:    3.6 GB

# Worktree approach
main/         1.2 GB (.git shared)
worktree1/    0.2 GB (working files only)
worktree2/    0.2 GB (working files only)
Total:        1.6 GB
```

## When to Use Worktrees

**Use worktrees when:**
- ✅ Need to work on multiple branches simultaneously
- ✅ Frequent branch switching interrupts workflow
- ✅ Reviewing PRs while developing
- ✅ Building/testing multiple branches in parallel
- ✅ Handling urgent hotfixes during feature work
- ✅ Running long-running processes on different branches

**Don't use worktrees when:**
- ❌ Simple sequential branch work (just `git checkout`)
- ❌ Need complete repository isolation
- ❌ Working with complex submodule setups
- ❌ Disk space is severely limited (though worktrees save space!)
- ❌ Team unfamiliar with worktree concept

## Cross-References

Related skills:
- **Commit**: [../commit/SKILL.md](../commit/SKILL.md) - Git commit best practices
- **GitLab CI**: [../gitlab-ci/SKILL.md](../gitlab-ci/SKILL.md) - CI/CD with worktrees
- **Docker**: [../docker/SKILL.md](../docker/SKILL.md) - Multi-stage builds with worktrees

## Quick Reference Card

```bash
# CREATE
git worktree add <path> <branch>              # Existing branch
git worktree add -b <new> <path> <base>       # New branch
git worktree add --detach <path> <commit>     # Detached HEAD

# MANAGE
git worktree list                             # Show all
git worktree list --porcelain                 # Script-friendly
git worktree move <old> <new>                 # Move
git worktree remove <path>                    # Remove
git worktree remove -f <path>                 # Force remove

# LOCK/UNLOCK
git worktree lock --reason <msg> <path>       # Lock
git worktree unlock <path>                    # Unlock

# MAINTENANCE
git worktree prune                            # Clean stale
git worktree prune -n                         # Dry-run
git worktree repair                           # Fix broken

# COMMON PATTERNS
git worktree add ../proj-hotfix -b hotfix/123 main
git worktree add ../proj-review feature/pr-456
git worktree remove ../proj-feature
git worktree list -v | grep locked
```
