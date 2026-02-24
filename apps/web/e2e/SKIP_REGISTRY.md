# Playwright Skip Registry

This file tracks intentional/known skips so we can separate:

- `regressions` (unexpected failures)
- `known incomplete/conditional coverage` (expected skips)

## Baseline (full suite)

- Date: 2026-02-20
- Command: `pnpm playwright test apps/web/e2e --reporter=list`
- Result: `189 passed`, `5 skipped`, `0 failed`

## Expected Runtime Skips (current baseline = 5)

All 5 are in `apps/web/e2e/widget-features.spec.ts` and are currently conditional on seeded UI state visibility:

1. `Widget E2E Tests - Surveys › NPS question allows 0-10 scale interaction`
   Reason: `Survey not visible – cannot test NPS interaction`
2. `Widget E2E Tests - Surveys › survey completion shows thank you step`
   Reason: `Survey not visible – cannot test completion flow`
3. `Widget E2E Tests - Surveys › survey can be dismissed`
   Reason: `Survey not visible – cannot test dismissal`
4. `Widget E2E Tests - AI Agent › Talk to human button triggers handoff`
   Reason: `Handoff button not visible – AI agent may not have responded yet`
5. `Widget E2E Tests - AI Agent › feedback buttons work (helpful/not helpful)`
   Reason: `Feedback buttons not visible – AI agent may not have responded`

## Other Conditional Skip Guards In Suite

These are guardrails that may skip depending on environment/auth/data state:

- `TEST_ADMIN_SECRET` prerequisites:
  - `apps/web/e2e/public-pages.spec.ts`
  - `apps/web/e2e/widget-outbound-and-tour-recovery.spec.ts`
- Auth bootstrap guard (`Could not authenticate test page`) in:
  - `apps/web/e2e/audit-logs.spec.ts`
  - `apps/web/e2e/home-settings.spec.ts`
  - `apps/web/e2e/knowledge.spec.ts`
  - `apps/web/e2e/segments.spec.ts`
  - `apps/web/e2e/settings.spec.ts`
  - `apps/web/e2e/snippets.spec.ts`
  - `apps/web/e2e/widget-features.spec.ts`
- Feature/route availability guards:
  - `apps/web/e2e/knowledge.spec.ts`
  - `apps/web/e2e/segments.spec.ts`
  - `apps/web/e2e/home-settings.spec.ts` (`Messenger Home section not visible after retry`)

## Regression Rule

- Until these tests are made deterministic, skip count should remain `5` in a healthy full run.
- Any new skip outside this registry should be treated as a regression signal.
