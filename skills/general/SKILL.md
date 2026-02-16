---
name: general
description: General coding rules and principles for all projects
---

# General Coding Principles - Agent Usage Guide

## Core Philosophy
- **KEEP IT SIMPLE**
- **DO NOT BE OVERLY VERBOSE**
- **AVOID OVER-COMPLICATION**

## Documentation & Reporting

### What NOT to Generate
- Do not include emojis in generated markdown
- Do not generate too much reporting (code comments, docstrings, markdown files, chat messages)
- Do not create README files unless absolutely necessary
- Avoid creating documentation files after each change unless requested

### What to Generate
- Clear, concise code comments only when necessary
- Essential docstrings for public APIs
- Minimal but informative markdown when needed

## Code Organization

### Helper Scripts
- Always put helper scripts in a `scripts/` folder

### Reports & Summaries
- Always put markdown reports/summaries in a `reports/` folder

### Repository Structure
- Always verify repository structure complies with your instructions
- Respect existing coding style
- Respect existing coding architecture

## Git Workflow

### Branch Naming
- Prefix branches with `copilot-feature/`
- Always work on an identified branch (e.g., `copilot-feature/feature-name`)

## Development Tasks

### Feature Implementation
- Always implement unittests for new features
- Tests should be in a separate folder (e.g., if there's `src/`, tests go in `tests/` at the same level)
- When applicable, implement integration tests
- Integration tests should run against Docker containers using docker-compose

### Example Code
- Use specific folder `examples/` for example code

## Troubleshooting

### Problem-Solving Approach
- Follow your own instructions to troubleshoot issues
- Put generated troubleshooting scripts in `troubleshoot/scripts/` folder

## Cross-References

Read specific instruction files for:
- **Python**: See [skills/python/SKILL.md](skills/python/SKILL.md)
- **Docker**: See [skills/docker/SKILL.md](skills/docker/SKILL.md)
- **GitLab CI**: See [skills/gitlab-ci/SKILL.md](skills/gitlab-ci/SKILL.md)
- **LangGraph**: See [skills/langgraph/SKILL.md](skills/langgraph/SKILL.md)
- **OpenAI**: See [skills/openai/SKILL.md](skills/openai/SKILL.md)
