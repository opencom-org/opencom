# Refactor Progress: Web Series Editor Decomposition (2026-03-05)

## Scope

- `apps/web/src/app/campaigns/series/[id]/page.tsx`
- `apps/web/src/app/campaigns/series/[id]/seriesEditorTypes.ts`
- `apps/web/src/app/campaigns/series/[id]/seriesBlockUi.tsx`
- `apps/web/src/app/campaigns/series/[id]/SeriesEditorSidebar.tsx`
- `apps/web/src/app/campaigns/series/[id]/SeriesEditorCanvas.tsx`
- `apps/web/src/app/campaigns/series/[id]/SeriesEditorInspector.tsx`

## Problem Addressed

`series/[id]/page.tsx` previously combined orchestration and all three editor panes in one monolithic file.

## What Was Refactored

1. Extracted shared series editor contracts/utilities into `seriesEditorTypes.ts`.
2. Extracted block presentation helpers into `seriesBlockUi.tsx`.
3. Extracted left sidebar controls/readiness/analytics into `SeriesEditorSidebar`.
4. Extracted flow canvas rendering into `SeriesEditorCanvas`.
5. Extracted right inspector rendering into `SeriesEditorInspector`.
6. Recomposed `page.tsx` as query/mutation orchestration + pane composition.

## Result

- `apps/web/src/app/campaigns/series/[id]/page.tsx` reduced to 460 lines (from ~1204 lines).
- Existing block/connection/readiness/activation behavior is preserved with clearer module boundaries.

## Compatibility Notes (Mobile / SDK / Convex)

- No Convex API signatures changed.
- No shared package API changes (`apps/mobile`, `packages/sdk-core`, RN SDK unaffected).
- This slice is web-only editor decomposition.

## Verification

Passed:

- `pnpm --filter @opencom/web typecheck`

Notes:

- No dedicated series-editor unit test file currently exists in `apps/web`; verification relied on strict TypeScript checks for this slice.
