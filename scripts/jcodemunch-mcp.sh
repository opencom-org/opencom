#!/usr/bin/env bash
set -euo pipefail
export JCODEMUNCH_SHARE_SAVINGS="${JCODEMUNCH_SHARE_SAVINGS:-0}"
exec /Users/jack/.local/bin/jcodemunch-mcp "$@"
