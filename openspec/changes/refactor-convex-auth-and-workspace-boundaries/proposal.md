## Why

Convex auth, workspace resolution, and permission enforcement are central to correctness but currently concentrated behind wrappers and related helpers that carry multiple concerns. This increases the cost of safely evolving access-control behavior and makes it harder for contributors to distinguish production boundary logic from supporting test utilities.

## What Changes

- Separate Convex authentication, workspace resolution, permission enforcement, and handler wrapping responsibilities into clearer domain boundaries.
- Reduce coupling between production auth wrappers and surrounding support logic.
- Consolidate duplicated or overlapping backend test helper patterns around auth/session/internal mutation setup.
- Preserve all existing permission outcomes, mutation/query/action contracts, and user-visible authorization behavior.

## Capabilities

### New Capabilities
- `convex-workspace-permission-boundaries`: Covers explicit separation of authentication, workspace resolution, and permission enforcement responsibilities in Convex boundary code.

### Modified Capabilities
- `convex-auth-wrapper-adoption`: Clarify adoption requirements so wrapper usage does not obscure distinct auth/workspace/permission responsibilities.
- `convex-test-fixture-modularity`: Extend modular test-fixture expectations to auth/session/internal mutation helper composition.

## Impact

- Affected code: `packages/convex/convex/lib/authWrappers.ts`, related auth/session helpers, and test helper modules.
- Affected systems: Convex query/mutation/action boundary code and backend test infrastructure.
- Dependencies: no external dependency changes; internal structure and helper ownership will change.
