# Refactor Progress: Convex Visitors Domain Decomposition (2026-03-05)

## Scope

- `packages/convex/convex/visitors.ts`
- `packages/convex/convex/visitors/helpers.ts`
- `packages/convex/convex/visitors/coreQueries.ts`
- `packages/convex/convex/visitors/directoryQueries.ts`
- `packages/convex/convex/visitors/mutations.ts`

## Problem Addressed

`packages/convex/convex/visitors.ts` previously combined helper contracts, directory/history logic, and mutation workflows in one monolithic file.

## What Was Refactored

1. Extracted shared validators/constants/merge + audit projection helpers into `visitors/helpers.ts`.
2. Extracted core read queries (`getBySession`, `get`, `list`, `search`, `isOnline`) to `visitors/coreQueries.ts`.
3. Extracted directory/detail/history queries to `visitors/directoryQueries.ts`.
4. Extracted mutation workflows (`identify`, `updateLocation`, `heartbeat`) to `visitors/mutations.ts`.
5. Converted `visitors.ts` into a stable re-export entrypoint preserving endpoint names.

## Result

- `packages/convex/convex/visitors.ts` reduced to 5 lines (from ~1070 lines).
- Visitor domain responsibilities are now separated by concern without endpoint signature changes.

## Compatibility Notes (Web / Widget / Mobile / SDKs)

- No visitor endpoint name/signature changes.
- Cross-surface typechecks passed across all targeted apps/packages.

## Verification

Passed:

- `pnpm --filter @opencom/convex typecheck`
- `pnpm --filter @opencom/web typecheck`
- `pnpm --filter @opencom/widget typecheck`
- `pnpm --filter @opencom/mobile typecheck`
- `pnpm --filter @opencom/sdk-core typecheck`
- `pnpm --filter @opencom/react-native-sdk typecheck`
