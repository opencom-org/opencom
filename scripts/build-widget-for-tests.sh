#!/bin/bash
# Build widget and copy to consuming apps' public folders.
# Destinations: apps/web/public (admin app) and apps/landing/public (landing page).
# This is the interim solution until the widget is served from a single CDN URL.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
WIDGET_DIST="$ROOT_DIR/apps/widget/dist/opencom-widget.iife.js"

TARGETS=(
  "$ROOT_DIR/apps/web/public"
  "$ROOT_DIR/apps/landing/public"
)

echo "🔨 Building widget..."
cd "$ROOT_DIR/apps/widget"
pnpm build

if [ ! -f "$WIDGET_DIST" ]; then
  echo "❌ Build failed — $WIDGET_DIST not found"
  exit 1
fi

for target in "${TARGETS[@]}"; do
  mkdir -p "$target"
  cp "$WIDGET_DIST" "$target/"
  echo "📦 Copied to ${target#"$ROOT_DIR/"}/opencom-widget.iife.js"
done

echo "✅ Widget built and distributed to all targets"
