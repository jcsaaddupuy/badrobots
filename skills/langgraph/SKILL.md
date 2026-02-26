---
name: langgraph
description: "LangGraph framework for AI agent workflows"
---

# LangGraph - Agent Usage Guide

## Core Concept
LangGraph is a framework for building stateful, multi-actor applications with LLMs. It provides a graph-based approach to orchestrating LLM chains and agents.

## Critical Reference Files
**IMPORTANT**: Before working with LangGraph code, read these reference files:

- [Core Rules](references/core-rules.md) - Node implementation, prompting, configuration
- [Chat Interface](references/chat-interface.md) - Building chat applications with MessagesState
- [Docker Configuration](references/docker.md) - Docker setup for LangGraph projects

## Quick Decision Tree

### When creating a NEW LangGraph application:
1. Read [references/core-rules.md](references/core-rules.md) for node structure
2. Define your State (inherit from MessagesState if building chat)
3. Create Configuration class for user-controllable parameters
4. Implement nodes as async functions with `Runtime[Configuration]`
5. Create prompts in separate `prompts.py` module
6. Set up Docker configuration (see [references/docker.md](references/docker.md))

### When building a CHAT interface:
1. Read [references/chat-interface.md](references/chat-interface.md)
2. Use MessagesState or inherit from it
3. Parse HumanMessages correctly
4. Return AIMessages in response
5. Handle message history appropriately

### When working with PROMPTS:
1. Read prompting section in [references/core-rules.md](references/core-rules.md)
2. Store all prompts in `prompts.py` as UPPER_SNAKE_CASE constants
3. Use PromptTemplate with input_variables
4. Always use structured output with Pydantic parsers
5. Ensure variable consistency

## Core Principles
1. **All nodes must be async** - Use `async def` for all node functions
2. **Use Runtime for configuration** - Not the old `config` parameter
3. **Separate prompts** - Store in `prompts.py`, not inline
4. **Structured output** - Always use Pydantic parsers with LLMs
5. **Type safety** - Full type hints on all functions

## Common Patterns

### Node Signature
```python
from langgraph.runtime import Runtime

async def my_node(state: State, runtime: Runtime[Configuration]) -> Dict[str, Any]:
    """Process state and return updates."""
    context = runtime.context or Configuration()
    # Your logic here
    return {"field": value}
```

### Structured LLM Call
```python
from langchain_core.output_parsers import PydanticOutputParser
from pydantic import BaseModel

class Response(BaseModel):
    answer: str

parser = PydanticOutputParser(pydantic_object=Response)
prompt = PromptTemplate(
    template=PROMPT_TEMPLATE + "\n{format_instructions}",
    input_variables=["query"],
    partial_variables={"format_instructions": parser.get_format_instructions()},
)
result = await parser.ainvoke(await (prompt | llm).ainvoke({"query": query}))
```

## Integration Points

### With Python
- Follow [../python/SKILL.md](../python/SKILL.md) for general Python practices
- Use uv for dependency management (see [../python-uv/SKILL.md](../python-uv/SKILL.md))
- Implement tests following [../python/references/testing.md](../python/references/testing.md)

### With Docker
- See [references/docker.md](references/docker.md) for LangGraph-specific Docker setup
- Follow [../docker/SKILL.md](../docker/SKILL.md) for general Docker practices

### With OpenAI
- See [../openai/SKILL.md](../openai/SKILL.md) for OpenAI API integration

## Workflow for LangGraph Development

```
1. Read reference files
   ├─ Core rules for structure
   ├─ Chat interface if building chat app
   └─ Docker config for deployment
   ↓
2. Define data structures
   ├─ State class (with MessagesState if chat)
   ├─ Configuration class
   └─ Pydantic models for LLM outputs
   ↓
3. Create prompts module
   ├─ Define constants in prompts.py
   ├─ Ensure variable consistency
   └─ Plan structured outputs
   ↓
4. Implement nodes
   ├─ Async functions with Runtime
   ├─ Use structured LLM calls
   └─ Return state updates
   ↓
5. Build graph
   ├─ Create StateGraph
   ├─ Add nodes and edges
   └─ Compile graph
   ↓
6. Set up Docker
   ├─ Create Dockerfile with Rust support
   ├─ Configure docker-compose
   └─ Test deployment
```

## Quick Reference Commands

```bash
# Run LangGraph dev server
uv run langgraph dev --config langgraph.json --host 0.0.0.0

# With LangSmith Studio
uv run langgraph dev --studio-url https://langsmith.foundry.ubisoft.org --config langgraph.json

# Test graph
uv run python -m pytest tests/
```

## Common Pitfalls to Avoid

1. ❌ Sync node functions → ✅ Always use `async def`
2. ❌ Using old `config` parameter → ✅ Use `Runtime[Configuration]`
3. ❌ Inline prompts → ✅ Separate `prompts.py` module
4. ❌ Unstructured LLM output → ✅ Always use Pydantic parsers
5. ❌ Missing Rust in Docker → ✅ Install Rust for jsonschema-rs
6. ❌ Wrong langgraph.json path → ✅ Use relative or importable module path
