# Refactor Progress: Shared Visitor Readable ID Generator (2026-03-05)

## Scope

- `packages/types`
- `packages/convex`
- `apps/web`
- compatibility verification for `apps/mobile`, `packages/sdk-core`, `packages/react-native-sdk`

## Problem Addressed

Deterministic visitor readable ID generation was duplicated in:

- `packages/convex/convex/visitorReadableId.ts`
- `apps/web/src/lib/visitorIdentity.ts`

This introduced drift risk between backend-generated `visitors.readableId` values and frontend fallback identity labels.

## What Was Centralized

Added shared source-of-truth utility:

- `packages/types/src/visitorReadableId.ts`

Exports:

- `formatReadableVisitorId(visitorId: string): string`

And exported from:

- `packages/types/src/index.ts`

## Consumer Refactors

### Convex

- `packages/convex/convex/visitorReadableId.ts`
  - Replaced duplicated dictionaries/hash implementation with a thin wrapper around `@opencom/types`.
  - Preserved existing function signature:
    - `formatReadableVisitorId(visitorId: Id<"visitors"> | string): string`

### Web

- `apps/web/src/lib/visitorIdentity.ts`
  - Removed duplicated adjective/noun dictionaries for numbered readable IDs.
  - Updated `formatHumanVisitorId(visitorId, "numbered")` to call shared `formatReadableVisitorId`.
  - Preserved web-only `verb` variant behavior and label fallback precedence helpers.

## Guardrail Tests Added

- `apps/web/src/lib/__tests__/visitorIdentity.test.ts`
  - locks deterministic numbered/verb outputs for representative IDs
  - verifies label precedence (`name -> email -> readableId -> visitorId fallback`)
- `packages/convex/tests/visitorReadableId.test.ts`
  - verifies Convex wrapper parity with shared formatter and deterministic outputs

## Verification

Passed:

- `pnpm --filter @opencom/types typecheck`
- `pnpm --filter @opencom/convex typecheck`
- `pnpm --filter @opencom/convex test -- --run tests/visitorReadableId.test.ts`
- `pnpm --filter @opencom/convex test`
- `pnpm --filter @opencom/web test -- src/lib/__tests__/visitorIdentity.test.ts`
- `pnpm --filter @opencom/widget typecheck`
- `pnpm --filter @opencom/sdk-core typecheck`
- `pnpm --filter @opencom/mobile typecheck`
- `pnpm --filter @opencom/react-native-sdk typecheck`

Known pre-existing unrelated failure:

- `pnpm --filter @opencom/web typecheck` still fails in existing article/audience/outbound/tours typing paths outside this slice.
