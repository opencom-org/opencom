# Refactor Progress: Web E2E Stabilization (2026-03-06)

## Slice

- `stabilize-web-e2e-auth-and-widget-flows` (release-readiness stabilization)

## Why

The refactor branch had reached a point where the remaining release risk was mostly in the web E2E harness and a few stale UI expectations rather than in the refactored runtime surfaces themselves.
The last inspected full Playwright run had broad auth/route-recovery failures plus a smaller set of genuine spec/product mismatches in inbox and widget flows.

## What Changed In This Pass

1. Hardened shared auth refresh and route recovery:
   - `apps/web/e2e/helpers/auth-refresh.ts`
   - Improved backend seeding, auth probing, route recovery, and auth-state persistence.
2. Prevented widget visitor/session leakage from polluting worker auth storage:
   - `apps/web/e2e/fixtures.ts`
   - `apps/web/e2e/helpers/storage-state.ts`
   - Sanitized volatile widget storage keys before persisting worker auth state.
3. Updated stale E2E expectations to match current UI behavior:
   - `apps/web/e2e/ai-agent-settings.spec.ts`
   - `apps/web/e2e/home-settings.spec.ts`
   - `apps/web/e2e/carousels.spec.ts`
   - `apps/web/e2e/knowledge.spec.ts`
   - `apps/web/e2e/outbound.spec.ts`
   - `apps/web/e2e/reports.spec.ts`
   - `apps/web/e2e/tooltips.spec.ts`
   - `apps/web/e2e/auth.spec.ts`
4. Fixed inbox stability issues:
   - `apps/web/e2e/inbox.spec.ts`
   - Updated suggestions-sidecar expectations and hardened ticket-conversion navigation.
5. Fixed widget stability issues:
   - `apps/web/e2e/helpers/widget-helpers.ts`
   - `apps/web/e2e/widget-features.spec.ts`
   - `apps/web/e2e/widget.spec.ts`
   - Stabilized tour dismissal/return behavior and broader widget interaction flows.

## Verification Run Notes

Executed in this pass:

- `pnpm --filter @opencom/web typecheck` -> pass
- `pnpm web:test:e2e -- apps/web/e2e/inbox.spec.ts apps/web/e2e/widget-features.spec.ts --project=chromium` -> pass (`26` passed, `6` skipped, `0` flaky)
- `pnpm web:test:e2e` -> pass (`193` passed, `7` skipped, `0` flaky)

## Notes

- This pass changed only web E2E harness/spec code; it did not change production runtime logic outside the test surface.
- The branch is back at a clean web release bar from the perspective of typecheck plus full Playwright coverage.
