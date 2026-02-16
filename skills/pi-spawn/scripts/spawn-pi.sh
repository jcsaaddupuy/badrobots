#!/bin/bash
# Spawn pi sub-agent in tmux session

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
    # Escape single quotes in prompt
    ESCAPED_PROMPT="${PROMPT//\'/\'\\\'\'}"
    PI_CMD="$PI_CMD '$ESCAPED_PROMPT'"
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
tmux -S "$SOCKET" send-keys -t "pi-$SESSION_NAME":0.0 "$PI_CMD" Enter

# Wait a moment for pi to start
sleep 2

# Print monitoring instructions
cat << EOF
✓ Sub-agent spawned successfully!

To monitor this session:
  tmux -S "$SOCKET" attach -t pi-$SESSION_NAME

To capture output:
  scripts/capture-pi-output.sh -n $SESSION_NAME

To send additional prompts:
  scripts/send-to-pi-agent.sh -n $SESSION_NAME -p "Your prompt here"

To kill when done:
  scripts/kill-pi-agent.sh -n $SESSION_NAME

Session: pi-$SESSION_NAME
Socket: $SOCKET
EOF
