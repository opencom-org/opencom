# Refactor Progress: Web Survey Editor Decomposition (2026-03-05)

## Scope

- `apps/web/src/app/surveys/[id]/page.tsx`
- `apps/web/src/app/surveys/[id]/surveyEditorTypes.ts`
- `apps/web/src/app/surveys/[id]/useSurveyQuestionEditor.ts`
- `apps/web/src/app/surveys/[id]/SurveyBuilderTab.tsx`
- `apps/web/src/app/surveys/[id]/SurveyTargetingTab.tsx`
- `apps/web/src/app/surveys/[id]/SurveySettingsTab.tsx`
- `apps/web/src/app/surveys/[id]/SurveyAnalyticsTab.tsx`
- `apps/web/src/app/surveys/[id]/useSurveyQuestionEditor.test.tsx`

## Problem Addressed

`surveys/[id]/page.tsx` combined survey editor orchestration, question business logic, and all tab UIs in one large file.

## What Was Refactored

1. Extracted shared survey-editor contracts/constants into `surveyEditorTypes.ts`.
2. Extracted question CRUD/reorder/default-option logic into `useSurveyQuestionEditor`.
3. Extracted each tab body into focused components:
   - `SurveyBuilderTab`
   - `SurveyTargetingTab`
   - `SurveySettingsTab`
   - `SurveyAnalyticsTab`
4. Re-composed `page.tsx` as orchestration + header + tab switching.
5. Added focused tests for extracted question-editor behavior/defaults.

## Result

- `apps/web/src/app/surveys/[id]/page.tsx` reduced to 344 lines (from ~1252 lines).
- Survey editor behavior remains functionally equivalent for save/status/export and tab interactions.
- Question editing behavior now has focused unit coverage.

## Compatibility Notes (Mobile / SDK / Convex)

- No Convex endpoint signatures changed.
- No shared package public API changes in `@opencom/types`, `@opencom/sdk-core`, or RN SDK packages.
- This slice is web-only internal decomposition.

## Verification

Passed:

- `pnpm --filter @opencom/web typecheck`
- `pnpm --filter @opencom/web test -- 'src/app/surveys/[id]/useSurveyQuestionEditor.test.tsx'`
