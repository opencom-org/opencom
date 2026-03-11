## Why

Widget survey E2E coverage is currently unreliable: immediate surveys and related CSAT flows sometimes never render even after test data seeding succeeds, producing flaky Playwright outcomes that hide whether regressions are caused by product behavior, bootstrap timing, or test harness assumptions. The current failures block confidence in widget feedback experiences and make it expensive to separate legitimate regressions from non-deterministic execution.

## What Changes

- Stabilize widget survey and CSAT Playwright coverage by making survey eligibility, visitor/session bootstrap, and widget demo execution deterministic under the repo E2E workflow.
- Eliminate or narrow race conditions that cause seeded immediate surveys or CSAT experiences to fail to render, favoring explicit readiness contracts over long visibility waits.
- Strengthen widget survey/CSAT E2E helpers and fixtures so tests assert real product behavior instead of relying on timing-sensitive assumptions.
- Restore reliable targeted verification for the affected widget feedback scenarios and capture any remaining genuine failures separately from harness instability.

## Capabilities

### New Capabilities
- `widget-feedback-e2e-reliability`: Deterministic Playwright execution for widget survey and CSAT experiences with explicit readiness and reproducible seeded visitor state.

### Modified Capabilities
- `widget-shell-modularity`: Widget runtime requirements will be updated so survey and CSAT display paths become observable and deterministic under embedded widget-demo E2E execution.
- `playwright-e2e-reliability`: Shared E2E widget fixtures and helpers will be refined where needed so seeded feedback experiences run reliably instead of appearing as flaky visibility failures.

## Impact

- OpenSpec change artifacts under `openspec/changes/stabilize-widget-survey-and-csat-e2e/`
- Widget runtime and survey display logic under `apps/widget/src/`
- Widget demo page and web E2E harness under `apps/web/src/app/widget-demo/` and `apps/web/e2e/`
- Shared E2E helpers/fixtures and seeded feedback data under `apps/web/e2e/helpers/`, `apps/web/e2e/fixtures.ts`, and `packages/convex/convex/testData/`
- Survey and CSAT delivery/query logic under `packages/convex/convex/` and related shared SDK utilities
