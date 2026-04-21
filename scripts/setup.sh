#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is required. Install Node.js 18+ and rerun ./scripts/setup.sh." >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Error: pnpm is required. Install PNPM 9+ and rerun ./scripts/setup.sh." >&2
  exit 1
fi

NODE_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
if [ "${NODE_MAJOR}" -lt 18 ]; then
  echo "Error: Node.js 18+ is required. Found $(node -v)." >&2
  exit 1
fi

exec node "$ROOT_DIR/scripts/local-convex-setup.js" "$@"
