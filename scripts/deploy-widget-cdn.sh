#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

WIDGET_PACKAGE_JSON="$ROOT_DIR/apps/widget/package.json"
WIDGET_BUNDLE="$ROOT_DIR/apps/widget/dist/opencom-widget.iife.js"
LOADER_TEMPLATE="$ROOT_DIR/scripts/widget-loader.js"

BUCKET_NAME="${WIDGET_CDN_BUCKET:-opencom-static}"
CDN_BASE_URL="${WIDGET_CDN_BASE_URL:-https://cdn.opencom.dev}"
DRY_RUN="${DRY_RUN:-0}"

TMP_DIR="$(mktemp -d)"
MANIFEST_FILE="$TMP_DIR/manifest.json"
LOADER_FILE="$TMP_DIR/widget.js"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: Required command not found: $1"
    exit 1
  fi
}

require_env() {
  local var_name="$1"
  if [ -z "${!var_name:-}" ]; then
    echo "ERROR: Missing required environment variable: $var_name"
    exit 1
  fi
}

run_cmd() {
  echo "+ $*"
  if [ "$DRY_RUN" = "1" ]; then
    return 0
  fi
  "$@"
}

resolve_widget_deploy_version() {
  local package_version="$1"

  # Manual override for CI or ad-hoc releases.
  if [ -n "${WIDGET_DEPLOY_VERSION:-}" ]; then
    echo "$WIDGET_DEPLOY_VERSION"
    return 0
  fi

  # Release tags publish clean semver keys, e.g. widget-v0.2.0 -> 0.2.0
  if [ "${GITHUB_REF_TYPE:-}" = "tag" ] && [[ "${GITHUB_REF_NAME:-}" == widget-v* ]]; then
    echo "${GITHUB_REF_NAME#widget-v}"
    return 0
  fi

  # CI deploys use commit + run id so re-runs never overwrite immutable keys.
  if [ -n "${GITHUB_SHA:-}" ]; then
    local short_sha
    short_sha="$(printf '%s' "$GITHUB_SHA" | cut -c1-12)"
    if [ -n "${GITHUB_RUN_ID:-}" ]; then
      echo "${package_version}-${short_sha}-${GITHUB_RUN_ID}"
    else
      echo "${package_version}-${short_sha}"
    fi
    return 0
  fi

  # Local/manual deploys publish unique immutable keys per commit.
  if command -v git >/dev/null 2>&1; then
    local short_sha
    short_sha="$(git -C "$ROOT_DIR" rev-parse --short=12 HEAD 2>/dev/null || true)"
    if [ -n "$short_sha" ]; then
      echo "${package_version}-${short_sha}"
      return 0
    fi
  fi

  # Last-resort uniqueness in environments without git metadata.
  echo "${package_version}-$(date -u +%Y%m%d%H%M%S)"
}

sanitize_version_token() {
  local raw="$1"
  echo "$raw" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+//; s/-+$//'
}

echo "[opencom] widget CDN deploy"
echo "   Bucket: $BUCKET_NAME"
echo "   CDN URL: $CDN_BASE_URL"
if [ "$DRY_RUN" = "1" ]; then
  echo "   Mode: DRY_RUN (no uploads or cache purge)"
fi

require_command node
require_command pnpm
require_command curl

if [ ! -f "$WIDGET_PACKAGE_JSON" ]; then
  echo "ERROR: Missing widget package.json: $WIDGET_PACKAGE_JSON"
  exit 1
fi

if [ ! -f "$LOADER_TEMPLATE" ]; then
  echo "ERROR: Missing loader template: $LOADER_TEMPLATE"
  exit 1
fi

if [ "$DRY_RUN" != "1" ]; then
  require_env CLOUDFLARE_ACCOUNT_ID
  require_env CLOUDFLARE_API_TOKEN
  require_env CLOUDFLARE_ZONE_ID
fi

pnpm exec wrangler --version >/dev/null

WIDGET_PACKAGE_VERSION="$(node -p "require('$WIDGET_PACKAGE_JSON').version")"
if [ -z "$WIDGET_PACKAGE_VERSION" ]; then
  echo "ERROR: Failed to resolve widget version from $WIDGET_PACKAGE_JSON"
  exit 1
fi

WIDGET_VERSION_RAW="$(resolve_widget_deploy_version "$WIDGET_PACKAGE_VERSION")"
WIDGET_VERSION="$(sanitize_version_token "$WIDGET_VERSION_RAW")"
if [ -z "$WIDGET_VERSION" ]; then
  echo "ERROR: Failed to derive a valid widget deploy version from '$WIDGET_VERSION_RAW'"
  exit 1
fi

if [ "${GITHUB_REF_TYPE:-}" = "tag" ] && [[ "${GITHUB_REF_NAME:-}" == widget-v* ]]; then
  TAG_VERSION="${GITHUB_REF_NAME#widget-v}"
  if [ "$TAG_VERSION" != "$WIDGET_PACKAGE_VERSION" ]; then
    echo "WARNING: tag version ($TAG_VERSION) does not match apps/widget/package.json version ($WIDGET_PACKAGE_VERSION)"
  fi
fi

echo "Resolved widget package version: $WIDGET_PACKAGE_VERSION"
echo "Resolved widget deploy version:  $WIDGET_VERSION"
echo "Building widget bundle..."
pnpm --filter @opencom/widget build

if [ ! -f "$WIDGET_BUNDLE" ]; then
  echo "ERROR: Build output not found: $WIDGET_BUNDLE"
  exit 1
fi

printf '{\n  "latest": "%s"\n}\n' "$WIDGET_VERSION" > "$MANIFEST_FILE"
sed "s/__OPENCOM_WIDGET_FALLBACK_VERSION__/$WIDGET_VERSION/g" "$LOADER_TEMPLATE" > "$LOADER_FILE"

VERSIONED_KEY="v/$WIDGET_VERSION/widget.js"

echo "Uploading assets to R2..."
run_cmd pnpm exec wrangler r2 object put "$BUCKET_NAME/$VERSIONED_KEY" \
  --file "$WIDGET_BUNDLE" \
  --remote \
  --content-type "application/javascript; charset=utf-8" \
  --cache-control "public, max-age=31536000, immutable"

run_cmd pnpm exec wrangler r2 object put "$BUCKET_NAME/manifest.json" \
  --file "$MANIFEST_FILE" \
  --remote \
  --content-type "application/json; charset=utf-8" \
  --cache-control "public, max-age=60"

run_cmd pnpm exec wrangler r2 object put "$BUCKET_NAME/widget.js" \
  --file "$LOADER_FILE" \
  --remote \
  --content-type "application/javascript; charset=utf-8" \
  --cache-control "public, max-age=300"

if [ "$DRY_RUN" = "1" ]; then
  echo "Dry run complete."
  echo "   Would purge: $CDN_BASE_URL/widget.js"
  echo "   Would purge: $CDN_BASE_URL/manifest.json"
  exit 0
fi

echo "Purging Cloudflare cache for loader + manifest..."
PURGE_PAYLOAD="{\"files\":[\"$CDN_BASE_URL/widget.js\",\"$CDN_BASE_URL/manifest.json\"]}"
PURGE_RESPONSE="$(curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data "$PURGE_PAYLOAD")"

if ! echo "$PURGE_RESPONSE" | grep -Eq '"success"\s*:\s*true'; then
  echo "ERROR: Cloudflare cache purge failed"
  echo "$PURGE_RESPONSE"
  exit 1
fi

echo "Widget CDN deploy complete: $WIDGET_VERSION"
echo "   Stable loader: $CDN_BASE_URL/widget.js"
echo "   Runtime bundle: $CDN_BASE_URL/$VERSIONED_KEY"
