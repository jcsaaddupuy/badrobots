---
name: gitlab-ci
description: "GitLab CI/CD configuration guide"
---

# GitLab CI - Agent Usage Guide

## Core Concept
GitLab CI/CD configuration for Python, Docker, and LangGraph projects using shared templates from the-foundry/tools.

## Critical Reference Files
**IMPORTANT**: Before creating or modifying .gitlab-ci.yml, read:

- [Core Rules](references/core-rules.md) - Template usage, project-specific configuration

## Decision Tree

### When creating NEW .gitlab-ci.yml:
1. Read [references/core-rules.md](references/core-rules.md)
2. Identify project type (Python, Docker, LangGraph, AWS)
3. Include appropriate shared templates
4. Configure project-specific variables
5. Enable required jobs (gitleaks, linting, tests)

### Project Type Template Selection:
- **Python only** → Include python-gitlab-ci.yml
- **Python + AWS** → Include python-gitlab-ci.yml + python-aws-gitlab-ci.yml
- **Docker** → Include docker-gitlab-ci.yml
- **LangGraph** → Include langgraph-gitlab-ci.yml
- **Combined** → Include all relevant templates

## Core Principles

1. **Use shared templates** - Leverage the-foundry/tools templates
2. **Enable security** - Always include gitleaks
3. **Enable quality** - Always enable linting and tests
4. **Adapt to project** - Remove unnecessary jobs, add needed ones
5. **Follow conventions** - Use standard stages and job naming

## Common Pipeline Structure

```
Stages:
  security → lint → test → build → push → deploy → release
```

### Required Jobs
- `gitleaks` - Security scanning
- Linting jobs (from templates)
- Test jobs (from templates)

### Optional Jobs
- Docker build/push (if using containers)
- AWS deployment (if using AWS)
- LangGraph specific jobs (if using LangGraph)

## Integration Points

### With Python Projects
- See [../python/SKILL.md](../python/SKILL.md) for project structure
- Ensure tests follow [../python/references/testing.md](../python/references/testing.md)
- Variable: `PYTHON_PROJECT` should match project name

### With Docker Projects
- See [../docker/SKILL.md](../docker/SKILL.md) for Dockerfile requirements
- Variables needed:
  - `DOCKER_BUILD_PATH`
  - `DOCKERFILE_NAME`
  - `IMAGE_NAME`

### With LangGraph Projects
- See [../langgraph/SKILL.md](../langgraph/SKILL.md) for requirements
- Includes LangGraph-specific validation jobs

## Quick Reference

### Minimal Python Project
```yaml
include:
  - project: the-foundry/tools/templates
    file: gitlab/default.yml
  - project: the-foundry/tools/templates
    file: gitlab/gitleaks-gitlab-ci.yml
  - project: the-foundry/tools/templates
    file: gitlab/python-gitlab-ci.yml

gitleaks:
  extends: .gitleaks
```

### Full Featured Python + Docker + LangGraph
See [references/core-rules.md](references/core-rules.md) for complete example.

## Best Practices

1. **Start with minimal** - Add templates as needed
2. **Test locally first** - Validate before committing
3. **Use variables** - Don't hardcode values
4. **Follow template patterns** - Extend existing jobs
5. **Document customizations** - Comment why jobs are modified
