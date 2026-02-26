---
name: openai
description: "OpenAI API integration guide"
---

# OpenAI API - Agent Usage Guide

## Core Concept
Integration guide for using OpenAI's API in Python projects, particularly with LangChain and LangGraph.

## Critical Reference Files
**IMPORTANT**: Before working with OpenAI API, read:

- [Core Rules](references/core-rules.md) - Environment setup and ChatOpenAI usage

## Environment Setup

### Required Variables
Always assume these environment variables are set:
- `OPENAI_BASE_URL` - API endpoint
- `OPENAI_API_KEY` - Authentication key

### Docker Integration
When using Docker Compose, propagate from host environment:

```yaml
services:
  myapp:
    environment:
      - OPENAI_BASE_URL
      - OPENAI_API_KEY
```

## ChatOpenAI Usage

### Type Checking Workaround
The `model` parameter raises type checking warnings. Use type ignore comment:

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="gpt-4",  # type: ignore[unknown-argument]
    temperature=0.7,
)
```

## Integration with LangGraph

When using OpenAI with LangGraph:
1. Read [../langgraph/SKILL.md](../langgraph/SKILL.md) for LangGraph patterns
2. Use structured output with Pydantic (see [../langgraph/references/core-rules.md](../langgraph/references/core-rules.md))
3. Always use async calls with `ainvoke()`

Example:
```python
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import PydanticOutputParser

llm = ChatOpenAI(
    model="gpt-4",  # type: ignore[unknown-argument]
)

parser = PydanticOutputParser(pydantic_object=ResponseModel)
result = await parser.ainvoke(await (prompt | llm).ainvoke(inputs))
```

## Best Practices

1. **Never hardcode credentials** - Always use environment variables
2. **Use type ignore for model parameter** - Known LangChain issue
3. **Prefer async calls** - Use `ainvoke()` over `invoke()`
4. **Structured outputs** - Always parse with Pydantic in LangGraph
5. **Error handling** - Wrap API calls in try/except for rate limits

## Integration Points

### With Python
- Follow [../python/SKILL.md](../python/SKILL.md) for general practices
- See [../python/references/secrets.md](../python/references/secrets.md) for handling API keys

### With LangGraph  
- See [../langgraph/SKILL.md](../langgraph/SKILL.md) for graph integration
- Use structured output patterns from [../langgraph/references/core-rules.md](../langgraph/references/core-rules.md)

### With Docker
- Propagate environment variables in docker-compose
- See [../docker/SKILL.md](../docker/SKILL.md) for container setup
