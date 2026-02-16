---
name: python
description: Comprehensive guide for Python development with modern tooling
---

# Python Development - Agent Usage Guide

## Critical Reference Files
**IMPORTANT**: Before writing Python code, read these reference files for detailed rules:

- [Core Rules](references/core-rules.md) - Programming paradigm, project structure, code style
- [Logging](references/logging.md) - Logging setup and best practices
- [Testing](references/testing.md) - Test structure, pytest usage, coverage
- [HTTPX](references/httpx.md) - HTTP client usage with retry logic
- [Project Config](references/project-config.md) - Tool configuration (black, ruff, pytest)
- [Secrets](references/secrets.md) - Handling sensitive data with Pydantic
- [Docker Integration](references/docker.md) - Python Docker setup
- [Examples](references/examples.md) - FastAPI, Click, Settings patterns
- [Code Review](references/code-review.md) - PEP8 compliance, type hints, anti-patterns
- [Code Style](references/codestyle.md) - PEP8 and PEP20 detailed guidelines

## Core Principles for Python Code

1. **Use uv/uvx for all Python operations** (see [../python-uv/SKILL.md](../python-uv/SKILL.md))
2. **Follow PEP 8** style guidelines (120 chars/line)
3. **Type hints everywhere** (Python 3.10+ syntax)
4. **Docstrings for all public APIs** (Google or NumPy style)
5. **Write tests alongside code** (pytest with 95% coverage target)

## Critical Tools Setup

### Code Formatting (black)
```bash
# Format files/directories
uvx black src/
uvx black tests/
uvx black script.py

# Check without modifying
uvx black --check src/

# Format entire project
uvx black .
```

### Linting (ruff)
```bash
# Check for issues
uvx ruff check src/
uvx ruff check .

# Auto-fix issues
uvx ruff check --fix src/

# With specific rules
uvx ruff check --select E,W,F src/
```

### Type Checking (mypy or pyright)
```bash
# Type check with mypy
uvx mypy src/

# Type check specific file
uvx mypy src/module.py

# Strict mode
uvx mypy --strict src/

# Alternative: pyright (faster)
uvx pyright src/
```

## Decision Tree: What to generate?

### When creating NEW Python module:
1. **Read** [references/core-rules.md](references/core-rules.md) for project structure
2. Create file in appropriate location (`src/<package>/` or `tests/`)
3. Add module-level docstring
4. Add type hints to all functions/methods (see examples in SKILL.md below)
5. Create corresponding test file (see [references/testing.md](references/testing.md))

### When creating NEW function/class:
1. **Read** type hint patterns below
2. Add type hints for all parameters and return values
3. Write docstring with description, args, returns, raises (see examples below)
4. Consider edge cases and validation
5. Write unit tests IMMEDIATELY after (see [references/testing.md](references/testing.md))

### When FIXING bugs:
1. Write a failing test first (TDD) - see [references/testing.md](references/testing.md)
2. Fix the bug
3. Ensure test passes
4. Run full test suite to check for regressions

### When REFACTORING:
1. Ensure tests exist and pass
2. Make incremental changes
3. Run tests after each change
4. Use type checker to catch issues

### When adding LOGGING:
1. **Read** [references/logging.md](references/logging.md) - CRITICAL for lazy formatting
2. Create module logger: `logger = logging.getLogger(__name__)`
3. Use lazy formatting: `logger.info("Message %s", variable)` NOT f-strings
4. Log exceptions with `logger.exception("message")`

### When handling SECRETS:
1. **Read** [references/secrets.md](references/secrets.md)
2. Use `SecretStr` from Pydantic
3. Use `BaseSettings` for environment variables
4. Never log or print sensitive values

### When making HTTP REQUESTS:
1. **Read** [references/httpx.md](references/httpx.md)
2. Use `httpx.AsyncClient` for async operations
3. Always add retry logic with tenacity
4. Handle exceptions appropriately

### When setting up DOCKER:
1. **Read** [references/docker.md](references/docker.md)
2. Follow multi-stage build pattern
3. Install Rust if needed for compiled dependencies
4. Configure environment variables properly

## Python Project Structure Pattern

```
myproject/
├── pyproject.toml          # Project config (uv managed)
├── uv.lock                # Dependency lock
├── .python-version        # Python version pin
├── README.md              # Project documentation
├── src/
│   └── myproject/
│       ├── __init__.py    # Package marker + version
│       ├── main.py        # Entry point
│       ├── models.py      # Data models
│       ├── services.py    # Business logic
│       └── utils.py       # Helper functions
├── tests/
│   ├── __init__.py
│   ├── conftest.py        # Pytest fixtures
│   ├── test_models.py
│   ├── test_services.py
│   └── test_utils.py
```

## Code Quality Standards

### Type Hints (Required)
```python
# ✅ GOOD - Full type hints
from typing import Optional, List, Dict, Any

def process_data(
    items: List[str],
    config: Dict[str, Any],
    timeout: Optional[int] = None
) -> Dict[str, int]:
    """Process items according to config.
    
    Args:
        items: List of items to process
        config: Configuration dictionary
        timeout: Optional timeout in seconds
        
    Returns:
        Dictionary mapping items to counts
        
    Raises:
        ValueError: If items is empty
    """
    if not items:
        raise ValueError("Items cannot be empty")
    
    result: Dict[str, int] = {}
    for item in items:
        result[item] = len(item)
    return result

# ❌ BAD - No type hints
def process_data(items, config, timeout=None):
    result = {}
    for item in items:
        result[item] = len(item)
    return result
```

### Docstring Format (Google Style)
```python
def complex_function(
    param1: str,
    param2: int,
    optional: bool = False
) -> tuple[str, int]:
    """One-line summary of function.
    
    More detailed description explaining what the function does,
    any important algorithms, or behavior notes.
    
    Args:
        param1: Description of first parameter
        param2: Description of second parameter
        optional: Whether to enable optional behavior
        
    Returns:
        A tuple containing:
            - Processed string result
            - Count of operations performed
            
    Raises:
        ValueError: If param2 is negative
        TypeError: If param1 is not a string
        
    Example:
        >>> result, count = complex_function("test", 5)
        >>> print(result)
        'TEST'
    """
    if param2 < 0:
        raise ValueError("param2 must be non-negative")
    
    return param1.upper(), param2 * 2
```

### Class Structure
```python
from dataclasses import dataclass
from typing import ClassVar, Optional

@dataclass
class DataModel:
    """A data model representing a thing.
    
    Attributes:
        name: The name of the thing
        value: The value associated with it
        active: Whether the thing is active
    """
    
    name: str
    value: int
    active: bool = True
    
    # Class variable
    MAX_VALUE: ClassVar[int] = 1000
    
    def __post_init__(self) -> None:
        """Validate data after initialization."""
        if self.value > self.MAX_VALUE:
            raise ValueError(f"Value cannot exceed {self.MAX_VALUE}")
    
    def process(self) -> Optional[str]:
        """Process the data model.
        
        Returns:
            Processed result or None if not active
        """
        if not self.active:
            return None
        return f"{self.name}: {self.value}"
```

### Error Handling
```python
from typing import Optional
import logging

logger = logging.getLogger(__name__)

def safe_operation(data: dict[str, Any]) -> Optional[str]:
    """Perform operation with proper error handling.
    
    Args:
        data: Input data dictionary
        
    Returns:
        Result string or None on error
    """
    try:
        result = data["key"]
        return str(result)
    except KeyError as e:
        logger.error("Missing required key: %s", e)
        return None
    except Exception as e:
        logger.exception("Unexpected error: %s", e)
        raise
```

## Testing Patterns (pytest)

### Basic Test Structure
```python
# tests/test_services.py
import pytest
from myproject.services import DataService

class TestDataService:
    """Test suite for DataService."""
    
    def test_basic_operation(self):
        """Test basic service operation."""
        service = DataService()
        result = service.process("input")
        assert result == "expected"
    
    def test_error_handling(self):
        """Test that errors are handled correctly."""
        service = DataService()
        with pytest.raises(ValueError, match="Invalid input"):
            service.process("")
    
    @pytest.mark.parametrize("input,expected", [
        ("test", "TEST"),
        ("hello", "HELLO"),
        ("123", "123"),
    ])
    def test_multiple_inputs(self, input: str, expected: str):
        """Test with multiple input values."""
        service = DataService()
        assert service.process(input) == expected
```

### Fixtures
```python
# tests/conftest.py
import pytest
from myproject.models import DataModel

@pytest.fixture
def sample_data() -> dict[str, Any]:
    """Provide sample data for tests."""
    return {
        "name": "test",
        "value": 42,
        "active": True
    }

@pytest.fixture
def data_model(sample_data: dict[str, Any]) -> DataModel:
    """Provide a DataModel instance."""
    return DataModel(**sample_data)

# tests/test_models.py
def test_with_fixture(data_model: DataModel):
    """Test using the fixture."""
    assert data_model.name == "test"
    assert data_model.value == 42
```

### Test Coverage
```bash
# Run tests with coverage
uv run pytest --cov=src --cov-report=html --cov-report=term

# View HTML report
open htmlcov/index.html

# Fail if coverage below threshold
uv run pytest --cov=src --cov-fail-under=80
```

## Common Python Patterns

### Context Managers
```python
from contextlib import contextmanager
from typing import Generator

@contextmanager
def managed_resource() -> Generator[Resource, None, None]:
    """Context manager for resource handling.
    
    Yields:
        The managed resource instance
    """
    resource = Resource()
    try:
        resource.open()
        yield resource
    finally:
        resource.close()

# Usage
with managed_resource() as res:
    res.do_something()
```

### Async/Await
```python
import asyncio
from typing import List

async def fetch_data(url: str) -> dict[str, Any]:
    """Fetch data asynchronously.
    
    Args:
        url: URL to fetch from
        
    Returns:
        Fetched data as dictionary
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        return response.json()

async def fetch_multiple(urls: List[str]) -> List[dict[str, Any]]:
    """Fetch multiple URLs concurrently."""
    tasks = [fetch_data(url) for url in urls]
    return await asyncio.gather(*tasks)
```

### Enums for Constants
```python
from enum import Enum, auto

class Status(Enum):
    """Status enumeration."""
    PENDING = auto()
    PROCESSING = auto()
    COMPLETED = auto()
    FAILED = auto()

def process_item(status: Status) -> str:
    """Process based on status."""
    match status:
        case Status.PENDING:
            return "waiting"
        case Status.PROCESSING:
            return "active"
        case Status.COMPLETED:
            return "done"
        case Status.FAILED:
            return "error"
```

### Dataclasses for DTOs
```python
from dataclasses import dataclass, field
from datetime import datetime
from typing import List

@dataclass
class User:
    """User data transfer object."""
    id: int
    username: str
    email: str
    created_at: datetime = field(default_factory=datetime.now)
    tags: List[str] = field(default_factory=list)
    
    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "created_at": self.created_at.isoformat(),
            "tags": self.tags,
        }
```

## Logging Best Practices

```python
import logging
from typing import Optional

# Module-level logger
logger = logging.getLogger(__name__)

def setup_logging(level: str = "INFO") -> None:
    """Configure logging for the application.
    
    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    """
    logging.basicConfig(
        level=getattr(logging, level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler('app.log')
        ]
    )

def process_with_logging(data: dict[str, Any]) -> Optional[str]:
    """Process data with proper logging."""
    logger.debug("Processing data: %s", data)
    
    try:
        result = expensive_operation(data)
        logger.info("Successfully processed: %s", result)
        return result
    except ValueError as e:
        logger.warning("Validation error: %s", e)
        return None
    except Exception as e:
        logger.exception("Unexpected error: %s", e)
        raise
```

## Configuration Management

```python
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    """Application settings from environment."""
    
    app_name: str = "myapp"
    debug: bool = False
    database_url: str = Field(..., env="DATABASE_URL")
    api_key: str = Field(..., env="API_KEY")
    max_connections: int = 10
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

# Usage
settings = Settings()
```

## Dependency Injection Pattern

```python
from typing import Protocol

class StorageProtocol(Protocol):
    """Protocol for storage backends."""
    def save(self, key: str, value: str) -> None: ...
    def load(self, key: str) -> str: ...

class MemoryStorage:
    """In-memory storage implementation."""
    def __init__(self) -> None:
        self._data: dict[str, str] = {}
    
    def save(self, key: str, value: str) -> None:
        self._data[key] = value
    
    def load(self, key: str) -> str:
        return self._data[key]

class DataService:
    """Service with dependency injection."""
    def __init__(self, storage: StorageProtocol) -> None:
        self._storage = storage
    
    def process(self, key: str, value: str) -> None:
        """Process and store data."""
        processed = value.upper()
        self._storage.save(key, processed)
```

## CLI Applications (with typer)

```python
import typer
from typing import Optional

app = typer.Typer()

@app.command()
def process(
    input_file: str = typer.Argument(..., help="Input file path"),
    output_file: Optional[str] = typer.Option(None, "--output", "-o", help="Output file path"),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Verbose output"),
) -> None:
    """Process input file and generate output.
    
    Args:
        input_file: Path to input file
        output_file: Optional output file path
        verbose: Enable verbose logging
    """
    if verbose:
        typer.echo(f"Processing {input_file}...")
    
    # Processing logic here
    result = f"Processed: {input_file}"
    
    if output_file:
        with open(output_file, 'w') as f:
            f.write(result)
        typer.echo(f"Output written to {output_file}")
    else:
        typer.echo(result)

if __name__ == "__main__":
    app()
```

## Agent Workflow for Python Development

```
1. Understand requirement
   ↓
2. Read relevant reference files
   ├─ references/core-rules.md for structure
   ├─ references/logging.md if adding logs
   ├─ references/testing.md for tests
   └─ references/secrets.md if handling sensitive data
   ↓
3. Check existing code structure
   ├─ Read pyproject.toml for dependencies
   ├─ Identify relevant modules in src/
   └─ Find corresponding test files
   ↓
4. Plan implementation
   ├─ Determine where code belongs
   ├─ Identify needed dependencies
   └─ Plan test scenarios
   ↓
5. Implement code
   ├─ Add type hints
   ├─ Write docstrings
   ├─ Handle errors properly
   └─ Follow project style (references/core-rules.md)
   ↓
6. Write tests
   ├─ Follow references/testing.md
   ├─ Create test_<module>.py
   ├─ Test happy path
   ├─ Test edge cases
   └─ Test error handling
   ↓
7. Verify quality
   ├─ Format: uvx black src/ tests/
   ├─ Lint: uvx ruff check src/ tests/
   ├─ Type check: uvx mypy src/
   └─ Run tests: uv run pytest (see references/testing.md)
   ↓
8. Fix any issues and repeat step 7
```

## Quick Reference: Code Quality Commands

```bash
# All-in-one check (run before committing)
uvx black . && \
uvx ruff check --fix . && \
uvx mypy src/ && \
uv run pytest

# Individual checks
uvx black --check .              # Check formatting
uvx black .                      # Apply formatting
uvx ruff check .                 # Lint check
uvx ruff check --fix .           # Lint fix
uvx mypy src/                    # Type check
uvx mypy --strict src/           # Strict type check
uv run pytest                    # Run tests
uv run pytest -v                 # Verbose tests
uv run pytest --cov=src          # With coverage
uv run pytest -k test_name       # Run specific test
uv run pytest -x                 # Stop on first failure
```

## Common Pitfalls to Avoid

1. ❌ **Missing type hints** → ✅ Always add type hints
2. ❌ **No docstrings** → ✅ Document all public APIs
3. ❌ **Bare except clauses** → ✅ Catch specific exceptions
4. ❌ **Mutable default arguments** → ✅ Use `None` and create in function
5. ❌ **Not using f-strings** → ✅ Use f-strings for formatting
6. ❌ **Long functions** → ✅ Keep functions under 50 lines
7. ❌ **No input validation** → ✅ Validate at boundaries
8. ❌ **Ignoring test failures** → ✅ Fix tests immediately

## Modern Python Features to Use

- **Type hints** (Python 3.10+ syntax: `list[str]`, `dict[str, int]`)
- **Dataclasses** for simple data containers
- **f-strings** for string formatting
- **Pathlib** instead of os.path
- **Match/case** statements (Python 3.10+)
- **Union types** with `|` operator (Python 3.10+)
- **Structural pattern matching**
- **async/await** for I/O-bound operations