# Testing Guide

This document describes the testing infrastructure and best practices for Opencom.

## Overview

Opencom uses a comprehensive testing strategy with three layers:

1. **Unit Tests** - Vitest for testing utilities, hooks, and pure functions
2. **Integration Tests** - Vitest with real Convex backend for testing database operations
3. **E2E Tests** - Playwright for testing critical user flows in the browser

## Test Environment Setup

### Convex Test Deployment

To avoid polluting development or production data, tests run against a dedicated Convex test deployment.

**Initial Setup:**

```bash
cd packages/convex

# Login to Convex (if not already)
npx convex login

# Create test deployment
npx convex dev --project opencom-test --once
```

**Configuration:**

Create `packages/convex/.env.test` from the example and update it with your test deployment URL:

```bash
cp packages/convex/.env.test.example packages/convex/.env.test
```

```
CONVEX_URL=https://your-test-deployment.convex.cloud
```

### Test Isolation Strategy

Each test suite creates isolated data using unique identifiers:

1. **Workspace Isolation**: Each test suite creates a unique workspace with a timestamp suffix
2. **Automatic Cleanup**: After each suite, `cleanupTestData` removes all test data
3. **No Cross-Contamination**: Tests don't share data, enabling parallel execution

### Playwright Worker Auth Isolation

Authenticated Playwright suites use one account/workspace per parallel worker.
The fixture contract is implemented in `apps/web/e2e/fixtures.ts`.

1. Worker bootstrap runs in a clean browser context (`storageState: undefined`)
2. Each worker persists auth and test state to worker-unique files keyed by `parallelIndex`
3. Tests on the same worker reuse only that worker's state
4. Missing or malformed worker state fails setup with explicit actionable errors
5. Auth refresh updates only the current worker's state files (no cross-worker mutation)

## Running Tests

### All Tests

```bash
pnpm test
```

Note: Convex integration suites are auto-excluded when `CONVEX_URL` is not configured. To run deployment-backed Convex tests, set `CONVEX_URL` in `packages/convex/.env.test` (or your shell environment) first. The target deployment must include the current test helper/testAdmin wiring used by the suites.

### Unit Tests Only

```bash
pnpm test:unit
```

### E2E Tests Only

```bash
pnpm test:e2e
```

### With Coverage

```bash
pnpm test:ci
```

### Watch Mode (Development)

```bash
# In packages/convex
pnpm test:watch

# In apps/web
pnpm test:watch
```

## Writing Tests

### Convex Integration Tests

Use the test helpers in `packages/convex/convex/testing/helpers.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

describe("myFeature", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    // Create isolated test workspace
    const workspace = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    testWorkspaceId = workspace.workspaceId;
  });

  afterAll(async () => {
    // Clean up test data
    if (testWorkspaceId) {
      await client.mutation(api.testing.helpers.cleanupTestData, {
        workspaceId: testWorkspaceId,
      });
    }
    await client.close();
  });

  it("should do something", async () => {
    // Your test here
  });
});
```

### Available Test Helpers

| Helper                   | Description                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `createTestWorkspace`    | Creates an isolated workspace with unique name                                      |
| `createTestUser`         | Creates a user in the specified workspace                                           |
| `createTestVisitor`      | Creates a visitor with session ID                                                   |
| `createTestSessionToken` | Creates a signed session token for a visitor (required by visitor-facing endpoints) |
| `createTestConversation` | Creates a conversation                                                              |
| `createTestMessage`      | Creates a message in a conversation                                                 |
| `cleanupTestData`        | Removes all data for a workspace                                                    |

### React Component Tests

Use `@testing-library/react` for component tests:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MyComponent } from "./MyComponent";

describe("MyComponent", () => {
  it("renders correctly", () => {
    render(<MyComponent />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
```

### E2E Tests

Use Playwright for end-to-end tests:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Feature", () => {
  test("should work", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading")).toBeVisible();
  });
});
```

For authenticated suites, do not bypass the shared worker fixtures. New tests
should consume the existing fixture setup so worker auth isolation and refresh
behavior stay consistent.

## Test File Organization

Tests are co-located with source files:

```
packages/convex/convex/
  workspaces.ts
  workspaces.test.ts      # Integration tests

apps/web/
  src/
    components/
      ChatMessage.tsx
      ChatMessage.test.tsx  # Component tests
  e2e/
    auth.spec.ts           # E2E tests
    chat.spec.ts
```

## Best Practices

### Do

- ✅ Create isolated test data using helpers
- ✅ Clean up after tests
- ✅ Use descriptive test names
- ✅ Test both success and error cases
- ✅ Use `data-testid` attributes for E2E selectors
- ✅ Keep tests focused and independent

### Don't

- ❌ Share state between tests
- ❌ Rely on specific database IDs
- ❌ Skip cleanup in afterAll
- ❌ Use production or development deployments for tests
- ❌ Hard-code timeouts (use Playwright's auto-wait)

## CI Pipeline

### CI Workflow (`.github/workflows/ci.yml`)

The CI pipeline runs two jobs:

**1. Checks job:**

- Install dependencies (`pnpm install --frozen-lockfile`)
- Lint (`pnpm lint`)
- Typecheck (`pnpm typecheck`)
- Security gates:
  - `pnpm security:convex-auth-guard` — unguarded handler detection
  - `pnpm security:convex-any-args-gate` — `v.any()` usage scanning
  - `pnpm security:secret-scan` — committed secret detection
  - `pnpm security:headers-check` — security header validation
- Convex tests (`pnpm --filter @opencom/convex test`)
- Web build (`pnpm --filter @opencom/web build`)
- Dependency audit gate

**2. E2E job:**

- Build widget for tests (`bash scripts/build-widget-for-tests.sh`)
- Playwright test suite
- Reliability report and gate (budget: 0 unexpected, <=5 flaky, <=70 skipped)

### CI-Equivalent Local Run

```bash
pnpm lint
pnpm typecheck
pnpm security:convex-auth-guard
pnpm security:convex-any-args-gate
pnpm security:secret-scan
pnpm security:headers-check
pnpm --filter @opencom/convex test
pnpm --filter @opencom/web build
bash scripts/build-widget-for-tests.sh
pnpm web:test:e2e
```

### Environment Variables for CI

| Variable            | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `CONVEX_URL`        | Test deployment URL                        |
| `E2E_BACKEND_URL`   | Backend target for Playwright E2E          |
| `E2E_TEST_PASSWORD` | Password for E2E auth bootstrap            |
| `TEST_ADMIN_SECRET` | Secret for E2E test data seeding/cleanup   |
| `ALLOW_TEST_DATA`   | Must be `"true"` on test Convex deployment |
| `CI`                | Set to `true` for CI-specific behavior     |

## Security Gate Scripts

Security gates run as part of CI and can be run locally:

| Command                              | Script                                 | Config File                                 | Purpose                           |
| ------------------------------------ | -------------------------------------- | ------------------------------------------- | --------------------------------- |
| `pnpm security:convex-auth-guard`    | `scripts/ci-convex-auth-guard.js`      | `security/convex-raw-handler-registry.json` | Detect unguarded Convex handlers  |
| `pnpm security:convex-any-args-gate` | `scripts/ci-convex-any-args-gate.js`   | `security/convex-v-any-arg-exceptions.json` | Detect `v.any()` in function args |
| `pnpm security:secret-scan`          | `scripts/ci-secret-scan.js`            | —                                           | Scan for committed secrets        |
| `pnpm security:headers-check`        | `scripts/ci-security-headers-check.js` | —                                           | Validate security headers         |

Run `pnpm security:secret-scan` before pushing changes. If a finding is a verified
false positive, use `security/secret-scan-exceptions.json` with a minimal file/rule scope
plus owner, reason, and expiry metadata instead of broad ignores.

## E2E Reliability Tracking

E2E test runs are logged to `test-run-log.jsonl` for reliability analysis.

```bash
pnpm test:summary       # Show recent run summary
pnpm test:clear          # Clear run history
pnpm test:e2e:prod       # Run E2E against production build
```

Reliability budgets (`security/e2e-reliability-budget.json`):

| Metric              | Budget |
| ------------------- | ------ |
| Unexpected failures | 0      |
| Flaky tests         | 5      |
| Skipped tests       | 70     |

## Test Helpers Reference

All helpers are in `packages/convex/convex/testing/helpers.ts`:

| Helper                   | Description                                           |
| ------------------------ | ----------------------------------------------------- |
| `createTestWorkspace`    | Creates workspace with unique timestamp-suffixed name |
| `createTestUser`         | Creates user with workspace membership                |
| `createTestVisitor`      | Creates visitor with session ID                       |
| `createTestSessionToken` | Creates signed session token for a visitor            |
| `createTestConversation` | Creates conversation in workspace                     |
| `createTestMessage`      | Creates message in conversation                       |
| `cleanupTestData`        | Removes all data for a workspace                      |

### Test Admin Gateway

E2E tests use the `testAdmin:runTestMutation` gateway (`packages/convex/convex/testAdmin.ts`) for data seeding and cleanup. This gateway:

- Requires `TEST_ADMIN_SECRET` to match the deployment secret
- Only works when `ALLOW_TEST_DATA=true` on the deployment
- Proxies mutations through an authenticated internal path

## Troubleshooting

### "CONVEX_URL environment variable is required"

Ensure `.env.test` exists in `packages/convex/` with a valid test deployment URL.

### Tests are polluting dev/prod data

Check that `CONVEX_URL` in `.env.test` points to a dedicated test deployment, not your dev or prod deployment.

### E2E tests timing out

1. Ensure the web server is running (`pnpm dev:web`)
2. Check that `playwright.config.ts` has correct `baseURL`
3. Increase timeout in config if needed

### E2E seeding fails with unauthorized errors

Ensure the Convex deployment has matching `TEST_ADMIN_SECRET` and `ALLOW_TEST_DATA=true`.

### Convex types not found

Run `npx convex dev --once` in `packages/convex/` to regenerate types.

### Convex tests skipped (no CONVEX_URL)

Convex integration suites auto-skip when `CONVEX_URL` is not configured. Set it in `packages/convex/.env.test` or your shell environment.
