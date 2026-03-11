# Refactor Progress: Convex Schema Domain Fragments (2026-03-05)

## Scope

- `packages/convex/convex/schema.ts`
- `packages/convex/convex/schema/authWorkspaceTables.ts`
- `packages/convex/convex/schema/inboxNotificationTables.ts`
- `packages/convex/convex/schema/helpCenterTables.ts`
- `packages/convex/convex/schema/engagementTables.ts`
- `packages/convex/convex/schema/outboundSupportTables.ts`
- `packages/convex/convex/schema/campaignTables.ts`
- `packages/convex/convex/schema/operationsTables.ts`

## Problem Addressed

`packages/convex/convex/schema.ts` contained all table declarations (~2026 lines) in one file, creating high coupling and expensive reviews.

## What Was Refactored

1. Extracted schema declarations into domain fragment modules under `packages/convex/convex/schema/`.
2. Reduced `schema.ts` to a composition-only aggregator that spreads `authTables` and fragment exports.
3. Preserved table names/indexes/search/vector index declarations and validator semantics.
4. Restored `notificationPreferences` channel validator parity by including the `push` channel in the notification preference validator contract.

## Result

- `packages/convex/convex/schema.ts` reduced to 20 lines.
- Schema declarations are now grouped by domain fragments, lowering single-file churn.
- No Convex table/index rename or API signature changes.

## Compatibility Notes (Mobile / SDK / React Native SDK)

- No endpoint signature changes in Convex function modules.
- Typechecks passed for impacted consuming packages (`web`, `widget`, `mobile`, `sdk-core`, `react-native-sdk`).

## Verification

Passed:

- `pnpm --filter @opencom/convex typecheck`
- `pnpm --filter @opencom/web typecheck`
- `pnpm --filter @opencom/widget typecheck`
- `pnpm --filter @opencom/mobile typecheck`
- `pnpm --filter @opencom/sdk-core typecheck`
- `pnpm --filter @opencom/react-native-sdk typecheck`
