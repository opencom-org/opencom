## Why

`packages/convex/convex/testing/helpers.ts` (2605 lines) and `packages/convex/convex/testData.ts` (3355 lines) are oversized fixture/helper modules that are hard to navigate and extend safely. Test contributor velocity suffers when unrelated test concerns share monolithic files.

## What Changes

- Split Convex test helpers and seed data into domain-focused modules (auth, visitors, conversations, notifications, AI, help center, etc.).
- Preserve existing helper APIs through transitional exports while migrating tests.
- Introduce clearer fixture ownership and discovery conventions.
- Add regression checks to ensure test setup behavior remains equivalent.

## Capabilities

### New Capabilities

- `convex-test-fixture-modularity`: Convex test helpers and fixture data are organized into domain modules with discoverable ownership.

### Modified Capabilities

- None.

## Impact

- Convex testing modules under `packages/convex/convex/testing` and `packages/convex/convex/testData*`.
- Convex tests importing helper utilities and seed fixtures.
- Contributor onboarding and maintenance for test infrastructure.
