# Refactor Progress: Web Tour Editor Decomposition (2026-03-06)

## Slice

- `decompose-web-tour-editor` (P0, completed)

## Why

`apps/web/src/app/tours/[id]/page.tsx` owned route orchestration, step CRUD UI, settings UI, modal validation, and selector/route diagnostics in one file.
This pass splits the tour editor along existing feature boundaries so shared local business logic is centralized and panel-level UI changes no longer require editing a single monolith.

## What Changed In This Pass

1. Added a dedicated local tour editor contracts/helpers module:
   - `apps/web/src/app/tours/[id]/tourEditorTypes.ts`
   - Extracted:
     - shared tour editor types (`StepFormData`, display mode, saved step/tour aliases)
     - step defaults and hydration helpers
     - route normalization and consistency warnings
     - selector diagnostics and save-data normalization
2. Added focused tour editor UI modules:
   - `apps/web/src/app/tours/[id]/TourStepTypeIcon.tsx`
   - `apps/web/src/app/tours/[id]/TourEditorStepsPanel.tsx`
   - `apps/web/src/app/tours/[id]/TourEditorSettingsPanel.tsx`
   - `apps/web/src/app/tours/[id]/TourStepModal.tsx`
3. Rebuilt the route page around orchestration only:
   - `apps/web/src/app/tours/[id]/page.tsx`
   - Kept Convex hooks, save/toggle/authoring handlers, and top-level tab state in the page.
   - Moved render-heavy sections and modal diagnostics into dedicated modules.
4. Added focused regression coverage for extracted business logic:
   - `apps/web/src/app/tours/[id]/tourEditorTypes.test.ts`

## Verification Run Notes

Executed in this pass:

- `pnpm --filter @opencom/web test -- --run 'src/app/tours/[id]/tourEditorTypes.test.ts'` -> pass
- `pnpm --filter @opencom/web typecheck` -> pass
- `bash scripts/build-widget-for-tests.sh` -> pass
- `pnpm web:test:e2e -- apps/web/e2e/tours.spec.ts --project=chromium` -> pass (`2 passed`, `0 unexpected`)

## Notes

- The tour editor page hit the same Convex generated-type depth limit already seen in other web routes. The fix stays localized at the hook boundary in `page.tsx` with `@ts-ignore` comments, keeping extracted editor modules free of generated API type churn.
- This slice preserves existing tour authoring UX and test selectors while materially reducing page concentration.
