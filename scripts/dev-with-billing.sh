#!/usr/bin/env bash
# dev-with-billing.sh
#
# Runs the local dev environment with the private billing overlay applied.
# Automatically restores the public stubs when you exit (Ctrl+C or error).
#
# Usage:
#   bash scripts/dev-with-billing.sh
#
# Prerequisites:
#   - The opencom-billing private repo must be cloned alongside this repo:
#       ../opencom-billing   (default)
#     Or set BILLING_REPO=/path/to/opencom-billing to point anywhere.
#
#   - Stripe environment variables must be set in packages/convex/.env.local:
#       STRIPE_SECRET_KEY=sk_test_...
#       STRIPE_WEBHOOK_SECRET=whsec_...
#       STRIPE_RESTRICTED_ACCESS_KEY=rk_test_...
#       STRIPE_STARTER_PRICE_USD=price_...
#       STRIPE_STARTER_PRICE_GBP=price_...
#       STRIPE_PRO_PRICE_USD=price_...
#       STRIPE_PRO_PRICE_GBP=price_...
#       STRIPE_EMAIL_METERED_PRICE=price_...  (optional)
#       STRIPE_SEAT_METERED_PRICE=price_...   (optional)
#
#   - For webhook testing, run the Stripe CLI listener in a separate terminal:
#       stripe listen --forward-to https://<your-convex-dev-site>/api/stripe/webhook
#     The Stripe CLI will print a STRIPE_WEBHOOK_SECRET to use above.
#
# What this script does:
#   1. Validates the billing repo is present and overlay targets exist
#   2. Creates a git stash of any current working tree changes (non-destructive)
#   3. Applies the billing overlay (copies private Stripe code into place)
#   4. Runs `pnpm dev` (all apps in parallel)
#   5. On exit: restores all overlayed files to their public stubs via git checkout

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BILLING_REPO="${BILLING_REPO:-$(cd "$REPO_ROOT/../opencom-billing" 2>/dev/null && pwd || echo "")}"

# ============================================================
# Overlay target paths — keep in sync with opencom-billing/scripts/validate-overlay.sh
# ============================================================
OVERLAY_TARGETS=(
  "packages/convex/convex/billing-hooks/onWorkspaceCreated.ts"
  "packages/convex/convex/billing-hooks/onEmailSent.ts"
  "packages/convex/convex/billing-hooks/onMemberChanged.ts"
  "packages/convex/convex/billing-hooks/onAgentMessage.ts"
  "packages/convex/convex/billing-hooks/onAiGeneration.ts"
  "packages/convex/convex/billing-hooks/getBillingStatus.ts"
  "packages/convex/convex/billing-hooks/httpRoutes.ts"
  "packages/convex/convex/schema.ts"
  "apps/web/src/components/billing/BillingSettings.tsx"
)

# ============================================================
# Cleanup: restore all overlay targets to their public stubs
# ============================================================
cleanup() {
  echo ""
  echo "Restoring public stubs..."
  cd "$REPO_ROOT"
  git checkout -- "${OVERLAY_TARGETS[@]}" 2>/dev/null && \
    echo "Public stubs restored." || \
    echo "Warning: some stubs could not be restored — run: git checkout -- ${OVERLAY_TARGETS[*]}"
}
trap cleanup EXIT INT TERM

# ============================================================
# Preflight checks
# ============================================================
if [[ -z "$BILLING_REPO" || ! -d "$BILLING_REPO" ]]; then
  echo "Error: opencom-billing repo not found."
  echo ""
  echo "Clone it alongside this repo:"
  echo "  git clone git@github.com:your-org/opencom-billing.git ../opencom-billing"
  echo ""
  echo "Or set BILLING_REPO=/path/to/opencom-billing"
  exit 1
fi

echo "Using billing repo: $BILLING_REPO"

# Validate overlay targets exist (catches renames/restructuring)
OPENCOM_REPO="$REPO_ROOT" bash "$BILLING_REPO/scripts/validate-overlay.sh" || {
  echo ""
  echo "Error: overlay target validation failed. See above for missing files."
  exit 1
}

# Check for required Stripe env vars
MISSING_VARS=0
for var in STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET; do
  if ! grep -q "^${var}=" "$REPO_ROOT/packages/convex/.env.local" 2>/dev/null; then
    echo "Warning: $var not found in packages/convex/.env.local"
    MISSING_VARS=$((MISSING_VARS + 1))
  fi
done

if [[ "$MISSING_VARS" -gt 0 ]]; then
  echo ""
  echo "Stripe env vars are missing. The app will run but billing features will not work."
  echo "Add them to packages/convex/.env.local — see scripts/dev-with-billing.sh for the full list."
  echo ""
  read -r -p "Continue anyway? [y/N] " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    exit 0
  fi
fi

# ============================================================
# Apply overlay
# ============================================================
echo ""
echo "Applying billing overlay..."
OPENCOM_REPO="$REPO_ROOT" bash "$BILLING_REPO/scripts/overlay.sh"
echo ""

# ============================================================
# Start dev environment
# (Ctrl+C triggers cleanup via the trap above)
# ============================================================
echo "Starting dev environment with billing overlay active..."
echo "Press Ctrl+C to stop and restore public stubs."
echo ""
cd "$REPO_ROOT"
pnpm dev
