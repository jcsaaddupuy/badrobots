# Model Context Protocol (MCP) Integration

## Overview

MCP enables integration with thousands of pre-built tools from MCP servers. Strands provides seamless integration via `MCPClient`.

## Basic Usage

### Connect to MCP Server

```python
from strands import Agent
from strands.tools.mcp import MCPClient
from mcp import stdio_client, StdioServerParameters

# Connect to AWS documentation server
aws_docs_client = MCPClient(
    lambda: stdio_client(StdioServerParameters(
        command="uvx",
        args=["awslabs.aws-documentation-mcp-server@latest"]
    ))
)

with aws_docs_client:
    agent = Agent(tools=aws_docs_client.list_tools_sync())
    response = agent("Tell me about Amazon Bedrock and how to use it with Python")
```

## MCPClient Configuration

### Startup Timeout

```python
aws_docs_client = MCPClient(
    lambda: stdio_client(StdioServerParameters(
        command="uvx",
        args=["awslabs.aws-documentation-mcp-server@latest"]
    )),
    startup_timeout=30  # Timeout for server initialization
)
```

### Tool Filtering

```python
# Only include specific tools
filesystem_client = MCPClient(
    lambda: stdio_client(StdioServerParameters(
        command="npx",
        args=["@anthropic/mcp-server-filesystem", "/tmp"]
    )),
    tool_filters={
        "allowed": ["read_file", "list_directory"],  # Only these tools
        "rejected": ["delete_file"]  # Exclude these
    },
    prefix="fs"  # Prefix tool names: fs_read_file, fs_list_directory
)
```

### Tool Prefix

```python
# Add prefix to avoid name conflicts
client = MCPClient(
    lambda: stdio_client(StdioServerParameters(
        command="npx",
        args=["@anthropic/mcp-server-filesystem", "/tmp"]
    )),
    prefix="fs"  # Tools become: fs_read_file, fs_list_directory, etc.
)
```

## MCP over SSE (Containerized / Network Transport)

Use SSE when MCP servers run as **independent processes or containers** — stdio only works for subprocesses within the same host. FastMCP supports both transports.

### Server (SSE mode)

```python
# server.py
import os
from mcp.server.fastmcp import FastMCP

PORT = int(os.getenv("PORT", 3001))
mcp = FastMCP("my-mcp-server", host="0.0.0.0", port=PORT)

@mcp.tool(description="My tool")
def my_tool(param: str) -> dict:
    return {"result": param}

if __name__ == "__main__":
    mcp.run(transport="sse")   # binds to 0.0.0.0:PORT, SSE endpoint at /sse
```

### Client (SSE mode)

```python
from strands.tools.mcp import MCPClient
from mcp.client.sse import sse_client

# MCPClient works identically over SSE
semantic_client = MCPClient(lambda: sse_client("http://semantic-mcp:3001/sse"))
sql_exec_client  = MCPClient(lambda: sse_client("http://sql-exec-mcp:3003/sse"))

agent = Agent(tools=[semantic_client, sql_exec_client, ...])
```

### Transport selection rule

| Scenario | Transport |
|---|---|
| Local dev, server is a subprocess | `stdio_client` |
| Docker / separate containers | `sse_client` |
| Production microservices | `sse_client` |

---

## MCP Sampling (Server calls back to Agent for LLM)

MCP sampling lets a server call back to the client to run LLM inference. The server never holds an API key — the agent owns the LLM provider.

**Problem**: `Strands MCPClient` does NOT wire `sampling_callback` to its internal `ClientSession`. Use a `@strands.tool` that manages its own `ClientSession` directly.

### Server side

```python
# server.py — model-agnostic, just calls ctx.session.create_message()
from mcp.server.fastmcp import FastMCP, Context
from mcp.types import SamplingMessage, TextContent
from pydantic import BaseModel

class SQLGenResult(BaseModel):
    sql: str
    explanation: str
    confidence: float

mcp = FastMCP("sql-generation-mcp", host="0.0.0.0", port=3002)

@mcp.tool(description="Generate SQL via MCP sampling")
async def generate_sql(user_query: str, ctx: Context) -> dict:
    result = await ctx.session.create_message(
        messages=[SamplingMessage(role="user", content=TextContent(type="text", text=user_query))],
        system_prompt="You are a SQL expert. Return JSON: {sql, explanation, confidence}",
        max_tokens=1024,
    )
    # Validate before returning
    parsed = SQLGenResult.model_validate_json(result.content.text)
    return parsed.model_dump()
```

### Agent side (sampling_callback)

```python
# sql_generation_tool.py
import asyncio, openai
from mcp import ClientSession
from mcp.client.sse import sse_client
from mcp.shared.context import RequestContext
from mcp.types import CreateMessageRequestParams, CreateMessageResult, ErrorData, INTERNAL_ERROR, TextContent
from strands import tool

async def _sampling_callback(
    context: RequestContext,
    params: CreateMessageRequestParams,
) -> CreateMessageResult | ErrorData:
    """Agent-side LLM call, triggered by MCP server via ctx.session.create_message()."""
    try:
        messages = []
        if params.systemPrompt:
            messages.append({"role": "system", "content": params.systemPrompt})
        for msg in params.messages:
            text = msg.content.text if hasattr(msg.content, "text") else str(msg.content)
            messages.append({"role": msg.role, "content": text})

        # Use structured output to guarantee schema conformance
        client = openai.OpenAI(api_key=..., base_url=...)
        response = client.beta.chat.completions.parse(
            model="gpt-4o",
            messages=messages,
            max_tokens=params.maxTokens,
            response_format=SQLGenResult,
        )
        parsed: SQLGenResult = response.choices[0].message.parsed
        return CreateMessageResult(
            role="assistant",
            content=TextContent(type="text", text=parsed.model_dump_json()),
            model="gpt-4o",
            stopReason="endTurn",
        )
    except Exception as e:
        return ErrorData(code=INTERNAL_ERROR, message=str(e))


async def _call_tool(user_query: str) -> SQLGenResult:
    # Use sse_client + ClientSession directly to wire sampling_callback
    async with sse_client("http://sql-generation-mcp:3002/sse") as (read, write):
        async with ClientSession(read, write, sampling_callback=_sampling_callback) as session:
            await session.initialize()
            result = await session.call_tool("generate_sql", {"user_query": user_query})
    for block in result.content:
        if hasattr(block, "text"):
            return SQLGenResult.model_validate_json(block.text)
    raise ValueError("No text content returned")


@tool
def generate_sql(user_query: str) -> str:
    """Generate SQL — routes LLM call back to agent via MCP sampling."""
    result = asyncio.run(_call_tool(user_query))
    return result.model_dump_json()
```

### Why @tool instead of MCPClient for sampling servers

`MCPClient` creates a `ClientSession` without `sampling_callback` — the callback would silently fail. Wrapping in a `@tool` with manual `ClientSession(sampling_callback=...)` is the correct pattern until Strands SDK wires it natively.

---

## Session Management

```python
from strands import Agent
from strands.session import FileSessionManager
from strands.agent.conversation_manager import SlidingWindowConversationManager

agent = Agent(
    model=model,
    tools=[...],
    session_manager=FileSessionManager(
        session_id="user-123",
        storage_dir="/tmp/strands/sessions",   # or use S3SessionManager for prod
    ),
    conversation_manager=SlidingWindowConversationManager(window_size=20),
)
```

For multi-replica production deployments, use `S3SessionManager` instead of `FileSessionManager`.

---



```python
from strands import Agent
from strands.tools.mcp import MCPClient
from mcp import stdio_client, StdioServerParameters

# AWS documentation server
aws_docs_client = MCPClient(
    lambda: stdio_client(StdioServerParameters(
        command="uvx",
        args=["awslabs.aws-documentation-mcp-server@latest"]
    ))
)

# Filesystem server
filesystem_client = MCPClient(
    lambda: stdio_client(StdioServerParameters(
        command="npx",
        args=["@anthropic/mcp-server-filesystem", "/tmp"]
    )),
    prefix="fs"
)

# Use both servers
with aws_docs_client, filesystem_client:
    all_tools = aws_docs_client.list_tools_sync() + filesystem_client.list_tools_sync()
    agent = Agent(tools=all_tools)
    response = agent("Read the README file and summarize it")
```

## MCP Prompts

Access pre-defined prompts from MCP servers:

```python
from strands.tools.mcp import MCPClient
from mcp import stdio_client, StdioServerParameters

client = MCPClient(
    lambda: stdio_client(StdioServerParameters(
        command="uvx",
        args=["awslabs.aws-documentation-mcp-server@latest"]
    ))
)

with client:
    # List available prompts
    prompts = client.list_prompts_sync()
    print(f"Available prompts: {[p.name for p in prompts]}")
    
    # Get a specific prompt
    prompt_result = client.get_prompt_sync("my-prompt", {"arg1": "value"})
    print(f"Prompt: {prompt_result}")
```

## MCP Resources

Access resources from MCP servers:

```python
from strands.tools.mcp import MCPClient
from mcp import stdio_client, StdioServerParameters

client = MCPClient(
    lambda: stdio_client(StdioServerParameters(
        command="npx",
        args=["@anthropic/mcp-server-filesystem", "/tmp"]
    ))
)

with client:
    # List available resources
    resources = client.list_resources_sync()
    print(f"Available resources: {[r.uri for r in resources]}")
    
    # Read a specific resource
    content = client.read_resource_sync("file:///path/to/resource")
    print(f"Resource content: {content}")
```

## Popular MCP Servers

### AWS Documentation

```python
aws_docs_client = MCPClient(
    lambda: stdio_client(StdioServerParameters(
        command="uvx",
        args=["awslabs.aws-documentation-mcp-server@latest"]
    ))
)
```

### Filesystem

```python
filesystem_client = MCPClient(
    lambda: stdio_client(StdioServerParameters(
        command="npx",
        args=["@anthropic/mcp-server-filesystem", "/path/to/directory"]
    ))
)
```

### GitHub

```python
github_client = MCPClient(
    lambda: stdio_client(StdioServerParameters(
        command="npx",
        args=["@modelcontextprotocol/server-github"]
    ))
)
```

### Brave Search

```python
brave_client = MCPClient(
    lambda: stdio_client(StdioServerParameters(
        command="npx",
        args=["@modelcontextprotocol/server-brave-search"]
    ))
)
```

## Error Handling

### Connection Errors

```python
from strands.tools.mcp import MCPClient
from mcp import stdio_client, StdioServerParameters

try:
    client = MCPClient(
        lambda: stdio_client(StdioServerParameters(
            command="uvx",
            args=["awslabs.aws-documentation-mcp-server@latest"]
        )),
        startup_timeout=30
    )
    
    with client:
        tools = client.list_tools_sync()
        print(f"Connected: {len(tools)} tools available")
except TimeoutError:
    print("MCP server startup timeout")
except Exception as e:
    print(f"Connection error: {e}")
```

### Tool Execution Errors

```python
from strands import Agent
from strands.tools.mcp import MCPClient

client = MCPClient(...)

with client:
    agent = Agent(tools=client.list_tools_sync())
    
    try:
        response = agent("Execute risky operation")
    except RuntimeError as e:
        if "Connection to the MCP server was closed" in str(e):
            print("MCP server connection lost")
        else:
            raise
```

## Best Practices

### 1. Use Context Managers

Always use `with` statement for automatic cleanup:

```python
# ✅ Good - Automatic cleanup
with mcp_client:
    agent = Agent(tools=mcp_client.list_tools_sync())
    response = agent("Use MCP tools")

# ❌ Bad - Manual cleanup required
mcp_client = MCPClient(...)
agent = Agent(tools=mcp_client.list_tools_sync())
# Cleanup not guaranteed
```

### 2. Filter Tools

Only expose necessary tools to reduce context:

```python
# ✅ Good - Only necessary tools
client = MCPClient(
    ...,
    tool_filters={"allowed": ["read_file", "list_directory"]}
)

# ❌ Bad - All tools exposed
client = MCPClient(...)  # Exposes all tools including dangerous ones
```

### 3. Use Prefixes

Avoid name conflicts with prefixes:

```python
# ✅ Good - Prefixed tools
fs_client = MCPClient(..., prefix="fs")
db_client = MCPClient(..., prefix="db")

# Both have "list" tool, but become: fs_list, db_list
```

### 4. Set Timeouts

Configure appropriate timeouts:

```python
# ✅ Good - Reasonable timeout
client = MCPClient(..., startup_timeout=30)

# ❌ Bad - No timeout (may hang)
client = MCPClient(...)
```

### 5. Handle Errors

Implement error handling for robustness:

```python
try:
    with mcp_client:
        agent = Agent(tools=mcp_client.list_tools_sync())
        response = agent("Task")
except TimeoutError:
    print("MCP server timeout")
except RuntimeError as e:
    print(f"MCP error: {e}")
```

## Advanced Usage

### Custom MCP Server

Create your own MCP server:

```python
# server.py
from mcp.server import Server
from mcp.types import Tool

server = Server("my-custom-server")

@server.list_tools()
async def list_tools():
    return [
        Tool(
            name="custom_tool",
            description="A custom tool",
            inputSchema={
                "type": "object",
                "properties": {
                    "param": {"type": "string"}
                }
            }
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "custom_tool":
        return {"result": f"Processed: {arguments['param']}"}

if __name__ == "__main__":
    server.run()
```

Connect to custom server:

```python
custom_client = MCPClient(
    lambda: stdio_client(StdioServerParameters(
        command="python",
        args=["server.py"]
    ))
)
```

### Async MCP Operations

```python
import asyncio
from strands.tools.mcp import MCPClient

async def async_mcp():
    client = MCPClient(...)
    
    async with client:
        tools = await client.list_tools()
        prompts = await client.list_prompts()
        resources = await client.list_resources()
        
        print(f"Tools: {len(tools)}")
        print(f"Prompts: {len(prompts)}")
        print(f"Resources: {len(resources)}")

asyncio.run(async_mcp())
```

## Troubleshooting

### Server Not Starting

```bash
# Check if command is available
which uvx
which npx

# Test server manually
uvx awslabs.aws-documentation-mcp-server@latest

# Check logs
python -c "import logging; logging.basicConfig(level=logging.DEBUG)"
```

### Connection Hanging

```python
# Increase timeout
client = MCPClient(..., startup_timeout=60)

# Check for error messages
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Tool Not Found

```python
# List all available tools
with client:
    tools = client.list_tools_sync()
    print(f"Available tools: {[t.tool_name for t in tools]}")
```

## MCP Resources

- [MCP Documentation](https://modelcontextprotocol.io/)
- [MCP Servers Registry](https://github.com/modelcontextprotocol/servers)
- [Creating MCP Servers](https://modelcontextprotocol.io/docs/creating-servers)
- [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk)
