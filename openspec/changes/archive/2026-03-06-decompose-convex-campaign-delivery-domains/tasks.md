## 1. Carousel Domain Extraction

- [x] 1.1 Extract carousel validators/helpers into `convex/carousels/helpers.ts`.
- [x] 1.2 Extract carousel authoring/status endpoints into dedicated module.
- [x] 1.3 Extract carousel delivery/tracking endpoints into dedicated module.
- [x] 1.4 Extract carousel triggering endpoints into dedicated module.

## 2. Survey Domain Extraction

- [x] 2.1 Extract survey validators/permission helpers into `convex/surveys/helpers.ts`.
- [x] 2.2 Extract survey authoring endpoints into dedicated module.
- [x] 2.3 Extract survey responses/export endpoints into dedicated module.
- [x] 2.4 Extract survey delivery/impression/analytics endpoints into dedicated module.

## 3. Recomposition + Verification

- [x] 3.1 Recompose `convex/carousels.ts` and `convex/surveys.ts` as stable re-export entrypoints.
- [x] 3.2 Run `pnpm --filter @opencom/convex typecheck`.
- [x] 3.3 Run dependent package typechecks (`web`, `widget`, `mobile`, `sdk-core`, `react-native-sdk`).
- [x] 3.4 Record progress docs and refresh remaining-slices map.
