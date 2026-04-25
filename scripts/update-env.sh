#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is required. Install Node.js 18+ and rerun ./scripts/update-env.sh." >&2
  exit 1
fi

NODE_VERSION="$(node -v)"
NODE_MAJOR="$(printf '%s\n' "$NODE_VERSION" | sed 's/^v//' | cut -d. -f1)"
if ! [[ "$NODE_MAJOR" =~ ^[0-9]+$ ]] || [ "${NODE_MAJOR}" -lt 18 ]; then
  echo "Error: Node.js 18+ is required. Found ${NODE_VERSION:-unknown}. Install Node.js 18+ and rerun ./scripts/update-env.sh." >&2
  exit 1
fi

exec node "$ROOT_DIR/scripts/update-local-env.js" "$@"
