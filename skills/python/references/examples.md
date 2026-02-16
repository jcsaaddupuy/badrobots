# Python Code Examples

## FastAPI Example
- Always use `async def` for routes
- Never hardcode application URL path, always use `request.url_for()`

```python
from typing import Union
from fastapi import FastAPI
import uvicorn

app = FastAPI()

@app.get("/health", status_code=200)
async def healthcheck():
    return "ok"

@app.get("/")
async def read_root():
    return {"Hello": "World"}

if __name__ == "__main__":
    uvicorn.run(app, host='0.0.0.0', port=8080)
```

## Click CLI Example

```python
import click

@click.command()
@click.option('--count', default=1, help='Number of greetings.')
@click.option('--name', prompt='Your name', help='The person to greet.')
def hello(count, name):
    """Simple program that greets NAME for a total of COUNT times."""
    for x in range(count):
        click.echo(f"Hello {name}!")

if __name__ == '__main__':
    hello()
```

## Click + FastAPI Example

```python
import click
import uvicorn
from fastapi import FastAPI

app = FastAPI()

@click.command()
@click.option('--host', default="127.0.0.1", help='Server host.')
@click.option('--port', default=8080, help='Server port.')
def run(host, port):
    """Simple program that runs a uvicorn server."""
    uvicorn.run(app, host=host, port=port)

if __name__ == '__main__':
    run()
```

## Settings Example

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
import os

# Can be in a common module
class AuthenticationBaseSettings(BaseSettings):
    """Base settings for authentication."""
    # See https://docs.pydantic.dev/latest/concepts/pydantic_settings/#use-case-docker-secrets
    model_config = SettingsConfigDict(
        secrets_dir="/run/secrets" if os.path.exists("/run/secrets") else None
    )

# Can be in a local module
class CustomSettings(AuthenticationBaseSettings):
    # This will be mapped to the environment variable CUSTOM_SETTING_VALUE
    custom_setting_value: str
```

## Sentry Integration

Do not use Sentry by default. Only use it when asked for error tracking.

### Adding Sentry Dependency
If the project uses `pyproject.toml`, add sentry as an optional dependency:

```bash
uv add 'sentry-sdk' --optional sentry
```

```toml
# pyproject.toml
[project.optional-dependencies]
sentry = [
    "sentry-sdk>=2.50.0",
]
```

### Initializing Sentry
Only activate when the `SENTRY_DSN` environment variable is set:

```python
import os

try:
    import sentry_sdk
    if sentry_dsn := os.getenv("SENTRY_DSN"):
        sentry_sdk.init(dsn=sentry_dsn, traces_sample_rate=1.0)
        print("Sentry initialized")
except ImportError:
    pass  # sentry not available
```
