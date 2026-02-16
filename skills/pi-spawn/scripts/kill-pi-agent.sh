#!/bin/bash
# Kill pi sub-agent session(s)

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
