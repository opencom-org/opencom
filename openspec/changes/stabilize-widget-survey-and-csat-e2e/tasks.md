## 1. Stabilize widget feedback readiness and fixture determinism

- [ ] 1.1 Identify and fix the widget survey/CSAT bootstrap race between widget-demo initialization, visitor/session readiness, and feedback eligibility queries.
- [ ] 1.2 Ensure seeded visitor/session identity is deterministic per test and cannot leak suppression or completion state across unrelated survey/CSAT runs.
- [ ] 1.3 Remove or refine any widget feedback blocking/arbitration conditions that can defer eligible survey/CSAT display without an active visible blocker.

## 2. Align Playwright feedback helpers with the product contract

- [ ] 2.1 Keep survey and CSAT E2E helpers/selectors aligned with the current widget DOM and explicit submission flow.
- [ ] 2.2 Add or adopt an explicit readiness signal for widget feedback assertions so tests do not rely on raw visibility polling alone.
- [ ] 2.3 Preserve intentional frequency-control coverage while ensuring all other feedback tests start from isolated deterministic state.

## 3. Restore focused verification for surveys and CSAT

- [ ] 3.1 Run the focused widget survey Playwright block with PNPM and confirm the currently flaky survey tests pass reliably.
- [ ] 3.2 Run the failing CSAT-focused Playwright verification and fix any remaining readiness, selector, or assertion issues.
- [ ] 3.3 Re-run the broader widget feedback suite and review Playwright artifacts to document any remaining genuine product failures separately from harness instability.
