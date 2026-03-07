# Refactor Progress: Tour Runtime Shared Route Matching (2026-03-06)

## Scope

- `packages/types/src/routeMatching.ts`
- `packages/types/src/index.ts`
- `packages/convex/convex/tourProgress.ts`
- `apps/widget/src/TourOverlay.tsx`
- `apps/widget/src/tourOverlay/useTourOverlaySession.ts`
- `apps/widget/src/tourOverlay/useTourOverlayActions.ts`
- `apps/widget/src/test/routeMatching.test.ts`

## Problem Addressed

The tour runtime still had two avoidable sources of reasoning cost:

- route-matching behavior was duplicated between widget and Convex runtime code
- `TourOverlay.tsx` still mixed active-tour selection, backend mutations, step lifecycle state, DOM positioning, and rendering in one controller

That made multi-page tour behavior harder to trust and left the main widget runtime controller denser than it needed to be.

## What Was Refactored

1. Centralized route matching in `@opencom/types`:
   - added `normalizeRoutePath`
   - added `evaluateRouteMatch`
2. Switched both tour runtimes to the shared helper:
   - `apps/widget/src/TourOverlay.tsx`
   - `packages/convex/convex/tourProgress.ts`
3. Deleted the widget-local duplicate matcher:
   - `apps/widget/src/tourOverlay/routeMatching.ts`
4. Added focused matcher coverage in:
   - `apps/widget/src/test/routeMatching.test.ts`
5. Extracted active-tour session orchestration out of `TourOverlay.tsx` into `useTourOverlaySession`:
   - available/forced tour selection
   - suppression tracking
   - step lifecycle reset
   - local close/completion handling
6. Extracted mutation-driven tour actions out of `TourOverlay.tsx` into `useTourOverlayActions`:
   - advance
   - skip
   - checkpoint
   - dismiss
   - snooze
   - restart

## Result

- `apps/widget/src/TourOverlay.tsx` is down to `617` lines from `996`.
- `packages/convex/convex/tourProgress.ts` is down to `834` lines from the earlier `914`-line concentration point that drove the audit.
- Route matching is now authored once and consumed by both the widget and Convex tour runtimes.
- The remaining complexity inside `TourOverlay.tsx` is now much more clearly the DOM positioning/observer problem, not mixed runtime orchestration plus rendering plus mutation wiring.

## What Still Appears To Remain In This Track

- `apps/widget/src/TourOverlay.tsx` still owns the selector lookup, viewport geometry, scroll-settle, and observer wiring.
- `packages/convex/convex/tourProgress.ts` still mixes progression rules, diagnostics, checkpointing, and availability resolution.
- The next clean follow-up is either:
  - extract overlay positioning/observer behavior from `TourOverlay.tsx`, or
  - split `tourProgress.ts` by progression/diagnostic/query responsibilities

## Compatibility Notes

- Shared tour route-matching behavior now lives in `@opencom/types`.
- No Convex endpoint signatures changed.
- No widget-facing prop contracts changed.

## Verification

Passed:

- `pnpm --filter @opencom/types typecheck`
- `pnpm --filter @opencom/widget typecheck`
- `pnpm --filter @opencom/convex typecheck`
- `pnpm --filter @opencom/widget test -- --run src/test/routeMatching.test.ts src/test/tourOverlay.test.tsx`
- `pnpm --filter @opencom/widget test`

Not rerun:

- `pnpm --filter @opencom/convex test -- --run tests/tourProgress.test.ts`
  - package-local Vitest config excludes Convex integration suites unless `CONVEX_URL` is present, so the direct focused invocation resolves to `No test files found` in the current shell
