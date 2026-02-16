#!/bin/bash
# Send prompt to running pi sub-agent

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
