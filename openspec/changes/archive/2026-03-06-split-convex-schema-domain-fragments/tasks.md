## 1. Schema Fragment Extraction

- [x] 1.1 Extract auth/workspace table declarations into a dedicated schema fragment module.
- [x] 1.2 Extract inbox/notification table declarations into dedicated schema fragment module(s).
- [x] 1.3 Extract help center, engagement, outbound/support, campaign, and operations table declarations into domain fragment modules.

## 2. Schema Composition Rewire

- [x] 2.1 Recompose `packages/convex/convex/schema.ts` as a thin schema aggregator over fragments.
- [x] 2.2 Ensure validator contracts remain intact for notification preferences and messenger settings.

## 3. Verification + Documentation

- [x] 3.1 Run `pnpm --filter @opencom/convex typecheck`.
- [x] 3.2 Run `pnpm --filter @opencom/web typecheck` and `pnpm --filter @opencom/widget typecheck`.
- [x] 3.3 Run `pnpm --filter @opencom/mobile typecheck`, `pnpm --filter @opencom/sdk-core typecheck`, and `pnpm --filter @opencom/react-native-sdk typecheck`.
- [x] 3.4 Record progress docs and refresh the remaining-slices map.
