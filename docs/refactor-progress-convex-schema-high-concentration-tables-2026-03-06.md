# Refactor Progress: Convex Schema High-Concentration Tables (2026-03-06)

## Slice

- `split-convex-schema-high-concentration-tables` (started)

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
3. Preserved all existing table names, indexes, and validator contracts while lowering the concentration of unrelated schema concerns in one file.

## Verification Run Notes

Executed in this pass:

- `pnpm --filter @opencom/convex typecheck` -> pass
- `pnpm --filter @opencom/convex test` -> pass (`32` files, `216` tests)

## Notes

- This starts the higher-concentration schema split without changing runtime handlers or generated API surface.
- The next obvious follow-up candidates are `packages/convex/convex/schema/operationsTables.ts` and `packages/convex/convex/schema/inboxNotificationTables.ts`.
