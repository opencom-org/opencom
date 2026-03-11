## 1. Restore shared Playwright auth/bootstrap readiness

- [ ] 1.1 Strengthen shared auth recovery so protected pages are not considered ready until active workspace state is available.
- [ ] 1.2 Preserve explicit prerequisite handling only for declared external requirements such as admin seeding secrets.
- [ ] 1.3 Verify shared worker provisioning and auth refresh continue to persist usable storage state for subsequent tests.

## 2. Remove silent runtime skips from protected suites

- [ ] 2.1 Update widget E2E suites to fail explicitly when shared auth/bootstrap unexpectedly breaks.
- [ ] 2.2 Update other protected Playwright admin suites that currently skip on shared auth failure to use explicit expectations instead.
- [ ] 2.3 Confirm legitimate test-level skips remain limited to unsupported prerequisites or intentionally unavailable seeded data.

## 3. Prove widget and related Playwright suites execute under the repo workflow

- [ ] 3.1 Run focused widget Playwright verification with PNPM and confirm suites execute instead of being skipped by auth/bootstrap guards.
- [ ] 3.2 Run at least one additional affected Playwright suite to validate the shared fix outside widget coverage.
- [ ] 3.3 Review generated Playwright artifacts and record any remaining genuine failures for follow-up.
