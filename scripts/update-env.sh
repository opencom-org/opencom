#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is required. Install Node.js 18+ and rerun ./scripts/update-env.sh." >&2
  exit 1
fi

exec node "$ROOT_DIR/scripts/update-local-env.js" "$@"
