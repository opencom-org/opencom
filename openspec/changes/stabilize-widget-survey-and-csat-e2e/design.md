## Context

Recent Playwright runs show a consistent failure pattern in widget feedback coverage: the widget demo page loads, the launcher is present, but seeded survey or CSAT UI sometimes never appears. The current failures occur before interaction and are therefore not explained by stale selectors alone. Existing attempts to update selectors and explicit submit behavior improved older failures, but the remaining flaky cases indicate a deeper readiness or bootstrap race.

The affected path spans several layers:

1. Convex test-data seeding creates active surveys/CSAT content with immediate or otherwise eligible trigger conditions.
2. The widget demo page initializes the embedded widget with a seeded or test visitor identity.
3. The widget runtime establishes visitor/session state, queries active feedback experiences, arbitrates blockers, and selects a candidate survey.
4. Playwright waits for a visible survey/CSAT UI and then performs completion or dismissal assertions.

The current evidence suggests the race lives between steps 2 and 4. In failing runs, the page and launcher are visible but the feedback UI never enters the DOM within the wait window. This indicates either missing readiness, missing eligibility re-evaluation, or non-deterministic suppression/identity behavior rather than pure render slowness.

## Goals / Non-Goals

### Goals

- Make widget survey and CSAT E2E flows deterministic under the standard PNPM/Playwright workflow.
- Replace timing-sensitive assumptions with explicit readiness conditions for visitor/session/bootstrap and feedback eligibility.
- Ensure seeded immediate feedback experiences can be exercised repeatedly in isolation without cross-test leakage from prior impressions or visitor identity reuse.
- Preserve the real product delivery rules while making failures actionable: readiness problems should fail explicitly, not masquerade as generic visibility timeouts.

### Non-Goals

- Redesign survey or CSAT product behavior beyond what is necessary for deterministic E2E execution.
- Increase global Playwright timeouts as the primary solution to widget feedback flakes.
- Expand widget feedback coverage to unrelated new scenarios while stabilizing the existing broken ones.

## Proposed Technical Direction

### 1. Make widget feedback readiness explicit

The widget feedback path should only be considered ready for E2E assertions after visitor/session state and the corresponding feedback query inputs are available. This may require tightening widget demo bootstrap, exposing a deterministic readiness signal, or ensuring feedback query state re-evaluates once session identity becomes available.

### 2. Stabilize seeded visitor identity and suppression boundaries

Survey and CSAT tests should use isolated seeded visitor/session identities or other deterministic fixture inputs so `once` / completion / impression suppression cannot leak across test runs. Any identity reuse should be intentional and scoped to tests that verify frequency control.

### 3. Narrow blocking/arbitration uncertainty

Widget feedback display should only defer when an actually active higher-priority blocking experience is present. Pending bookkeeping or transient candidate states must not starve eligible survey/CSAT display without a visible blocker. Verification should prove that immediate small feedback experiences either render or fail with a clear readiness reason.

### 4. Keep E2E helpers aligned with real UX contracts

Playwright helpers should continue to reflect the current widget DOM and submission flow, but they should not be responsible for masking missing feedback state. Helpers should wait on explicit widget feedback readiness signals where possible, then assert current DOM selectors and interactions.

### 5. Verify surveys and CSAT independently, then together

The stabilization effort should run focused verification for the failing survey block and for the failing CSAT scenarios separately before rerunning the broader widget feedback suite. This preserves signal and helps identify whether both failures share the same readiness root cause or only overlap partially.

## Risks and Tradeoffs

- Tightening readiness contracts may initially convert flaky passes into explicit failures until the true bootstrap/query race is removed.
- Adding deterministic visitor/session fixture isolation can increase setup complexity for widget-demo E2E flows.
- If survey and CSAT failures share only part of their root cause, a common abstraction may need to stay small to avoid overfitting one path and regressing the other.
- Temporary diagnostics may be required during implementation, but they should be removed once deterministic behavior is verified.

## Verification Strategy

- Build the widget test bundle when required and run focused survey Playwright coverage with PNPM, e.g. `bash scripts/build-widget-for-tests.sh` followed by `pnpm playwright test apps/web/e2e/widget-features.spec.ts --project chromium --grep "Widget E2E Tests - Surveys"` with Convex env loaded.
- Run the failing CSAT-focused Playwright coverage with PNPM using the same seeded env prerequisites and isolate the affected spec(s) or grep targets.
- Re-run the broader widget feedback spec file(s) after the focused fixes pass to confirm the readiness changes generalize.
- Review Playwright artifacts and, when needed, browser console output to confirm failures are no longer generic visibility timeouts caused by missing feedback DOM.
