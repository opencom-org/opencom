## 1. Shared Helper Extraction

- [x] 1.1 Extract visitors validators/constants/helper utilities into `convex/visitors/helpers.ts`.

## 2. Query + Mutation Module Extraction

- [x] 2.1 Extract core visitor queries into `convex/visitors/coreQueries.ts`.
- [x] 2.2 Extract directory/detail/history queries into `convex/visitors/directoryQueries.ts`.
- [x] 2.3 Extract identify/location/heartbeat mutations into `convex/visitors/mutations.ts`.

## 3. Recomposition + Verification

- [x] 3.1 Recompose `convex/visitors.ts` as a stable re-export aggregator.
- [x] 3.2 Run `pnpm --filter @opencom/convex typecheck`.
- [x] 3.3 Run dependent package typechecks (`web`, `widget`, `mobile`, `sdk-core`, `react-native-sdk`).
- [x] 3.4 Record progress docs and refresh remaining-slices map.
