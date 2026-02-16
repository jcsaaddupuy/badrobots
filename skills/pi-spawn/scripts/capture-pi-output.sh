#!/bin/bash
# Capture output from pi sub-agent session

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
