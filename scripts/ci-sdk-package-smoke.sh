#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARBALL_DIR="$(mktemp -d)"
SMOKE_APP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TARBALL_DIR" "$SMOKE_APP_DIR"
}
trap cleanup EXIT

echo "[release:packages:smoke] packing SDK packages"
cd "$ROOT_DIR"
pnpm -C packages/convex pack --pack-destination "$TARBALL_DIR" >/dev/null
pnpm -C packages/sdk-core pack --pack-destination "$TARBALL_DIR" >/dev/null
pnpm -C packages/react-native-sdk pack --pack-destination "$TARBALL_DIR" >/dev/null

CONVEX_TARBALL="$(ls "$TARBALL_DIR"/opencom-convex-*.tgz | head -n 1)"
SDK_CORE_TARBALL="$(ls "$TARBALL_DIR"/opencom-sdk-core-*.tgz | head -n 1)"
RN_SDK_TARBALL="$(ls "$TARBALL_DIR"/opencom-react-native-sdk-*.tgz | head -n 1)"

echo "[release:packages:smoke] installing into a clean temp app"
cd "$SMOKE_APP_DIR"
cat > package.json <<JSON
{
  "name": "opencom-sdk-smoke",
  "version": "0.0.0",
  "private": true,
  "pnpm": {
    "overrides": {
      "@opencom/convex": "file:$CONVEX_TARBALL",
      "@opencom/sdk-core": "file:$SDK_CORE_TARBALL"
    }
  },
  "dependencies": {
    "@opencom/react-native-sdk": "file:$RN_SDK_TARBALL"
  }
}
JSON

pnpm install --frozen-lockfile=false --ignore-scripts

test -f node_modules/@opencom/react-native-sdk/package.json

SDK_CORE_PKG_PATH="$(find node_modules -type f -path "*/@opencom/sdk-core/package.json" | head -n 1 || true)"
CONVEX_API_PATH="$(find node_modules -type f -path "*/@opencom/convex/convex/_generated/api.js" | head -n 1 || true)"

test -n "$SDK_CORE_PKG_PATH"
test -n "$CONVEX_API_PATH"
echo "[release:packages:smoke] success"
