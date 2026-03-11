# Refactor Progress: Widget Survey Overlay Decomposition (2026-03-05)

## Scope

- `apps/widget/src/SurveyOverlay.tsx`
- `apps/widget/src/surveyOverlay/types.ts`
- `apps/widget/src/surveyOverlay/answers.ts`
- `apps/widget/src/surveyOverlay/components.tsx`
- `openspec/changes/decompose-widget-survey-overlay/*`

## Problem Addressed

`SurveyOverlay.tsx` bundled survey types, answer normalization, container layouts, and all question renderers in one file.

## What Was Refactored

1. Extracted survey overlay domain contracts into `surveyOverlay/types.ts`.
2. Extracted answer normalization helpers into `surveyOverlay/answers.ts`.
3. Extracted format containers and all question renderer variants into `surveyOverlay/components.tsx`.
4. Recomposed `SurveyOverlay.tsx` as orchestration-first controller (impression/start/submit/dismiss flow preserved).

## Result

- `apps/widget/src/SurveyOverlay.tsx` reduced to 245 lines (from ~723).
- Existing survey classnames/selectors and behavior are preserved.
- Survey orchestration remains stable while UI variants are isolated.

## Compatibility Notes (Web / Widget / Mobile / SDKs)

- No shared schema or endpoint contract changes.
- No `@opencom/types`/mobile/sdk contract changes.
- This is widget-local decomposition with cross-surface compatibility maintained.

## Verification

Passed:

- `pnpm --filter @opencom/widget typecheck`
- `pnpm --filter @opencom/widget test`
- `pnpm --filter @opencom/web typecheck`
