---
name: pipeline-fix
description: "Diagnose and fix failed GitLab CI/CD pipelines"
---

# Pipeline Fix - Agent Guide

## Core Concept
When a GitLab CI/CD pipeline fails, systematically diagnose the root cause, apply the appropriate fix, and verify the solution. This skill provides a structured workflow for troubleshooting and resolving pipeline failures.

## When to Use This Skill
- User asks to "fix the pipeline" or "debug CI/CD failure"
- User asks to "read pipeline logs" for a specific MR or branch
- Pipeline status shows FAILED and user wants resolution
- Renovate bot MRs or dependency update MRs are failing

## Decision Tree: Pipeline Fix Workflow

```
User Request → Identify MR/Pipeline → Get Logs → Diagnose → Fix → Verify
```

### Step 1: Identify the Failed Pipeline

**If user provides MR number:**
```bash
# Get MR details and latest pipeline
glab api graphql -f query='
query {
  project(fullPath: "owner/repo-name") {
    mergeRequest(iid: "MR_NUMBER") {
      title
      sourceBranch
      targetBranch
      pipelines(first: 5) {
        nodes {
          id
          iid
          status
          createdAt
        }
      }
    }
  }
}' | jq
```

**If user provides branch name:**
```bash
# List recent pipelines for current repo
glab pipeline list

# Or check current branch status
glab pipeline status
```

**Extract key information:**
- Pipeline IID (internal ID like "518")
- Pipeline status (FAILED, SUCCESS, RUNNING)
- Source branch name
- Target branch name

### Step 2: Get Pipeline Jobs and Identify Failures

```bash
# Get all jobs for the pipeline with their status
glab api graphql -f query='
query {
  project(fullPath: "owner/repo-name") {
    pipeline(iid: "PIPELINE_IID") {
      id
      status
      createdAt
      jobs {
        nodes {
          id
          name
          status
          webPath
        }
      }
    }
  }
}' | jq

# Filter to show only failed jobs
glab api graphql -f query='
query {
  project(fullPath: "owner/repo-name") {
    pipeline(iid: "PIPELINE_IID") {
      jobs {
        nodes {
          id
          name
          status
        }
      }
    }
  }
}' | jq -r '.data.project.pipeline.jobs.nodes[] | select(.status=="FAILED") | "\(.id) \(.name)"'
```

**Record:**
- Job name(s) that failed
- Job ID(s) - extract numeric part from GraphQL ID (e.g., `gid://gitlab/Ci::Build/160208907` → `160208907`)

### Step 3: Retrieve and Analyze Job Logs

```bash
# Get the full trace/logs for the failed job
glab ci trace JOB_ID

# For large logs, save to file
glab ci trace JOB_ID > job_logs.txt
```

**Look for:**
- Error messages (lines with `ERROR`, `Error:`, `FAILED`, `exit code`)
- Package version mismatches
- Missing dependencies
- Network/timeout issues
- Permission errors
- Syntax errors in code or configuration

**Common log patterns and meanings:**
```bash
# Package version not found
"E: Version 'X.Y.Z' for 'package-name' was not found"
→ Package version is outdated/unavailable

# Exit code errors
"exit code: 1" or "exit code: 100"
→ Command failed, look at preceding lines

# Docker build failures
"ERROR: failed to solve"
→ Dockerfile issue, check the step that failed

# Test failures
"FAILED tests/..."
→ Code tests are failing

# Lint failures
"error: ..." in linting step
→ Code style/quality issues
```

### Step 4: Diagnose the Root Cause

#### Common Pipeline Failure Categories:

**1. Dependency Version Issues**
- **Symptoms:** Package not found, version mismatch, dependency conflicts
- **Examples:**
  - `libglib2.0-0=2.80.0-6ubuntu3.7` not available
  - Python package version incompatibility
  - npm/yarn lock file out of sync
- **Files to check:** `Dockerfile`, `requirements.txt`, `package.json`, `package-lock.json`

**2. Build/Compilation Errors**
- **Symptoms:** Syntax errors, missing files, compilation failures
- **Examples:**
  - Missing imports
  - Type errors
  - Build tool errors (make, cmake, webpack)
- **Files to check:** Source code files mentioned in error

**3. Test Failures**
- **Symptoms:** Test assertions fail, test timeout
- **Examples:**
  - Unit test failures
  - Integration test failures
  - E2E test failures
- **Files to check:** Test files, test configuration

**4. Linting/Code Quality**
- **Symptoms:** Style violations, formatting issues
- **Examples:**
  - ESLint errors
  - Flake8/Black violations
  - Hadolint (Docker) violations
- **Files to check:** Code files mentioned in lint output

**5. Configuration Issues**
- **Symptoms:** Invalid YAML, missing variables, wrong paths
- **Examples:**
  - `.gitlab-ci.yml` syntax errors
  - Missing CI/CD variables
  - Invalid Docker context
- **Files to check:** `.gitlab-ci.yml`, docker-compose.yml, Dockerfile

**6. Infrastructure/Environment Issues**
- **Symptoms:** Network timeouts, disk space, permission errors
- **Examples:**
  - Cannot pull Docker image
  - Disk quota exceeded
  - Permission denied on file operations
- **Resolution:** May require infrastructure team or retry

### Step 5: Apply the Fix

#### A. Checkout the Correct Branch

```bash
# Fetch the MR source branch
git fetch origin SOURCE_BRANCH

# Checkout the branch
git checkout SOURCE_BRANCH

# Pull latest changes
git pull
```

#### B. Make the Necessary Changes

**For dependency version issues:**
```bash
# Update the package version in relevant file
# Examples:
# - Dockerfile: libglib2.0-0=2.80.0-6ubuntu3.8
# - requirements.txt: numpy==2.4.2
# - package.json: "polars": "1.38.1"

# Use editor tool to make precise changes
```

**For code/test issues:**
```bash
# Fix the code based on error messages
# Run tests locally if possible to verify
```

**For linting issues:**
```bash
# Apply auto-formatting if available
black .
eslint --fix .
hadolint Dockerfile

# Manual fixes for remaining issues
```

#### C. Verify Changes Locally (If Possible)

```bash
# For Docker builds
docker build -t test-image .

# For Python tests
pytest tests/

# For linting
pre-commit run --all-files
```

#### D. Commit and Push

```bash
# Stage changes
git add <modified-files>

# Commit with conventional commit format
# Use appropriate type: fix, chore, refactor, test
git commit -m "fix(scope): description of fix"

# Examples:
# git commit -m "fix(docker): update libglib2.0-0 to available version"
# git commit -m "fix(deps): upgrade numpy to 2.4.2"
# git commit -m "fix(tests): correct assertion in user test"
# git commit -m "chore(lint): fix formatting violations"

# Push to remote
git push
```

### Step 6: Verify the Fix

```bash
# Wait a moment for pipeline to start, then check status
glab pipeline status

# Or list recent pipelines to see the new one
glab pipeline list

# Get the new pipeline for the MR
glab api graphql -f query='
query {
  project(fullPath: "owner/repo-name") {
    mergeRequest(iid: "MR_NUMBER") {
      pipelines(first: 1) {
        nodes {
          iid
          status
          createdAt
        }
      }
    }
  }
}'
```

**If pipeline still fails:**
- Repeat from Step 2 with the new pipeline
- Check if there are multiple issues
- Consider if fix introduced new problems

### Step 7: Communicate Results

**Provide summary to user:**
- What failed (job name, error type)
- Root cause identified
- Fix applied (files changed, what was updated)
- Current pipeline status
- Link to pipeline/MR if available

## Common Fix Patterns

### Pattern 1: Update Outdated Package Versions

```bash
# 1. Identify which package version is unavailable
# From error: "Version 'X.Y.Z' for 'package-name' was not found"

# 2. Find available versions (if APT package)
docker run -it ubuntu:noble apt-cache policy package-name

# 3. Update Dockerfile/requirements file with new version

# 4. Commit and push
git add Dockerfile
git commit -m "fix(docker): update package-name to available version"
git push
```

### Pattern 2: Fix Renovate Bot Dependency Updates

Renovate bot updates may introduce breaking changes or incompatibilities:

```bash
# 1. Check what Renovate updated
git diff main..SOURCE_BRANCH requirements.txt package.json

# 2. Review if update caused compatibility issues

# 3. Options:
#    a) Pin to working version if update breaks
#    b) Fix code to work with new version
#    c) Update related dependencies

# 4. For system package mismatches (like libglib2.0-0):
#    - Renovate may update Python deps but not system deps
#    - Manually update system package versions in Dockerfile
#    - Check Ubuntu package repositories for available versions
```

### Pattern 3: Fix Multiple Failing Jobs

```bash
# 1. Get all failed jobs
glab api graphql -f query='...' | jq -r '.data.project.pipeline.jobs.nodes[] | select(.status=="FAILED") | .name'

# 2. Prioritize fixes:
#    - Fix build/lint jobs first (they block everything)
#    - Then fix test jobs
#    - Finally fix deployment jobs

# 3. Sometimes one fix resolves multiple failures
#    (e.g., fixing build allows tests to run)
```

### Pattern 4: Handle Transient Failures

Some failures are temporary (network issues, service unavailable):

```bash
# 1. Check if error indicates transient issue:
#    - "timeout"
#    - "connection refused"
#    - "service unavailable"

# 2. Retry the pipeline
glab pipeline retry PIPELINE_ID

# 3. If retry fails with same error:
#    - It's likely not transient
#    - Investigate further
```

## Integration with Other Skills

- **Use `glab` skill** for all GitLab CLI operations
- **Use `commit` skill** for proper commit message formatting
- **Use `docker` skill** if Dockerfile changes are needed
- **Use `python` or `python-uv` skill** for Python dependency issues
- **Use `gitlab-ci` skill** if `.gitlab-ci.yml` needs modification

## Quick Troubleshooting Checklist

- [ ] Identified the failed pipeline (IID)
- [ ] Retrieved pipeline jobs list
- [ ] Found which job(s) failed
- [ ] Retrieved full logs for failed job(s)
- [ ] Identified error messages and root cause
- [ ] Checked out correct branch
- [ ] Applied appropriate fix
- [ ] Verified changes (locally if possible)
- [ ] Committed with proper message format
- [ ] Pushed changes
- [ ] Verified new pipeline started
- [ ] Monitored new pipeline status

## Pro Tips

1. **Read the full error context** - Don't just look at the last line, errors often have context above
2. **Check recent changes** - Compare with working pipelines to see what changed
3. **Look for patterns** - Similar errors across multiple jobs suggest common root cause
4. **Test locally first** - If you can run tests/builds locally, do it before pushing
5. **One fix at a time** - Don't combine multiple unrelated fixes in one commit
6. **Document unusual fixes** - Add comments explaining non-obvious fixes
7. **Check dependencies** - Version updates in one package may affect others
8. **Time-based issues** - Package repositories change over time; versions become unavailable

## Example: Complete Fix Workflow

```bash
# User: "Fix the pipeline for MR 88"

# Step 1: Get MR and pipeline info
glab api graphql -f query='
query {
  project(fullPath: "the-foundry/tools/lab/jupyterhub-images") {
    mergeRequest(iid: "88") {
      sourceBranch
      pipelines(first: 1) {
        nodes {
          iid
          status
        }
      }
    }
  }
}'
# Result: sourceBranch="renovate/pypi-minor-patch", pipeline iid="518", status="FAILED"

# Step 2: Get failed jobs
glab api graphql -f query='
query {
  project(fullPath: "the-foundry/tools/lab/jupyterhub-images") {
    pipeline(iid: "518") {
      jobs {
        nodes {
          id
          name
          status
        }
      }
    }
  }
}' | jq -r '.data.project.pipeline.jobs.nodes[] | select(.status=="FAILED") | "\(.id) \(.name)"'
# Result: gid://gitlab/Ci::Build/160208907 docker-build

# Step 3: Get logs
glab ci trace 160208907
# Result: "E: Version '2.80.0-6ubuntu3.7' for 'libglib2.0-0' was not found"

# Step 4: Diagnose
# Root cause: Package version 2.80.0-6ubuntu3.7 no longer available
# New version available: 2.80.0-6ubuntu3.8

# Step 5: Fix
git checkout renovate/pypi-minor-patch
git pull
# Edit Dockerfile: change libglib2.0-0=2.80.0-6ubuntu3.7 to 2.80.0-6ubuntu3.8
git add Dockerfile
git commit -m "fix(docker): update libglib2.0-0 to available version 2.80.0-6ubuntu3.8"
git push

# Step 6: Verify
glab pipeline status
# New pipeline should start automatically and succeed

# Step 7: Report
# "Fixed MR 88 pipeline. The docker-build job was failing because libglib2.0-0 
#  version 2.80.0-6ubuntu3.7 is no longer available. Updated to 2.80.0-6ubuntu3.8.
#  New pipeline is running: https://gitlab.../pipelines/519"
```

## Emergency Patterns

### When You're Stuck

1. **Check the .gitlab-ci.yml** - Understand what the job is supposed to do
2. **Compare with main branch** - See what's different
3. **Search error messages** - Google/documentation for specific errors
4. **Ask for clarification** - User may have context about expected behavior
5. **Reproduce locally** - Clone repo and run commands locally if possible

### When Fix Doesn't Work

1. **Check if you fixed the right thing** - Re-read the logs carefully
2. **Look for secondary errors** - First error may cause cascade of failures
3. **Verify branch is up to date** - Ensure your push actually went through
4. **Check pipeline actually reran** - Confirm new pipeline started after your push
5. **Consider breaking changes** - Your fix may have introduced new issues

### When Multiple MRs Are Failing Similarly

1. **Check if it's a common dependency** - Same package version issue across MRs
2. **Look at main branch** - Is main also broken?
3. **Check infrastructure** - Registry down? Service unavailable?
4. **Consider base image updates** - Ubuntu/Alpine/etc. package repos may have changed
5. **Fix once, apply pattern** - Same fix may work across multiple MRs
