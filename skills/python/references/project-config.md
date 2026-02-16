# Python Project Configuration

## Tool Configuration in pyproject.toml

### Black Configuration
Always configure black to use line length of 120 characters:

```toml
[tool.black]
line-length = 120
target-version = ['py312']
```

### Pytest Configuration
Always configure pytest to use the correct pythonpath and asyncio mode:

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
pythonpath = ["src"]
```

## Code Validation Tools

### Working at Top Level
When working at top level, you may have to adapt `uv` parameters:
```bash
uv --project ./folder run ...
```

### Black (Formatting)
Validate code formatting:
```bash
uv run black src
```

### Ruff (Linting)
Validate and fix linting issues:
```bash
uv run ruff check src --fix
```

### Type Checking (ty)
Validate types:
```bash
uv run ty check src
```

When using `ty`, you may have to adapt parameters:
```bash
ty --project check folder
```

You may have to repeat the parameter when using uv:
```bash
uv --project ./folder ty check --project folder
```
