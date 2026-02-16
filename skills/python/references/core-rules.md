# Python Core Rules

## Programming Paradigm
- Prefer functional programming over object oriented
- Code must be packageable
- Top level importable module must be under `project-name/src`, using the same name as the project

## Project Structure
Standard Python project layout:
```
.
├── pyproject.toml
├── src
    └──project-name
│   │   ├── __init__.py
│   │   ├── settings.py
│   │   └── script.py
├── tests
│   ├── __init__.py
│   ├── test_settings.py
│   └── test_models.py
```

## Code Style
- PEP8 compliant, 120 characters per line
- Always use typing for all functions
- Always provide docstrings for modules, classes and functions
- Always provide type hints for function parameters and return types
- Always provide `__init__.py` files in folders to make them importable modules

## String Formatting
- Always use f-strings for string formatting
- **Exception**: For logging, MUST use lazy formatting (see logging reference)

## Path Handling
- Avoid using raw strings for paths, use `Path` from `pathlib`

## Environment Variables & Settings
- Avoid using `os.environ` or `os.getenv` directly
- Implement settings using `pydantic_settings`
- Prefer configuration using environment variables
- Use `BaseSettings` from `pydantic_settings` for settings classes

## Data Models
- Always use pydantic models for structured data
- Always use async functions when possible
- Always use `async` and `await` keywords when using async functions

## Module Organization
- Never use the folder `src` in imports
- Adapt `PYTHONPATH` if needed: `PYTHONPATH=src/ uv command` or `PYTHONPATH=./subfolder/src/ uv command`

## Using uv
- Always use `uv` instead of raw python commands:
  - `uv run python script.py` instead of `python3 script`
  - `uv pip install ...` instead of `pip install ...`

## Preferred Libraries
- **Web framework**: `fastapi` + `uvicorn`
- **JSON**: `orjson` over `json`
- **HTTP client**: `hishel` and/or `httpx` async clients
- **CLI**: `click` for command line interfaces
- **Settings**: `BaseSettings` from `pydantic_settings`
