#!/usr/bin/env bash
# validate-overlay-targets.sh
#
# CI script: verifies all billing overlay target paths exist in the public repo.
# Runs on every PR without needing access to the private opencom-billing repo.
# Catches renames or restructuring that would break the hosted deployment.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Validating billing overlay targets in: $REPO_ROOT"
ERRORS=0

check_file() {
  local path="$1"
  if [[ -f "$REPO_ROOT/$path" ]]; then
    echo "  OK: $path"
  else
    echo "  MISSING: $path" >&2
    ERRORS=$((ERRORS + 1))
  fi
}

# billing-hooks/ no-op stubs (overlay replaces with real implementations)
check_file "packages/convex/convex/billing-hooks/onWorkspaceCreated.ts"
check_file "packages/convex/convex/billing-hooks/onEmailSent.ts"
check_file "packages/convex/convex/billing-hooks/onMemberChanged.ts"
check_file "packages/convex/convex/billing-hooks/onAgentMessage.ts"
check_file "packages/convex/convex/billing-hooks/onAiGeneration.ts"
check_file "packages/convex/convex/billing-hooks/getBillingStatus.ts"
check_file "packages/convex/convex/billing-hooks/httpRoutes.ts"

# schema.ts — overlay adds billing tables
check_file "packages/convex/convex/schema.ts"

# web billing components
check_file "apps/web/src/components/billing/BillingSettings.tsx"

if [[ "$ERRORS" -gt 0 ]]; then
  echo ""
  echo "ERROR: $ERRORS billing overlay target(s) missing." >&2
  echo "Ensure these stub files exist at the expected paths." >&2
  exit 1
fi

echo ""
echo "All billing overlay targets present."
