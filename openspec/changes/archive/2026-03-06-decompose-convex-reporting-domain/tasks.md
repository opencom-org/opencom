## 1. Shared Helper Extraction

- [x] 1.1 Extract shared reporting access/limit/date helpers into `convex/reporting/helpers.ts`.

## 2. Concern Module Extraction

- [x] 2.1 Extract conversation + response/resolution metrics into dedicated module(s).
- [x] 2.2 Extract agent metrics into dedicated module.
- [x] 2.3 Extract CSAT eligibility/submission/metrics logic into dedicated module.
- [x] 2.4 Extract AI metrics/comparison/knowledge-gaps logic into dedicated module.
- [x] 2.5 Extract snapshot + dashboard summary logic into dedicated module(s).

## 3. Recomposition + Verification

- [x] 3.1 Recompose `convex/reporting.ts` as stable re-export entrypoint.
- [x] 3.2 Run `pnpm --filter @opencom/convex typecheck`.
- [x] 3.3 Run dependent package typechecks (`web`, `widget`, `mobile`, `sdk-core`, `react-native-sdk`).
- [x] 3.4 Record progress docs and refresh remaining-slices map.
