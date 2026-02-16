# LangGraph Chat Interface

## Chat Interface Concept
A graph having a Chat interface is a `graph` built with an input/output schema respecting the `MessageState` class definition.

See: https://github.com/langchain-ai/langgraph/blob/main/libs/langgraph/langgraph/graph/message.py#L308-L309

## Messages State

```python
from typing_extensions import TypedDict
from typing import Annotated
from langchain_core.messages import AnyMessage, add_messages

class MessagesState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
```

This class can be inherited to add custom attributes:

See: https://langchain-ai.github.io/langgraph/concepts/low_level/#messagesstate

```python
class State(MessagesState):
    """State for the chat agent."""
    documents: list[str]
```

## Message Types

LangChain defines multiple message types. Primary messages:
- [HumanMessage](https://github.com/langchain-ai/langchain/blob/master/libs/core/langchain_core/messages/human.py): Messages passed from a human to the model
- [AIMessage](https://github.com/langchain-ai/langchain/blob/master/libs/core/langchain_core/messages/ai.py#L148): Returned from a chat model as a response to a prompt

## Human Message Content

A human message may have different types in the `content` field:
- `str`
- `list[str | dict]`
- `None`

See: [human.py#L48](https://github.com/langchain-ai/langchain/blob/master/libs/core/langchain_core/messages/human.py#L48)

Helper function to parse human messages:
```python
from langchain_core.messages import HumanMessage

def get_human_message_content(message: HumanMessage) -> str:
    """Get the message content for a given human message."""
    human_message_content = ""

    if isinstance(message.content, str):
        # simple string
        human_message_content = message.content
    elif isinstance(message.content, list):
        # list of str
        human_message_content += " ".join(m for m in message.content if isinstance(m, str))
        # list of dict in the form {"type": "text", "text": "..."}
        human_message_content += " ".join(
            m["text"] for m in message.content if isinstance(m, dict) and m.get("type") == "text"
        )

    return human_message_content
```

Helper function to extract image URLs:
```python
def get_image_url_files(messages: list[HumanMessage]) -> list[str]:
    """Get the list of messages of type image_url."""
    return [
        m["image_url"]["url"] 
        for m in messages 
        if isinstance(m, HumanMessage) 
        and isinstance(m.content, dict) 
        and m.get("type") == "image_url"
    ]
```

## Building a Chat Interface

A simple chat interface can be built by:
1. Parsing incoming `HumanMessages`
2. Responding with an `AIMessage`

Note: The field `messages` in the `MessagesState` instance can contain the whole history (both `HumanMessages` AND `AIMessages`).

### Getting the Last Human Message

To get the last `HumanMessage`:
- Loop over `state["messages"]` in reverse using `state["messages"][::-1]`
- Filter on type using `if isinstance(m, HumanMessage)`
- Take the first element if any using `next(iterable, None)`

Example:
```python
last_human_message = next(
    (m for m in state["messages"][::-1] if isinstance(m, HumanMessage)), 
    None
)

if not last_human_message:
    raise ValueError("No human message in state")
```

## Complete Echo Application Example

```python
import logging
from typing import Any, Dict
from typing_extensions import TypedDict
from typing import Optional

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import MessagesState, StateGraph
from langgraph.runtime import Runtime

logger = logging.getLogger(__name__)

class Configuration(TypedDict):
    """An example configuration class for user controllable parameters."""
    custom_greeting: str = "Hello"

class State(MessagesState):
    """State for the chat agent."""

def get_human_message_content(message: HumanMessage) -> str:
    """Get the message content for a given human message."""
    human_message_content = ""

    if isinstance(message.content, str):
        human_message_content = message.content
    elif isinstance(message.content, list):
        human_message_content += " ".join(m for m in message.content if isinstance(m, str))
        human_message_content += " ".join(
            m["text"] for m in message.content 
            if isinstance(m, dict) and m.get("type") == "text"
        )

    return human_message_content

def chat(state: State, runtime: Runtime[Configuration]) -> Dict[str, Any]:
    """Convert user messages to a format suitable for processing."""
    logger.debug("Chat node called with state: %s", state)
    context = runtime.context or Configuration()

    # Get last human message
    last_human_message = next(
        (m for m in state["messages"][::-1] if isinstance(m, HumanMessage)), 
        None
    )
    if not last_human_message:
        raise ValueError("No human message in state")

    # Get last human message content
    human_message_content = get_human_message_content(last_human_message)

    greetings = context.get("custom_greeting") or "Hello"

    # Returns a MessagesState compatible dictionary containing an AIMessage
    return {
        "messages": [AIMessage(content=greetings + ". You said: " + human_message_content)],
    }

# Initialize
builder = StateGraph(State, input_schema=State, output_schema=State, context_schema=Configuration)

# Add nodes
builder.add_node("chat", chat)

# Add edges
builder.add_edge("__start__", "chat")
builder.add_edge("chat", "__end__")

# Compile
graph = builder.compile()
```
