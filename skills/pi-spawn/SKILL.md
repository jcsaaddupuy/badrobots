---
name: pi-spawn
description: "Spawn parallel pi sub-agents with different models/providers"
---

# Pi Spawn - Sub-Agent Management

## Core Concept
Spawn independent pi agent instances in tmux sessions with different models, providers, or configurations to handle specialized tasks in parallel or to leverage different model capabilities.

## When to Use This Skill

- **Parallel work**: Run multiple tasks simultaneously
- **Specialized models**: Use fast models for simple tasks, powerful models for complex ones
- **Cost optimization**: Cheap models for bulk work, expensive models for critical decisions
- **Model comparison**: Compare outputs from different models
- **Long-running tasks**: Start background work without blocking main session
- **Isolated contexts**: Separate concerns (e.g., one agent for code, one for docs)

## Quick Start

```bash
# Spawn a fast sub-agent for simple tasks
./scripts/spawn-pi.sh -n quick-worker -m "google/gemini-2.0-flash-exp" -p "Write unit tests"

# Spawn a powerful sub-agent for complex analysis
./scripts/spawn-pi.sh -n analyzer -m "anthropic/claude-opus-4" -p "Analyze architecture"

# Spawn with custom provider
./scripts/spawn-pi.sh -n aws-agent --provider amazon-bedrock -m "deepseek.v3-v1:0"

# List active sub-agents
./scripts/list-pi-agents.sh

# Monitor a sub-agent
tmux -S "$PI_TMUX_SOCKET_DIR/pi-quick-worker.sock" attach -t pi-quick-worker

# Capture output from sub-agent
./scripts/capture-pi-output.sh -n quick-worker

# Kill a sub-agent when done
./scripts/kill-pi-agent.sh -n quick-worker
```

## Sub-Agent Naming Convention

Use descriptive, slug-style names:
- ✅ `quick-worker`, `test-generator`, `code-reviewer`, `doc-writer`
- ✅ `claude-analyzer`, `gemini-fast`, `deepseek-cheap`
- ❌ Avoid spaces: `quick worker` (breaks tmux targeting)
- ❌ Avoid special chars: `test&gen`, `code@review`

## Model Selection Guide

### Fast & Cheap Models (Simple Tasks)
```bash
# Google Gemini Flash - Very fast, good for simple tasks
-m "google/gemini-2.0-flash-exp"

# AWS Nova Lite - Fast, cost-effective
--provider amazon-bedrock -m "amazon.nova-lite-v1:0"

# Claude Haiku - Fast, reliable
-m "anthropic/claude-3-5-haiku"
```

### Balanced Models (General Use)
```bash
# Google Gemini Pro - Good balance
-m "google/gemini-2.0-pro-exp"

# Claude Sonnet - Excellent balance
-m "anthropic/claude-3-7-sonnet"

# AWS Nova Pro
--provider amazon-bedrock -m "amazon.nova-pro-v1:0"
```

### Powerful Models (Complex Tasks)
```bash
# Claude Opus - Most capable
-m "anthropic/claude-opus-4"

# DeepSeek V3 - Powerful for reasoning
--provider amazon-bedrock -m "deepseek.v3-v1:0"

# AWS Nova Premier
--provider amazon-bedrock -m "amazon.nova-premier-v1:0"
```

### Specialized Models
```bash
# DeepSeek R1 - Deep reasoning with thinking
--provider amazon-bedrock -m "deepseek.r1-v1:0"

# Claude Opus with high thinking
-m "anthropic/claude-opus-4:xhigh"
```

## Common Use Case Patterns

### Pattern 1: Parallel Test Generation
```bash
# Main agent continues work while sub-agent generates tests
./scripts/spawn-pi.sh \
  -n test-gen \
  -m "google/gemini-2.0-flash-exp" \
  -p "Generate comprehensive unit tests for all modules in src/"

# Main agent continues with other work
# Check test generation progress later:
./scripts/capture-pi-output.sh -n test-gen
```

### Pattern 2: Code Review with Different Perspectives
```bash
# Fast review for basic issues
./scripts/spawn-pi.sh \
  -n quick-review \
  -m "google/gemini-2.0-flash-exp" \
  -p "Review code for syntax errors and basic issues in src/"

# Deep review for architecture
./scripts/spawn-pi.sh \
  -n deep-review \
  -m "anthropic/claude-opus-4" \
  -p "Review code architecture and suggest improvements in src/"

# Compare results
./scripts/capture-pi-output.sh -n quick-review
./scripts/capture-pi-output.sh -n deep-review
```

### Pattern 3: Documentation Generation
```bash
# Spawn cheap model for bulk documentation
./scripts/spawn-pi.sh \
  -n doc-writer \
  -m "google/gemini-2.0-flash-exp" \
  -p "Generate API documentation for all public functions"
```

### Pattern 4: Long-Running Analysis
```bash
# Start analysis that might take a while
./scripts/spawn-pi.sh \
  -n codebase-analysis \
  -m "anthropic/claude-3-7-sonnet" \
  -p "Analyze entire codebase and create architecture diagram"

# Do other work in main session
# Check back later
./scripts/capture-pi-output.sh -n codebase-analysis
```

### Pattern 5: Cost-Optimized Pipeline
```bash
# Use cheap model for simple tasks
./scripts/spawn-pi.sh \
  -n formatter \
  -m "google/gemini-2.0-flash-exp" \
  -p "Format all Python files with black"

# Use expensive model only for critical decisions
./scripts/spawn-pi.sh \
  -n architect \
  -m "anthropic/claude-opus-4" \
  -p "Design database schema for the new feature"
```

## Helper Scripts

All scripts should be created in `scripts/` directory:

### 1. spawn-pi.sh - Create Sub-Agent

```bash
#!/bin/bash
# scripts/spawn-pi.sh - Spawn pi sub-agent in tmux session

set -euo pipefail

# Default values
PROVIDER=""
MODEL="google/gemini-2.0-flash-exp"
SESSION_NAME=""
PROMPT=""
THINKING=""
TOOLS="read,bash,edit,write"
NO_SESSION=false
WORKING_DIR="$(pwd)"

# Help text
usage() {
    cat << 'EOF'
Spawn pi sub-agent in tmux session

Usage: spawn-pi.sh [options]

Options:
    -n, --name <name>       Session name (required, slug-style)
    -m, --model <pattern>   Model pattern (default: google/gemini-2.0-flash-exp)
    --provider <name>       Provider name (e.g., amazon-bedrock)
    -p, --prompt <text>     Initial prompt to send to agent
    -t, --thinking <level>  Thinking level (off, minimal, low, medium, high, xhigh)
    --tools <list>          Comma-separated tools (default: read,bash,edit,write)
    --no-session            Don't save session (ephemeral)
    -d, --dir <path>        Working directory (default: current)
    -h, --help              Show this help

Examples:
    # Fast worker with prompt
    spawn-pi.sh -n worker -m "google/gemini-2.0-flash-exp" -p "Generate tests"
    
    # Powerful analyzer with thinking
    spawn-pi.sh -n analyzer -m "anthropic/claude-opus-4" -t high -p "Analyze code"
    
    # AWS DeepSeek for reasoning
    spawn-pi.sh -n reasoner --provider amazon-bedrock -m "deepseek.r1-v1:0" -p "Design system"
EOF
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--name)
            SESSION_NAME="$2"
            shift 2
            ;;
        -m|--model)
            MODEL="$2"
            shift 2
            ;;
        --provider)
            PROVIDER="$2"
            shift 2
            ;;
        -p|--prompt)
            PROMPT="$2"
            shift 2
            ;;
        -t|--thinking)
            THINKING="$2"
            shift 2
            ;;
        --tools)
            TOOLS="$2"
            shift 2
            ;;
        --no-session)
            NO_SESSION=true
            shift
            ;;
        -d|--dir)
            WORKING_DIR="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage
            ;;
    esac
done

# Validate required args
if [[ -z "$SESSION_NAME" ]]; then
    echo "Error: Session name is required (-n)" >&2
    exit 1
fi

# Setup socket directory
SOCKET_DIR="${PI_TMUX_SOCKET_DIR:-${TMPDIR:-/tmp}/pi-tmux-sockets}"
mkdir -p "$SOCKET_DIR"
SOCKET="$SOCKET_DIR/pi-${SESSION_NAME}.sock"

# Check if session already exists
if tmux -S "$SOCKET" has-session -t "pi-$SESSION_NAME" 2>/dev/null; then
    echo "Error: Session 'pi-$SESSION_NAME' already exists" >&2
    echo "Kill it first with: scripts/kill-pi-agent.sh -n $SESSION_NAME" >&2
    exit 1
fi

# Build pi command
PI_CMD="cd '$WORKING_DIR' && pi"

if [[ -n "$PROVIDER" ]]; then
    PI_CMD="$PI_CMD --provider '$PROVIDER'"
fi

PI_CMD="$PI_CMD --model '$MODEL'"

if [[ -n "$THINKING" ]]; then
    PI_CMD="$PI_CMD --thinking $THINKING"
fi

if [[ "$NO_SESSION" == true ]]; then
    PI_CMD="$PI_CMD --no-session"
fi

PI_CMD="$PI_CMD --tools '$TOOLS'"

if [[ -n "$PROMPT" ]]; then
    PI_CMD="$PI_CMD '$PROMPT'"
fi

# Create tmux session
echo "Creating pi sub-agent session: pi-$SESSION_NAME"
echo "Model: $MODEL"
if [[ -n "$PROVIDER" ]]; then
    echo "Provider: $PROVIDER"
fi
echo "Socket: $SOCKET"
echo ""

tmux -S "$SOCKET" new -d -s "pi-$SESSION_NAME" -n agent

# Send pi command
tmux -S "$SOCKET" send-keys -t "pi-$SESSION_NAME":0.0 -l -- "$PI_CMD"
tmux -S "$SOCKET" send-keys -t "pi-$SESSION_NAME":0.0 Enter

# Wait a moment for pi to start
sleep 1

# Print monitoring instructions
cat << EOF
✓ Sub-agent spawned successfully!

To monitor this session:
  tmux -S "$SOCKET" attach -t pi-$SESSION_NAME

To capture output:
  scripts/capture-pi-output.sh -n $SESSION_NAME

To send additional prompts:
  tmux -S "$SOCKET" send-keys -t pi-$SESSION_NAME:0.0 -l "Your prompt here"
  tmux -S "$SOCKET" send-keys -t pi-$SESSION_NAME:0.0 Enter

To kill when done:
  scripts/kill-pi-agent.sh -n $SESSION_NAME

Session: pi-$SESSION_NAME
Socket: $SOCKET
EOF
```

### 2. capture-pi-output.sh - Get Sub-Agent Output

```bash
#!/bin/bash
# scripts/capture-pi-output.sh - Capture output from pi sub-agent

set -euo pipefail

SESSION_NAME=""
LINES=500

usage() {
    cat << 'EOF'
Capture output from pi sub-agent session

Usage: capture-pi-output.sh [options]

Options:
    -n, --name <name>    Session name (required)
    -l, --lines <num>    Number of lines to capture (default: 500)
    -h, --help           Show this help

Examples:
    capture-pi-output.sh -n worker
    capture-pi-output.sh -n analyzer -l 1000
EOF
    exit 0
}

while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--name)
            SESSION_NAME="$2"
            shift 2
            ;;
        -l|--lines)
            LINES="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage
            ;;
    esac
done

if [[ -z "$SESSION_NAME" ]]; then
    echo "Error: Session name is required (-n)" >&2
    exit 1
fi

SOCKET_DIR="${PI_TMUX_SOCKET_DIR:-${TMPDIR:-/tmp}/pi-tmux-sockets}"
SOCKET="$SOCKET_DIR/pi-${SESSION_NAME}.sock"

if ! tmux -S "$SOCKET" has-session -t "pi-$SESSION_NAME" 2>/dev/null; then
    echo "Error: Session 'pi-$SESSION_NAME' not found" >&2
    exit 1
fi

echo "=== Output from pi-$SESSION_NAME (last $LINES lines) ==="
tmux -S "$SOCKET" capture-pane -p -J -t "pi-$SESSION_NAME":0.0 -S "-$LINES"
```

### 3. list-pi-agents.sh - List Active Sub-Agents

```bash
#!/bin/bash
# scripts/list-pi-agents.sh - List all active pi sub-agent sessions

set -euo pipefail

SOCKET_DIR="${PI_TMUX_SOCKET_DIR:-${TMPDIR:-/tmp}/pi-tmux-sockets}"

if [[ ! -d "$SOCKET_DIR" ]]; then
    echo "No pi sub-agents found (socket directory doesn't exist)"
    exit 0
fi

echo "Active pi sub-agent sessions:"
echo ""

found=0
for socket in "$SOCKET_DIR"/pi-*.sock; do
    if [[ -e "$socket" ]]; then
        session_name=$(basename "$socket" .sock | sed 's/^pi-//')
        
        if tmux -S "$socket" has-session -t "pi-$session_name" 2>/dev/null; then
            found=1
            echo "  • $session_name"
            echo "    Socket: $socket"
            echo "    Attach: tmux -S \"$socket\" attach -t pi-$session_name"
            echo "    Capture: scripts/capture-pi-output.sh -n $session_name"
            echo ""
        fi
    fi
done

if [[ $found -eq 0 ]]; then
    echo "  (none)"
fi
```

### 4. kill-pi-agent.sh - Terminate Sub-Agent

```bash
#!/bin/bash
# scripts/kill-pi-agent.sh - Kill pi sub-agent session

set -euo pipefail

SESSION_NAME=""
ALL=false

usage() {
    cat << 'EOF'
Kill pi sub-agent session(s)

Usage: kill-pi-agent.sh [options]

Options:
    -n, --name <name>    Session name to kill
    -a, --all            Kill all pi sub-agent sessions
    -h, --help           Show this help

Examples:
    kill-pi-agent.sh -n worker
    kill-pi-agent.sh --all
EOF
    exit 0
}

while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--name)
            SESSION_NAME="$2"
            shift 2
            ;;
        -a|--all)
            ALL=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage
            ;;
    esac
done

SOCKET_DIR="${PI_TMUX_SOCKET_DIR:-${TMPDIR:-/tmp}/pi-tmux-sockets}"

if [[ "$ALL" == true ]]; then
    echo "Killing all pi sub-agent sessions..."
    count=0
    for socket in "$SOCKET_DIR"/pi-*.sock; do
        if [[ -e "$socket" ]]; then
            session_name=$(basename "$socket" .sock | sed 's/^pi-//')
            if tmux -S "$socket" has-session -t "pi-$session_name" 2>/dev/null; then
                tmux -S "$socket" kill-session -t "pi-$session_name"
                rm -f "$socket"
                echo "  ✓ Killed pi-$session_name"
                ((count++))
            fi
        fi
    done
    echo "Killed $count session(s)"
elif [[ -n "$SESSION_NAME" ]]; then
    SOCKET="$SOCKET_DIR/pi-${SESSION_NAME}.sock"
    
    if ! tmux -S "$SOCKET" has-session -t "pi-$SESSION_NAME" 2>/dev/null; then
        echo "Warning: Session 'pi-$SESSION_NAME' not found" >&2
        exit 0
    fi
    
    tmux -S "$SOCKET" kill-session -t "pi-$SESSION_NAME"
    rm -f "$SOCKET"
    echo "✓ Killed pi-$SESSION_NAME"
else
    echo "Error: Either -n <name> or --all is required" >&2
    usage
fi
```

### 5. send-to-pi-agent.sh - Send Prompt to Running Agent

```bash
#!/bin/bash
# scripts/send-to-pi-agent.sh - Send prompt to running pi sub-agent

set -euo pipefail

SESSION_NAME=""
PROMPT=""

usage() {
    cat << 'EOF'
Send prompt to running pi sub-agent

Usage: send-to-pi-agent.sh [options]

Options:
    -n, --name <name>     Session name (required)
    -p, --prompt <text>   Prompt to send (required)
    -h, --help            Show this help

Examples:
    send-to-pi-agent.sh -n worker -p "Generate more tests"
    send-to-pi-agent.sh -n analyzer -p "What's the status?"
EOF
    exit 0
}

while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--name)
            SESSION_NAME="$2"
            shift 2
            ;;
        -p|--prompt)
            PROMPT="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage
            ;;
    esac
done

if [[ -z "$SESSION_NAME" ]] || [[ -z "$PROMPT" ]]; then
    echo "Error: Both session name and prompt are required" >&2
    usage
fi

SOCKET_DIR="${PI_TMUX_SOCKET_DIR:-${TMPDIR:-/tmp}/pi-tmux-sockets}"
SOCKET="$SOCKET_DIR/pi-${SESSION_NAME}.sock"

if ! tmux -S "$SOCKET" has-session -t "pi-$SESSION_NAME" 2>/dev/null; then
    echo "Error: Session 'pi-$SESSION_NAME' not found" >&2
    exit 1
fi

echo "Sending prompt to pi-$SESSION_NAME..."
tmux -S "$SOCKET" send-keys -t "pi-$SESSION_NAME":0.0 -l -- "$PROMPT"
tmux -S "$SOCKET" send-keys -t "pi-$SESSION_NAME":0.0 Enter
echo "✓ Prompt sent"
```

## Agent Workflow

### Starting a Sub-Agent

```
1. Determine task requirements
   ├─ Is it simple/repetitive? → Use fast model
   ├─ Is it complex/critical? → Use powerful model
   └─ Is it specialized? → Use specialized model
   ↓
2. Choose appropriate model from guide above
   ↓
3. Create helper script if not exists
   └─ chmod +x scripts/spawn-pi.sh
   ↓
4. Spawn sub-agent with descriptive name
   └─ ./scripts/spawn-pi.sh -n task-name -m model -p "prompt"
   ↓
5. Tell user how to monitor
   └─ Print tmux attach command and capture script
```

### Managing Multiple Sub-Agents

```bash
# Start multiple agents for different tasks
./scripts/spawn-pi.sh -n test-gen -m "google/gemini-2.0-flash-exp" -p "Generate tests"
./scripts/spawn-pi.sh -n doc-gen -m "google/gemini-2.0-flash-exp" -p "Generate docs"
./scripts/spawn-pi.sh -n review -m "anthropic/claude-3-7-sonnet" -p "Review code"

# List all active agents
./scripts/list-pi-agents.sh

# Check progress on each
./scripts/capture-pi-output.sh -n test-gen | tail -50
./scripts/capture-pi-output.sh -n doc-gen | tail -50
./scripts/capture-pi-output.sh -n review | tail -50

# Send follow-up prompts if needed
./scripts/send-to-pi-agent.sh -n test-gen -p "Also add integration tests"

# Clean up when done
./scripts/kill-pi-agent.sh -n test-gen
./scripts/kill-pi-agent.sh -n doc-gen
./scripts/kill-pi-agent.sh -n review
# Or kill all at once
./scripts/kill-pi-agent.sh --all
```

## Best Practices

1. **Descriptive Names**: Use names that describe the task, not the model
   - ✅ `test-generator`, `code-reviewer`, `doc-writer`
   - ❌ `gemini1`, `agent2`, `temp`

2. **Monitor Progress**: Periodically check sub-agent output
   ```bash
   watch -n 30 "./scripts/capture-pi-output.sh -n worker | tail -20"
   ```

3. **Resource Management**: Don't spawn too many expensive models simultaneously
   - Max 2-3 expensive models (Opus, etc.)
   - Unlimited cheap models (Flash, Haiku)

4. **Clean Up**: Always kill agents when done to free resources
   ```bash
   ./scripts/kill-pi-agent.sh --all
   ```

5. **Session Persistence**: Use `--no-session` for throwaway work to avoid cluttering session history

6. **Working Directory**: Set `-d` to correct directory for context
   ```bash
   ./scripts/spawn-pi.sh -n worker -d /path/to/project -p "..."
   ```

## Common Patterns

### Pattern: Bulk Operations
```bash
# Generate tests for all modules using cheap model
for module in src/*.py; do
    name=$(basename "$module" .py)
    ./scripts/spawn-pi.sh \
        -n "test-$name" \
        -m "google/gemini-2.0-flash-exp" \
        -p "Generate unit tests for $module"
done

# Wait a bit, then collect results
sleep 60
for module in src/*.py; do
    name=$(basename "$module" .py)
    ./scripts/capture-pi-output.sh -n "test-$name" > "tests/test_$name.py"
    ./scripts/kill-pi-agent.sh -n "test-$name"
done
```

### Pattern: Progressive Enhancement
```bash
# First pass with fast model
./scripts/spawn-pi.sh \
    -n first-pass \
    -m "google/gemini-2.0-flash-exp" \
    -p "Write basic implementation of feature X"

# Wait for completion
sleep 120

# Second pass with powerful model for refinement
./scripts/capture-pi-output.sh -n first-pass > /tmp/first-pass.txt
./scripts/kill-pi-agent.sh -n first-pass

./scripts/spawn-pi.sh \
    -n refinement \
    -m "anthropic/claude-opus-4" \
    -p "Review and improve this implementation: $(cat /tmp/first-pass.txt)"
```

### Pattern: Parallel Review
```bash
# Multiple reviewers for comprehensive feedback
./scripts/spawn-pi.sh -n security-review -m "anthropic/claude-3-7-sonnet" \
    -p "Review code for security issues"

./scripts/spawn-pi.sh -n performance-review -m "anthropic/claude-3-7-sonnet" \
    -p "Review code for performance issues"

./scripts/spawn-pi.sh -n style-review -m "google/gemini-2.0-flash-exp" \
    -p "Review code for style and readability"

# Collect all reviews
./scripts/list-pi-agents.sh
```

## Integration with Other Skills

- **Use tmux skill** for advanced session management
- **Use general skill** for task decomposition before spawning
- **Use commit skill** to commit work done by sub-agents
- **Use glab skill** if sub-agents need GitLab access

## Troubleshooting

### Sub-agent not responding
```bash
# Check if session exists
./scripts/list-pi-agents.sh

# Attach to see what's happening
tmux -S "$SOCKET" attach -t pi-<name>

# Check recent output
./scripts/capture-pi-output.sh -n <name> | tail -50
```

### Too many sub-agents
```bash
# List all
./scripts/list-pi-agents.sh

# Kill all
./scripts/kill-pi-agent.sh --all
```

### Socket permission issues
```bash
# Check socket directory
ls -la "${PI_TMUX_SOCKET_DIR:-${TMPDIR:-/tmp}/pi-tmux-sockets}"

# Fix permissions if needed
chmod 700 "${PI_TMUX_SOCKET_DIR:-${TMPDIR:-/tmp}/pi-tmux-sockets}"
```

## Quick Reference

| Task | Command |
|------|---------|
| Spawn agent | `./scripts/spawn-pi.sh -n name -m model -p "prompt"` |
| List agents | `./scripts/list-pi-agents.sh` |
| Monitor agent | `tmux -S $SOCKET attach -t pi-name` |
| Capture output | `./scripts/capture-pi-output.sh -n name` |
| Send prompt | `./scripts/send-to-pi-agent.sh -n name -p "prompt"` |
| Kill agent | `./scripts/kill-pi-agent.sh -n name` |
| Kill all | `./scripts/kill-pi-agent.sh --all` |

## Example: Complete Workflow

```bash
# User: "Generate tests for all modules using a sub-agent"

# 1. Create spawn script if not exists
cat > scripts/spawn-pi.sh << 'EOF'
[... script content ...]
EOF
chmod +x scripts/spawn-pi.sh

# 2. Spawn sub-agent for test generation
./scripts/spawn-pi.sh \
    -n test-generator \
    -m "google/gemini-2.0-flash-exp" \
    -p "Generate comprehensive unit tests for all modules in src/ directory"

# 3. Tell user how to monitor
echo "Sub-agent spawned! Monitor with:"
echo "  tmux -S \"\$PI_TMUX_SOCKET_DIR/pi-test-generator.sock\" attach -t pi-test-generator"
echo "Or capture output:"
echo "  ./scripts/capture-pi-output.sh -n test-generator"

# 4. Continue with other work in main session
# User can check progress periodically

# 5. When done, capture results
./scripts/capture-pi-output.sh -n test-generator > test-results.txt

# 6. Clean up
./scripts/kill-pi-agent.sh -n test-generator
```
