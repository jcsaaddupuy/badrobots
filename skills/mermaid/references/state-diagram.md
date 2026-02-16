---
name: mermaid-er-diagram
description: Comprehensive guide for generating state diagrams using Mermaid syntax.
---

# Mermaid State Diagrams

## Basic Syntax

### Diagram Declaration
Use `stateDiagram-v2` for the modern renderer:
```mermaid
stateDiagram-v2
    [*] --> Still
    Still --> [*]
    Still --> Moving
    Moving --> Still
    Moving --> Crash
    Crash --> [*]
```

## States

### Simple State Declaration
```mermaid
stateDiagram-v2
    stateId
```

### State with Description
```mermaid
stateDiagram-v2
    state "This is a state description" as s2
```

Or using colon syntax:
```mermaid
stateDiagram-v2
    s2 : This is a state description
```

## Transitions

### Basic Transition
```mermaid
stateDiagram-v2
    s1 --> s2
```

### Transition with Label
```mermaid
stateDiagram-v2
    s1 --> s2: A transition
```

## Start and End States

Use `[*]` for start/end states:
```mermaid
stateDiagram-v2
    [*] --> s1
    s1 --> [*]
```

## Composite States

### Basic Composite State
```mermaid
stateDiagram-v2
    [*] --> First
    state First {
        [*] --> second
        second --> [*]
    }
```

### Named Composite State
```mermaid
stateDiagram-v2
    [*] --> NamedComposite
    NamedComposite: Another Composite
    state NamedComposite {
        [*] --> namedSimple
        namedSimple --> [*]
        namedSimple: Another simple
    }
```

### Nested Composite States
```mermaid
stateDiagram-v2
    [*] --> First
    state First {
        [*] --> Second
        state Second {
            [*] --> second
            second --> Third
            state Third {
                [*] --> third
                third --> [*]
            }
        }
    }
```

### Transitions Between Composite States
```mermaid
stateDiagram-v2
    [*] --> First
    First --> Second
    First --> Third
    
    state First {
        [*] --> fir
        fir --> [*]
    }
    state Second {
        [*] --> sec
        sec --> [*]
    }
    state Third {
        [*] --> thi
        thi --> [*]
    }
```

## Choice

Model conditional paths:
```mermaid
stateDiagram-v2
    state if_state <<choice>>
    [*] --> IsPositive
    IsPositive --> if_state
    if_state --> False: if n < 0
    if_state --> True : if n >= 0
```

## Forks and Joins

```mermaid
stateDiagram-v2
    state fork_state <<fork>>
    [*] --> fork_state
    fork_state --> State2
    fork_state --> State3
    
    state join_state <<join>>
    State2 --> join_state
    State3 --> join_state
    join_state --> State4
    State4 --> [*]
```

## Notes

### Right of State
```mermaid
stateDiagram-v2
    State1: The state with a note
    note right of State1
        Important information! You can write
        notes.
    end note
    State1 --> State2
```

### Left of State
```mermaid
stateDiagram-v2
    note left of State2 : This is the note to the left.
```

## Concurrency

Use `--` to show concurrent regions:
```mermaid
stateDiagram-v2
    [*] --> Active
    
    state Active {
        [*] --> NumLockOff
        NumLockOff --> NumLockOn : EvNumLockPressed
        NumLockOn --> NumLockOff : EvNumLockPressed
        --
        [*] --> CapsLockOff
        CapsLockOff --> CapsLockOn : EvCapsLockPressed
        CapsLockOn --> CapsLockOff : EvCapsLockPressed
        --
        [*] --> ScrollLockOff
        ScrollLockOff --> ScrollLockOn : EvScrollLockPressed
        ScrollLockOn --> ScrollLockOff : EvScrollLockPressed
    }
```

## Direction

Set diagram orientation:
```mermaid
stateDiagram
    direction LR
    [*] --> A
    A --> B
    B --> C
    state B {
        direction LR
        a --> b
    }
    B --> D
```

Options: `LR` (left-right), `RL` (right-left), `TB` (top-bottom), `BT` (bottom-top)

## Comments

```mermaid
stateDiagram-v2
    [*] --> Still
    Still --> [*]
    %% this is a comment
    Still --> Moving
    Moving --> Still %% another comment
```

## Styling with classDefs

### Define Styles
```mermaid
stateDiagram
    classDef notMoving fill:white
    classDef movement font-style:italic
    classDef badBadEvent fill:#f00,color:white,font-weight:bold,stroke-width:2px,stroke:yellow
```

### Apply Styles - Method 1: class Statement
```mermaid
stateDiagram
    classDef notMoving fill:white
    
    [*]--> Still
    Still --> Moving
    Moving --> Crash
    Crash --> [*]
    
    class Still notMoving
    class Moving, Crash movement
```

### Apply Styles - Method 2: ::: Operator
```mermaid
stateDiagram
    classDef notMoving fill:white
    
    [*] --> Still:::notMoving
    Still --> Moving:::movement
    Moving --> Crash:::movement
```

## Spaces in State Names

Use ID with description:
```mermaid
stateDiagram
    classDef yourState font-style:italic,font-weight:bold,fill:white
    
    yswsii: Your state with spaces in it
    [*] --> yswsii:::yourState
    yswsii --> YetAnotherState
    YetAnotherState --> [*]
```

## Best Practices

### Structure
- Use `stateDiagram-v2` for the modern renderer
- Use composite states to group related states
- Use meaningful state names and descriptions

### Visual Clarity
- Use notes to explain complex states
- Apply styling to highlight important states
- Use concurrency to show parallel processes

### Organization
- Group related states in composite states
- Use choice nodes for conditional logic
- Use fork/join for parallel execution paths

## Common Patterns

### Simple State Machine
```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Processing : start
    Processing --> Complete : success
    Processing --> Error : failure
    Complete --> [*]
    Error --> Idle : retry
```

### Nested States
```mermaid
stateDiagram-v2
    [*] --> Running
    
    state Running {
        [*] --> Active
        Active --> Paused : pause
        Paused --> Active : resume
        Active --> [*] : stop
    }
    
    Running --> [*]
```

### Choice Pattern
```mermaid
stateDiagram-v2
    [*] --> CheckInput
    
    state check <<choice>>
    CheckInput --> check
    check --> Valid : input valid
    check --> Invalid : input invalid
    
    Valid --> Process
    Invalid --> Error
    Process --> [*]
    Error --> [*]
```

### Concurrent States
```mermaid
stateDiagram-v2
    [*] --> System
    
    state System {
        [*] --> UI
        UI --> UI : user action
        --
        [*] --> Backend
        Backend --> Backend : process data
        --
        [*] --> Database
        Database --> Database : query
    }
```

### Error Handling
```mermaid
stateDiagram-v2
    classDef errorState fill:#f00,color:white
    
    [*] --> Initializing
    Initializing --> Ready : success
    Initializing --> Failed:::errorState : error
    Ready --> Processing
    Processing --> Complete : success
    Processing --> Failed:::errorState : error
    Failed --> Retry
    Retry --> Initializing : attempt
    Retry --> [*] : give up
    Complete --> [*]
```
