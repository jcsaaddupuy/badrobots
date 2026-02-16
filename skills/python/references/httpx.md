# Python HTTPX Usage

## Retry with Tenacity
Always use `tenacity` for retrying httpx requests in case of transient failures.

Example:
```python
import tenacity
import httpx

@tenacity.retry(
    wait=tenacity.wait_exponential(multiplier=1, min=4, max=10),
    stop=tenacity.stop_after_attempt(3),
    retry=tenacity.retry_if_exception_type(httpx.RequestError),  # see https://www.python-httpx.org/exceptions/
    reraise=True,
)
async def fetch_url(url: str) -> httpx.Response:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url)
        response.raise_for_status()  # Raise an error for bad responses (4xx and 5xx)
        return response
```

## Hishel Caching
Always provide a way to propagate settings like SSL validation.

Example using hishel with async cache client:
```python
from hishel.httpx import AsyncCacheClient

async with AsyncCacheClient() as client:
    # First request - fetches from origin
    response = await client.get("https://api.example.com/data")
    print(response.extensions["hishel_from_cache"])  # False
    
    # Second request - served from cache
    response = await client.get("https://api.example.com/data")
    print(response.extensions["hishel_from_cache"])  # True
```
