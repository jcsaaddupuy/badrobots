# Python Testing Rules

## Test Structure
- Always provide a `tests/` folder at the same level as `src/` folder
- Always provide an `__init__.py` file in `tests/` folder
- Always provide `__init__.py` files in subfolders of `tests/` folder
- Always provide unittests in `tests/` folder
- Always prefix test files with `test_` and suffix with `.py`

## Test Framework
- Use pytest
- Prefer functional programming over object oriented in tests

## Code Coverage
- Aim for 95% code coverage
- Use `pytest-cov` plugin
- Example command:
  ```bash
  uv run --with 'pytest,pytest-cov' --with ./{project path} pytest --cov {project path}/src --cov-report term
  ```
- Adapt PYTHONPATH if needed:
  ```bash
  PYTHONPATH={project path}/src uv run --with 'pytest,pytest-cov' --with ./{project path} pytest --cov {project path}/src --cov-report term
  ```
- Use `# pragma: no cover` on non-critical paths
- Use `--ff` to run failing tests first

## Test Types

### Integration Tests
- Should go in `tests/integration/` folder
- Mark integration tests with `@pytest.mark.integration`
- Integration tests should run against a docker container using docker compose

### Online Tests
- Online tests require network to pass and may make expensive queries
- Should go in `tests/online/` folder
- Mark online tests with `@pytest.mark.online`

### Test Markers Configuration
Online and integration tests must be disabled by default, only run when specific options are provided.

Example in `conftest.py`:
```python
import pytest

def pytest_addoption(parser):
    parser.addoption("--online", action="store_true", default=False, help="run online tests")
    parser.addoption("--integration", action="store_true", default=False, help="run integration tests")

def pytest_configure(config):
    config.addinivalue_line("markers", "online: mark test as requiring network")
    config.addinivalue_line("markers", "integration: mark test as integration test")

def pytest_collection_modifyitems(config, items):
    if not config.getoption("--online"):
        skip_online = pytest.mark.skip(reason="need --online option to run")
        for item in items:
            if "online" in item.keywords:
                item.add_marker(skip_online)
    
    if not config.getoption("--integration"):
        skip_integration = pytest.mark.skip(reason="need --integration option to run")
        for item in items:
            if "integration" in item.keywords:
                item.add_marker(skip_integration)
```

## Mocking
- If using mocking (`Mock()`, `AsyncMock()`, `MagicMock()`, ...)
- The parameter `spec` MUST be present and explicitly set to mocked attributes
- This avoids swallowing `AttributeError`

## Test Dependencies
- Ensure test dependencies are in the `[dev]` group of `pyproject.toml` or `requirements-dev.txt`

## Testing Best Practices

### Parametrized Tests
When testing multiple values, prefer using `@pytest.mark.parametrize` instead of loops:

```python
# ✅ GOOD
@pytest.mark.parametrize("item", [
    "line",
    "spline",
    "area",
])
def test_chart_types_exist(item):
    """Test that all expected chart types exist."""
    assert something(item)

# ❌ BAD
def test_chart_types_exist():
    """Test that all expected chart types exist."""
    some_items = ["line", "spline", "area"]
    for item in some_items:
        assert something(item)
```

### Exception Testing
- When using `pytest.raises`, always check the exception message with `match="expected message"` parameter

### Fixtures
- Always use `tmp_path` fixture when needing to create temporary files or folders
- Always use `capsys` fixture when needing to test console output

### Assertions
- Always use assert statements for verifications
