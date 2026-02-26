# AWS BedrockAgentCore Runtime

BedrockAgentCoreApp replaces FastAPI/Flask as the HTTP runtime for Strands agents. It is Starlette-based and AWS AgentCore compatible.

## Installation

```bash
pip install bedrock-agentcore
# or with uv:
uv add bedrock-agentcore
```

## Basic Usage

```python
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from bedrock_agentcore.runtime.context import RequestContext

app = BedrockAgentCoreApp()

@app.entrypoint
async def invoke(payload: dict, context: RequestContext) -> dict:
    query = payload.get("query", "")
    session_id = context.session_id or "default"
    # ... run your agent ...
    return {"result": "..."}

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
```

## Routes

| Path | Method | Purpose |
|---|---|---|
| `/invocations` | POST | Main agent handler (decorated with `@app.entrypoint`) |
| `/ping` | GET | Health check |
| `/ws` | WS | WebSocket (optional) |

Default port: **8080**.

## RequestContext

The `context` parameter is auto-injected if your handler accepts it:

```python
from bedrock_agentcore.runtime.context import RequestContext

@app.entrypoint
def handler(payload: dict, context: RequestContext) -> dict:
    context.session_id       # from X-Amzn-Bedrock-AgentCore-Runtime-Session-Id header
    context.request_headers  # Authorization + X-Amzn-Bedrock-AgentCore-Runtime-Custom-* headers
```

`session_id` is `None` if the header is absent.

## With Strands Agent

```python
import asyncio, re
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from bedrock_agentcore.runtime.context import RequestContext
from strands import Agent
from strands.models.openai import OpenAIModel
from strands.session import FileSessionManager
from strands.agent.conversation_manager import SlidingWindowConversationManager

app = BedrockAgentCoreApp()

def _safe_session_id(s: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "_", s)

def _run_agent(query: str, session_id: str) -> dict:
    # Build a fresh agent per request (MCPClient cannot be reused across agents)
    agent = Agent(
        model=OpenAIModel(
            model_id="gpt-4o",
            client_args={"api_key": "...", "base_url": "..."},
        ),
        tools=[...],
        session_manager=FileSessionManager(
            session_id=_safe_session_id(session_id),
            storage_dir="/tmp/strands/sessions",
        ),
        conversation_manager=SlidingWindowConversationManager(window_size=20),
    )
    result = agent(query, structured_output_model=MyOutputModel)
    return result.structured_output.model_dump() if result.structured_output else {"response": str(result)}

@app.entrypoint
async def invoke(payload: dict, context: RequestContext) -> dict:
    query = payload.get("query", "")
    if not query:
        return {"error": "Missing required field: query"}

    # session_id: payload field → AgentCore header → fallback
    session_id = payload.get("session_id") or (context.session_id if context else None) or "default"

    # Run in thread: Strands MCPClient uses its own event loop,
    # conflicts with the running async loop if called directly
    return await asyncio.to_thread(_run_agent, query, session_id)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
```

## Calling the API

```bash
# Invoke
curl -X POST http://localhost:8080/invocations \
  -H "Content-Type: application/json" \
  -d '{"query": "How many customers in France?", "session_id": "user-123"}'

# With AgentCore session header
curl -X POST http://localhost:8080/invocations \
  -H "Content-Type: application/json" \
  -H "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id: user-123" \
  -d '{"query": "How many customers in France?"}'

# Health check
curl http://localhost:8080/ping
```

## Docker Healthcheck

```dockerfile
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/ping || exit 1
```

## Key Constraints

- `asyncio.to_thread(_run_agent, ...)` is required: Strands `MCPClient` runs its own background event loop; calling `Agent.__call__` directly from an async context causes `already running` conflicts.
- Create a fresh `MCPClient` and `Agent` per request — `MCPClient` cannot be reused across agent instances.
- `MCPClient.__del__` may log `Cannot close a running event loop` on cleanup — known Strands issue, non-fatal.
