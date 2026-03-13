# Refactor Progress: Widget Tour Overlay Controller Decomposition (2026-03-05)

## Scope

- `apps/widget/src/TourOverlay.tsx`
- `apps/widget/src/tourOverlay/types.ts`
- `apps/widget/src/tourOverlay/routeMatching.ts`
- `apps/widget/src/tourOverlay/messages.ts`
- `apps/widget/src/tourOverlay/viewport.ts`
- `apps/widget/src/tourOverlay/components.tsx`
- `openspec/changes/decompose-widget-tour-overlay-controller/*`

## Problem Addressed

`TourOverlay.tsx` combined domain contracts, route matching, viewport/tooltip positioning logic, state/mutation orchestration, and large render branches in one controller file.

## What Was Refactored

1. Extracted tour domain types into a dedicated module.
2. Extracted pure route-matching helpers and advance/block guidance helpers.
3. Extracted viewport/scroll constants + utility helpers.
4. Extracted render-heavy sections into presentational components:
   - emergency close button
   - recovery and route-hint modals
   - pointer/post card variants
   - backdrop/highlight layers
   - confetti layer
5. Recomposed `TourOverlay.tsx` as orchestration-first controller using imported helpers/components.

## Result

- `apps/widget/src/TourOverlay.tsx` reduced to 996 lines (from ~1428).
- Existing `TourOverlay` props contract and mutation orchestration remain stable.
- Existing test IDs (`tour-overlay`, `tour-step-card`, `tour-primary-action`, `tour-recovery-hint`, etc.) are preserved.

## Compatibility Notes (Web / Widget / Mobile / SDKs)

- No shared type package contract changes.
- No Convex API changes.
- Web embedding expectations remain compatible (validated with web typecheck).
- Mobile and SDK plans remain unchanged because this slice is widget-local decomposition.

## Verification

Passed:

- `pnpm --filter @opencom/widget typecheck`
- `pnpm --filter @opencom/widget test -- --run src/test/tourOverlay.test.tsx`
- `pnpm --filter @opencom/web typecheck`
- `openspec validate decompose-widget-tour-overlay-controller --strict --no-interactive`
