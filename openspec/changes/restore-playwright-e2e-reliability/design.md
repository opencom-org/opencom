## Context

Recent Playwright artifacts show that the repo still generates an HTML report, but the last run left minimal `test-results` output and widget/admin suites were able to short-circuit through runtime `test.skip(...)` guards when shared auth/bootstrap recovery did not produce a usable authenticated page. The current E2E harness uses worker-scoped provisioning in `apps/web/e2e/fixtures.ts`, shared auth recovery in `apps/web/e2e/helpers/auth-refresh.ts`, and widget/admin suites that assume authenticated page state plus an active workspace in local storage.

This creates two reliability problems:

1. Shared auth recovery can report success before the page has recovered the active workspace needed by protected routes and widget demo flows.
2. Some suites convert that shared setup failure into a skip, which hides the underlying issue and makes it appear that widget coverage is optional rather than broken.

## Goals / Non-Goals

### Goals

- Make authenticated Playwright suites depend on a stronger shared readiness contract that includes active workspace recovery.
- Ensure widget E2E and other protected suites run or fail explicitly instead of silently skipping because shared auth/bootstrap broke.
- Preserve legitimate skips only for declared external prerequisites such as missing admin-seeding secrets.
- Provide verification steps that show widget and related Playwright suites actually execute under the standard PNPM/Playwright workflow.

### Non-Goals

- Redesign product auth or onboarding flows outside what is needed for Playwright reliability.
- Eliminate all conditional skips, including those tied to explicit unsupported environments or missing required secrets.
- Expand Playwright coverage into new product areas unrelated to the shared auth/bootstrap failure mode.

## Proposed Technical Direction

### 1. Strengthen shared auth readiness

`ensureAuthenticatedInPage(...)` and related auth-recovery paths should only report success after the page is not on an auth route, is not stuck on an error/loading shell, and has restored active workspace state in local storage. This aligns the shared helper with what widget/admin routes actually require.

### 2. Stop masking shared setup failures as skips

Protected suites that rely on repo-managed worker provisioning should assert shared auth readiness in `beforeEach` instead of calling `test.skip(...)` when recovery unexpectedly fails. That preserves signal: if setup regresses, the suite fails with an actionable error rather than disappearing from coverage.

### 3. Keep explicit prerequisite skips narrow

Suites that require declared external prerequisites such as `TEST_ADMIN_SECRET` for test-data mutation may continue to skip when that prerequisite is absent. Those skips are intentional and should remain distinguishable from recoverable auth/bootstrap failures.

### 4. Verify execution, not just report generation

Targeted Playwright runs should confirm that widget suites enter execution and produce pass/fail outcomes rather than skipped outcomes attributable to auth/bootstrap. Verification should also include at least one additional formerly auth-skipping admin suite to prove the fix applies broadly.

## Risks and Tradeoffs

- Tightening the readiness contract may convert previously skipped suites into explicit failures, temporarily making CI look worse until all underlying issues are resolved.
- Waiting for active workspace storage can add a small amount of latency to each auth recovery path.
- If some routes legitimately do not populate active workspace state, the helper could become too strict; verification must confirm the assumption holds across protected suites.

## Verification Strategy

- Run focused Playwright widget coverage with `pnpm playwright test apps/web/e2e/widget.spec.ts apps/web/e2e/widget-features.spec.ts --project=chromium`.
- Run at least one additional previously auth-skipping suite such as `pnpm playwright test apps/web/e2e/knowledge.spec.ts --project=chromium`.
- Inspect `test-results/` and `playwright-report/` after the targeted runs to confirm suites executed and to identify any remaining genuine product failures.
