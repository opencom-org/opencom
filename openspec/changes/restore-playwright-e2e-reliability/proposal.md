## Why

Playwright coverage is currently unreliable because shared E2E auth/bootstrap paths can fail to provision or recover authenticated worker state, causing widget and other admin suites to skip at runtime instead of exercising their intended behavior. This blocks confidence in widget end-to-end coverage and hides broader regressions behind setup failures rather than actionable test results.

## What Changes

- Strengthen the shared Playwright worker provisioning and auth recovery flow so protected suites consistently reach authenticated routes with valid workspace state.
- Remove reliance on silent runtime skips for widget and related admin E2E suites when shared setup should be able to recover, favoring deterministic execution or explicit actionable failures.
- Make Playwright reporting and verification clearly surface whether suites ran, skipped for declared prerequisites, or failed due to product regressions.
- Restore reliable execution for widget E2E suites and validate any other Playwright suites affected by the same auth/bootstrap instability.

## Capabilities

### New Capabilities
- `playwright-e2e-reliability`: Reliable worker-scoped Playwright authentication/bootstrap and explicit execution guarantees for protected E2E suites.

### Modified Capabilities
- `widget-shell-modularity`: Widget end-to-end requirements will be updated so the widget demo and embedded flows must run under the repo Playwright harness instead of being masked by shared setup skips.

## Impact

- OpenSpec change artifacts under `openspec/changes/restore-playwright-e2e-reliability/`
- Playwright configuration and shared E2E helpers under `playwright.config.ts` and `apps/web/e2e/helpers/`
- Worker fixtures and authenticated suite behavior under `apps/web/e2e/fixtures.ts` and affected spec files
- Widget/admin E2E coverage under `apps/web/e2e/*.spec.ts`
- Test result/reporting artifacts under `test-results/` and `playwright-report/`
