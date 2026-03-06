## 1. Domain Helper Extraction

- [x] 1.1 Extract tour domain types into `apps/widget/src/tourOverlay/types.ts`.
- [x] 1.2 Extract route matching and wildcard helpers into `apps/widget/src/tourOverlay/routeMatching.ts`.
- [x] 1.3 Extract advance/block guidance helpers and viewport utilities into dedicated `tourOverlay` helper files.

## 2. Render Section Decomposition

- [x] 2.1 Extract recovery + route-hint modal sections into presentational components.
- [x] 2.2 Extract pointer-step and post-step card sections into presentational components while preserving existing test IDs.
- [x] 2.3 Extract backdrop/highlight and confetti sections into presentational components.

## 3. Controller Recomposition + Verification

- [x] 3.1 Recompose `apps/widget/src/TourOverlay.tsx` as controller/orchestration layer using extracted modules.
- [x] 3.2 Run `pnpm --filter @opencom/widget typecheck`.
- [x] 3.3 Run `pnpm --filter @opencom/widget test -- --run src/test/tourOverlay.test.tsx`.
- [x] 3.4 Run `pnpm --filter @opencom/web typecheck`.
- [x] 3.5 Update refactor progress docs and remaining-map tracker.
