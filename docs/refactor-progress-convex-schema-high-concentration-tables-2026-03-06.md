# Refactor Progress: Convex Schema High-Concentration Tables (2026-03-06)

## Slice

- `split-convex-schema-high-concentration-tables` (continued to a clean stop point)

## Why

The first schema fragmentation pass reduced `schema.ts`, but some fragment files were still acting as high-churn catch-alls.
`packages/convex/convex/schema/campaignTables.ts` was the largest remaining fragment at roughly `538` lines and mixed unrelated campaign domains together.

## What Changed In This Pass

1. Split campaign schema declarations into domain-based fragments:
   - `packages/convex/convex/schema/campaignEmailTables.ts`
   - `packages/convex/convex/schema/campaignPushTables.ts`
   - `packages/convex/convex/schema/campaignCarouselTables.ts`
   - `packages/convex/convex/schema/campaignSeriesTables.ts`
   - `packages/convex/convex/schema/campaignSurveyTables.ts`
2. Reduced the old campaign fragment into a composition-only aggregator:
   - `packages/convex/convex/schema/campaignTables.ts`
3. Split operations schema declarations into focused fragments:
   - `packages/convex/convex/schema/operationsAiTables.ts`
   - `packages/convex/convex/schema/operationsWorkflowTables.ts`
   - `packages/convex/convex/schema/operationsReportingTables.ts`
   - `packages/convex/convex/schema/operationsMessengerTables.ts`
4. Reduced the old operations fragment into a composition-only aggregator:
   - `packages/convex/convex/schema/operationsTables.ts`
5. Split inbox notification schema declarations into focused fragments:
   - `packages/convex/convex/schema/inboxConversationTables.ts`
   - `packages/convex/convex/schema/inboxPushTokenTables.ts`
   - `packages/convex/convex/schema/inboxNotificationRoutingTables.ts`
6. Reduced the old inbox notification fragment into a composition-only aggregator:
   - `packages/convex/convex/schema/inboxNotificationTables.ts`
7. Preserved all existing table names, indexes, and validator contracts while lowering the concentration of unrelated schema concerns in the remaining high-density schema fragments.

## Verification Run Notes

Executed in this pass:

- `pnpm --filter @opencom/convex typecheck` -> pass
- `pnpm --filter @opencom/convex test` -> pass (`32` files, `216` tests)

## Notes

- This continued the higher-concentration schema split without changing runtime handlers or generated API surface.
- The initial follow-up targets (`operationsTables.ts` and `inboxNotificationTables.ts`) are now also decomposed, so this slice is at a clean stop point.
- Any further schema work should come from a fresh concentration audit rather than continuing the original backlog verbatim.
