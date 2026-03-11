## 1. Domain Extraction

- [x] 1.1 Extract survey overlay types into `apps/widget/src/surveyOverlay/types.ts`.
- [x] 1.2 Extract answer normalization helpers into `apps/widget/src/surveyOverlay/answers.ts`.

## 2. Render Decomposition

- [x] 2.1 Extract survey format containers into `apps/widget/src/surveyOverlay/components.tsx`.
- [x] 2.2 Extract question renderer variants into `apps/widget/src/surveyOverlay/components.tsx`.
- [x] 2.3 Preserve existing class/selector contracts for survey UI elements.

## 3. Controller Recomposition + Verification

- [x] 3.1 Recompose `apps/widget/src/SurveyOverlay.tsx` as orchestration-first controller.
- [x] 3.2 Run `pnpm --filter @opencom/widget typecheck`.
- [x] 3.3 Run `pnpm --filter @opencom/widget test`.
- [x] 3.4 Run `pnpm --filter @opencom/web typecheck`.
- [x] 3.5 Update refactor progress docs and remaining-map tracker.
