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

NODE_VERSION="$(node -v)"
NODE_MAJOR="$(printf '%s\n' "$NODE_VERSION" | sed 's/^v//' | cut -d. -f1)"
if ! [[ "$NODE_MAJOR" =~ ^[0-9]+$ ]] || [ "${NODE_MAJOR}" -lt 18 ]; then
  echo "Error: Node.js 18+ is required. Found ${NODE_VERSION:-unknown}." >&2
  exit 1
fi

PNPM_VERSION="$(pnpm -v)"
PNPM_MAJOR="${PNPM_VERSION%%.*}"
if ! [[ "$PNPM_MAJOR" =~ ^[0-9]+$ ]] || [ "${PNPM_MAJOR}" -lt 9 ]; then
  echo "Error: PNPM 9+ is required. Found ${PNPM_VERSION:-unknown}. Install PNPM 9+ and rerun ./scripts/setup.sh." >&2
  exit 1
fi

exec node "$ROOT_DIR/scripts/local-convex-setup.js" "$@"
