# LangGraph Core Rules

## Node Implementation
- All nodes must be asynchronous using `async def`
- Do not use `config: RunnableConfig` parameter in nodes anymore
- Always use the interface `Runtime[Configuration]` instead of obsolete `config` parameter
  - Configuration is then available at `runtime.context`

Example node signature:
```python
from langgraph.runtime import Runtime

def node(state: State, runtime: Runtime[Configuration]) -> Dict[str, Any]:
    pass
```

## Docker Requirements
- Always install Rust in docker images, as `jsonschema-rs` may need to be built

## Configuration in langgraph.json
In `langgraph.json`, under the key 'graphs':
- Use either the relative file path OR the importable module
- Examples:
  - `"./src/module/agent.py:graph"` (relative path)
  - `"module.agent:graph"` (importable module)
- **NOT**: `"src.module.agent:graph"`

## Prompting

### Prompt Organization
- Prompts MUST be in a custom module `prompts.py`
- Prompt templates MUST be constants, UPPER_SNAKE_CASE
- Prompts MUST be `str`, not `PromptTemplate` or `ChatPromptTemplate`
- Prompts MUST NOT be formatted using `.format()` or f-strings
- Use `PromptTemplate` or `ChatPromptTemplate` with `input_variables` and `partial_variables`

### Structured Output
- Always use structured output when talking to an LLM, using Pydantic parsers
- Always allow prompts to be overloaded

Example:
```python
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import PromptTemplate
from pydantic import BaseModel, Field
from typing import Optional

class SomeResponse(BaseModel):
    some_field: str = Field(description="Some desc.")

async def query_rewrite(
    llm: OpenAI,
    some_param: str,
    prompt: Optional[str] = None,
) -> SomeResponse:
    parser = PydanticOutputParser(pydantic_object=SomeResponse)
    # prompts.SOME_PROMPT is a string containing multiple variables
    system_prompt = PromptTemplate(
        template=(prompt or prompts.SOME_PROMPT) + "\n{format_instructions}",
        input_variables=["user_query", "semantic_model", "glossary", "current_date"],
        partial_variables={"format_instructions": parser.get_format_instructions()},
    )
    
    prompt_and_model = system_prompt | llm
    current_date = date.today().isoformat()
    output = await prompt_and_model.ainvoke({
        "user_query": user_query,
        "glossary": glossary,
        "semantic_model": semantic_model,
        "current_date": current_date
    })
    logger.debug("Output : %s", output)
    return await parser.ainvoke(output)
```

### Variable Consistency
Ensure variable consistency in prompts.

If prompt is:
```python
CHART_RECOMMENDATION_PROMPT = """You are a data something expert. 

User query: {user_query}
Data sample (first 10 rows): {data}
Current date: {current_date}

{format_instructions}"""
```

The template instantiation MUST contain the correct variables:
```python
system_prompt = PromptTemplate(
    template=prompts.CHART_RECOMMENDATION_PROMPT + "\n{format_instructions}",
    input_variables=["user_query", "data", "current_date"],
    partial_variables={"format_instructions": parser.get_format_instructions()},
)
```
