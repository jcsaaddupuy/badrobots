#!/bin/bash
# List all active pi sub-agent sessions

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
