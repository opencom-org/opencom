# Refactor Progress: Centralize Outbound + Trigger Contracts (2026-03-05)

## Slice

- `centralize-outbound-and-trigger-contracts` (P0, in progress)

## Why

Outbound contract validators were duplicated across Convex runtime args, schema tables, and E2E seeding.
This increased drift risk between authoring surfaces (`web`), delivery/runtime (`widget`), and reference consumers (`sdk-core`, `react-native-sdk`, `mobile`).

## What Changed In This Pass

1. Added a shared Convex outbound contract module:
   - `packages/convex/convex/outboundContracts.ts`
   - Centralizes validators for:
     - message type/status
     - content/buttons/click actions
     - trigger config + URL match mode
     - frequency/scheduling
     - impression actions
2. Rewired outbound runtime mutation/query args to shared validators:
   - `packages/convex/convex/outboundMessages.ts`
3. Rewired outbound schema tables to the same shared validators:
   - `packages/convex/convex/schema/outboundSupportTables.ts`
4. Rewired outbound E2E seeding args to shared validators:
   - `packages/convex/convex/testData/seeds.ts`
5. Reduced seed-side type duplication by introducing narrowed shared outbound content/button typings (excluding `reply`/`chat` actions that are not accepted by Convex outbound authoring validators).

## Verification Run Notes

Executed in this pass:

- `pnpm --filter @opencom/convex typecheck` -> pass
- `pnpm --filter @opencom/convex test` -> pass (32 files, 216 tests)
- `pnpm --filter @opencom/web typecheck` -> pass
- `pnpm --filter @opencom/widget typecheck` -> pass
- `pnpm test:compat:cross-surface` -> pass
  - `@opencom/sdk-core` tests: pass
  - `@opencom/react-native-sdk` tests: pass
  - `apps/mobile` typecheck: pass

## Current Full-Suite Status

From the latest full `pnpm test` run:

- Unit: pass
- E2E: fail (12 deterministic failures, 181 passed, 7 skipped)

Known failing E2E domains remain:

- `ai-agent-settings`
- `carousels`
- `home-settings` preview
- `inbox` sidecar
- `knowledge` delete flow
- `tooltips` CRUD
- `widget` email capture
- no-auth signup flow

These are tracked separately as stabilization work and were not modified by this contract-centralization pass.
