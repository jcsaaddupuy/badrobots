# OpenAI API Usage Rules

## Environment Variables
When using OpenAI API, always assume that the following environment variables are set:
- `OPENAI_BASE_URL`
- `OPENAI_API_KEY`

## Docker Integration
If using Docker Compose, propagate `OPENAI_BASE_URL` and `OPENAI_API_KEY` from developer environment.

Example in docker-compose.yml:
```yaml
services:
  myapp:
    environment:
      - OPENAI_BASE_URL
      - OPENAI_API_KEY
```

## ChatOpenAI Type Checking Issue

When using `ChatOpenAI` from LangChain, the `model` parameter is known to raise `unknown-argument` when using type checking.

Add a `# type: ignore[unknown-argument]` comment to the model parameter:

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model=model,  # type: ignore[unknown-argument]
    # ...
)
```
