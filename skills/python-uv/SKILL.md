---
name: python-uv
description: "uv package manager and Python interpreter"
---

# uv - Agent Usage Guide for Python Projects

## Core Concept
`uv` is a fast Rust-based Python package and environment manager. It replaces pip, venv, poetry, and pyenv with a unified tool. **Always prefer `uv` over traditional Python tools.**

## Critical Rule for Agents
🚨 **NEVER use bare `python`, `pip`, or activate venvs manually**
✅ **ALWAYS use `uv run <command>` or `uv <operation>`**

## Decision Tree: Which uv command to use?

### When user wants to RUN code:
- **Execute Python file**: `uv run <script.py>`
- **Execute module**: `uv run -m <module>`
- **Start REPL**: `uv run python`
- **Run project script**: `uv run <script-name>` (from `[project.scripts]`)

### When user wants to MANAGE dependencies:
- **Add package**: `uv add <package>`
- **Add dev package**: `uv add --dev <package>`
- **Remove package**: `uv remove <package>`
- **Sync to lockfile**: `uv sync`
- **Update dependencies**: `uv lock --upgrade`

### When user wants to INITIALIZE project:
- **New project**: `uv init [name]`
- **Add uv to existing**: `uv init` (in existing directory)

### When user wants to MANAGE Python versions:
- **List available**: `uv python list`
- **Install version**: `uv python install 3.12`
- **Use specific version**: `uv python pin 3.12`

### When user wants to QUERY packages:
- **Search PyPI**: `uv pip index versions <package>`
- **Show installed**: `uv pip list`
- **Show package info**: `uv pip show <package>`

## Command Templates by Task

### Running Python Code
```bash
# Run a script (auto-manages venv)
uv run script.py
uv run path/to/script.py

# Run with arguments
uv run script.py --arg value

# Run Python module
uv run -m pytest
uv run -m pytest tests/ -v
uv run -m mypy src/
uv run -m black .
uv run -m ruff check .

# Interactive Python
uv run python
uv run python -c "print('hello')"

# Named script from pyproject.toml
uv run start
uv run dev
uv run test
```

### Managing Dependencies
```bash
# Add runtime dependency
uv add requests
uv add "fastapi>=0.100.0"
uv add numpy pandas scikit-learn

# Add dev/test dependencies
uv add --dev pytest pytest-cov
uv add --dev mypy ruff black
uv add --dev ipython

# Remove dependency
uv remove requests

# Sync environment to match pyproject.toml + uv.lock
uv sync

# Sync only production deps (skip dev)
uv sync --no-dev

# Update all dependencies
uv lock --upgrade

# Update specific package
uv lock --upgrade-package requests
```

### Project Initialization
```bash
# New project with structure
uv init myproject
cd myproject

# Initialize in existing directory
uv init

# Result: Creates pyproject.toml, .python-version, README
```

### Python Version Management
```bash
# List available Python versions
uv python list

# Install Python version
uv python install 3.12
uv python install 3.11 3.12  # Multiple versions

# Pin project to Python version (creates/updates .python-version)
uv python pin 3.12

# Use specific version for venv
uv venv --python 3.12
uv venv --python 3.11 .venv-311
```

### Querying Package Information
```bash
# Find available versions on PyPI
uv pip index versions requests

# List installed packages
uv pip list

# Show package details
uv pip show requests

# List outdated packages
uv pip list --outdated
```

### Building and Publishing
```bash
# Build wheel/sdist
uv build

# Publish to PyPI
uv publish

# Publish to test PyPI
uv publish --publish-url https://test.pypi.org/legacy/
```

## Project Structure uv Creates

```
myproject/
├── pyproject.toml      # Project metadata + dependencies
├── uv.lock            # Locked dependency versions (commit this!)
├── .python-version    # Pinned Python version
├── .venv/            # Virtual environment (DO NOT commit)
├── src/
│   └── myproject/
│       └── __init__.py
└── tests/
```

## Common Automation Patterns

### Test Workflow
```bash
# Install deps + run tests
uv sync
uv run pytest

# With coverage
uv run pytest --cov=src tests/
```

### Linting/Formatting Workflow
```bash
# Check code quality
uv run ruff check .
uv run mypy src/

# Auto-fix
uv run ruff check --fix .
uv run black .
```

### CI/CD Pattern
```bash
# Install uv (in CI)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install deps from lock
uv sync --frozen  # Fails if lock out of date

# Run tests
uv run pytest
```

### Docker Pattern
```dockerfile
FROM python:3.12-slim
RUN pip install uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY . .
CMD ["uv", "run", "start"]
```

## Key Files uv Uses

### pyproject.toml
```toml
[project]
name = "myapp"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "requests>=2.31.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "mypy>=1.0.0",
]

[project.scripts]
start = "myapp.main:main"
dev = "myapp.dev:run_dev_server"

[tool.uv]
dev-dependencies = [
    "pytest>=7.0.0",
]
```

### .python-version
```
3.12
```

## Error Handling Guide

### "No Python installation found"
→ Install Python: `uv python install 3.12`

### "pyproject.toml not found"
→ Not in a project: Run `uv init` or `cd` to project dir

### "uv.lock is out of date"
→ Run `uv lock` to regenerate lockfile

### "Package not found"
→ Check package name/version: `uv pip index versions <package>`

### "Python version mismatch"
→ Install required version: `uv python install <version>`
→ Or update .python-version: `uv python pin <version>`

## Migration from Other Tools

### From pip:
- `pip install package` → `uv add package`
- `pip install -r requirements.txt` → `uv add` (each package) or use `uv sync`
- `python script.py` → `uv run script.py`

### From poetry:
- `poetry add package` → `uv add package`
- `poetry run python` → `uv run python`
- `poetry install` → `uv sync`
- `poetry shell` → NOT NEEDED (use `uv run`)

### From venv:
- `python -m venv .venv` → `uv venv`
- `source .venv/bin/activate` → NOT NEEDED (use `uv run`)
- `.venv/bin/python` → `uv run python`

## Agent Decision Pattern

```
User request → Identify operation type:
  
  ┌─ Run code?
  │   └─ Use: uv run <script|module>
  │
  ┌─ Add dependency?
  │   └─ Use: uv add [--dev] <package>
  │
  ┌─ Setup new project?
  │   └─ Use: uv init
  │
  ┌─ Install from existing project?
  │   └─ Use: uv sync
  │
  ┌─ Change Python version?
  │   └─ Use: uv python install <ver> && uv python pin <ver>
  │
  └─ Query package info?
      └─ Use: uv pip index versions <package>
```

## Quick Reference Card

| Task | Command |
|------|---------|
| Run Python file | `uv run script.py` |
| Run module/tool | `uv run -m pytest` |
| Add package | `uv add requests` |
| Add dev package | `uv add --dev pytest` |
| Sync dependencies | `uv sync` |
| New project | `uv init myproject` |
| Install Python | `uv python install 3.12` |
| Pin Python version | `uv python pin 3.12` |
| Search package | `uv pip index versions <pkg>` |
| Update deps | `uv lock --upgrade` |

## Best Practices for Agents

1. **Always check for pyproject.toml** before running commands
2. **Run `uv sync` after cloning** or when deps change
3. **Use `uv run` prefix** for ALL Python execution
4. **Don't manually activate venvs** - uv handles it
5. **Commit uv.lock** to ensure reproducibility
6. **Use `--frozen` in CI** to ensure exact versions
