# OpenAI Integration

## Basic Configuration

```python
from strands import Agent
from strands.models import OpenAIModel

# OpenAI with API key
openai_model = OpenAIModel(
    model_id="gpt-4o",
    client_args={"api_key": "your-openai-api-key"},
    params={"temperature": 0.7, "max_tokens": 2048}
)
agent = Agent(model=openai_model)
response = agent("Hello, how are you?")
```

## Environment Variables

Set your API key via environment variable:

```bash
export OPENAI_API_KEY="your-openai-api-key"
```

Then use without explicit key:

```python
from strands import Agent
from strands.models import OpenAIModel

openai_model = OpenAIModel(
    model_id="gpt-4o",
    params={"temperature": 0.7, "max_tokens": 2048}
)
agent = Agent(model=openai_model)
```

## Available Models

- `gpt-4o` - Latest GPT-4 Optimized
- `gpt-4o-mini` - Faster, cost-effective
- `gpt-4-turbo` - GPT-4 Turbo
- `gpt-3.5-turbo` - Fast and efficient

## Model Parameters

```python
openai_model = OpenAIModel(
    model_id="gpt-4o",
    params={
        "temperature": 0.7,      # 0.0-2.0, controls randomness
        "max_tokens": 2048,      # Maximum response length
        "top_p": 0.9,            # Nucleus sampling
        "frequency_penalty": 0,  # -2.0 to 2.0
        "presence_penalty": 0    # -2.0 to 2.0
    }
)
```

## Streaming Responses

```python
from strands import Agent
from strands.models import OpenAIModel
import asyncio

async def stream_openai():
    openai_model = OpenAIModel(
        model_id="gpt-4o",
        client_args={"api_key": "your-openai-api-key"}
    )
    agent = Agent(model=openai_model)
    
    async for event in agent.stream_async("Tell me a story"):
        if "data" in event:
            print(event["data"], end="", flush=True)

asyncio.run(stream_openai())
```

## With Custom Tools

```python
from strands import Agent, tool
from strands.models import OpenAIModel

@tool
def get_weather(city: str) -> dict:
    """Get weather for a city."""
    return {
        "status": "success",
        "content": [{"text": f"Weather in {city}: Sunny, 22°C"}]
    }

openai_model = OpenAIModel(
    model_id="gpt-4o",
    client_args={"api_key": "your-openai-api-key"}
)
agent = Agent(model=openai_model, tools=[get_weather])
response = agent("What's the weather in Paris?")
```

## Error Handling

```python
from strands import Agent
from strands.models import OpenAIModel

try:
    openai_model = OpenAIModel(
        model_id="gpt-4o",
        client_args={"api_key": "your-openai-api-key"}
    )
    agent = Agent(model=openai_model)
    response = agent("Hello!")
except Exception as e:
    print(f"Error: {e}")
```

## Custom Base URL (Corporate Proxy / LiteLLM)

`api_key` and `base_url` are **not** direct kwargs on `OpenAIModel.__init__` — pass them via `client_args`:

```python
import os
from strands.models import OpenAIModel

model = OpenAIModel(
    model_id="gpt-4o",
    client_args={
        "api_key": os.getenv("OPENAI_API_KEY", "nokey"),
        "base_url": os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
    },
)
```

Always read `OPENAI_BASE_URL` from env — never hardcode it. Corporate environments often route through a proxy (e.g. LiteLLM, Azure OpenAI).

## Structured Output with Pydantic

OpenAI native structured output via `beta.chat.completions.parse()` guarantees schema conformance. In Strands, pass a Pydantic model to the agent call:

```python
from pydantic import BaseModel, Field
from strands import Agent
from strands.models import OpenAIModel

class SQLResult(BaseModel):
    sql: str = Field(description="Generated SQL query")
    explanation: str = Field(description="What the query does")
    confidence: float = Field(ge=0.0, le=1.0)

agent = Agent(model=OpenAIModel(model_id="gpt-4o"))

# Per-call structured output (recommended)
result = agent("Generate SQL for: count customers in France", structured_output_model=SQLResult)
assert isinstance(result.structured_output, SQLResult)

# Or set at Agent init level (applies to all calls)
agent = Agent(model=OpenAIModel(model_id="gpt-4o"), structured_output_model=SQLResult)
result = agent("Generate SQL for: count customers in France")
```

Use the raw OpenAI client directly when you need structured output inside a sampling callback:

```python
client = openai.OpenAI(api_key=..., base_url=...)
response = client.beta.chat.completions.parse(
    model="gpt-4o",
    messages=messages,
    response_format=SQLResult,
)
parsed: SQLResult = response.choices[0].message.parsed
```

## Best Practices

1. **API Key Security**: Never hardcode API keys. Use environment variables or secure vaults.
2. **Base URL**: Always read `OPENAI_BASE_URL` from env with a sensible default.
3. **client_args**: Pass `api_key` and `base_url` via `client_args={}`, not as direct kwargs.
4. **Rate Limits**: OpenAI has rate limits. Implement retry logic for production.
5. **Cost Management**: Monitor token usage via `result.metrics` to control costs.
6. **Model Selection**: Use `gpt-4o-mini` for cost-effective tasks, `gpt-4o` for complex reasoning.
7. **Temperature**: Lower (0.0-0.3) for deterministic outputs, higher (0.7-1.0) for creative tasks.
