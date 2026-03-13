# Refactor Progress: Convex Tour Progress Decomposition (2026-03-07)

## Scope

- `packages/convex/convex/tourProgress.ts`
- `packages/convex/convex/tourProgressShared.ts`
- `packages/convex/convex/tourProgressAccess.ts`
- `packages/convex/convex/tourProgressMutations.ts`
- `packages/convex/convex/tourProgressQueries.ts`
- `packages/convex/tests/tourProgress.test.ts`

## Problem Addressed

The earlier tour-runtime work had already centralized route matching and reduced the widget-side controller, but the Convex progress backend was still concentrated in one mixed domain file.

`tourProgress.ts` still bundled:

- visitor authorization
- tour loading and progress lookup
- checkpoint construction
- diagnostic recording
- mutation progression rules
- availability and diagnostics queries

That made the backend tour runtime harder to reason about than the widget side after the March 6 decomposition pass.

## What Was Refactored

1. Extracted shared tour-progress helpers into `tourProgressShared.ts`:
   - auth/result types
   - checkpoint helpers
   - ordered-step loading
   - diagnostic persistence
2. Extracted visitor/tour/progress access helpers into `tourProgressAccess.ts`:
   - workspace tour validation
   - authenticated/widget visitor resolution
   - progress lookup
   - mutation-side context loading
3. Extracted all mutation handlers into `tourProgressMutations.ts`:
   - `start`
   - `advance`
   - `skipStep`
   - `checkpoint`
   - `complete`
   - `dismiss`
   - `snooze`
   - `restart`
   - `dismissPermanently`
4. Extracted the query handlers into `tourProgressQueries.ts`:
   - `getActive`
   - `getAvailableTours`
   - `listDiagnostics`
5. Reduced `tourProgress.ts` to Convex endpoint wiring plus shared validator fragments only.
6. Trimmed one small query inefficiency while extracting:
   - `getAvailableTours` now loads the visitor once per request when audience rules are present, instead of re-fetching the visitor inside every matching tour iteration

## Result

- `packages/convex/convex/tourProgress.ts` is down to `120` lines from `834`.
- Tour backend responsibilities are now split by purpose instead of mixed behind one endpoint file.
- Existing `api.tourProgress.*` endpoint names and argument shapes did not change.
- The remaining tour-runtime complexity is no longer an endpoint-wiring problem. It is now isolated mainly in:
  - `apps/widget/src/tourOverlay/useTourOverlayPositioning.ts`
  - secondarily `packages/convex/convex/tourProgressMutations.ts` if future feature work makes it regrow

## What Still Appears To Remain In This Track

- `useTourOverlayPositioning.ts` still owns a lot of selector, viewport, and observer behavior, even though it is now isolated.
- There is no obvious required follow-up inside the Convex tour-progress slice right now.
- Further tour-runtime work should be driven by a fresh hotspot or behavior change, not by the earlier concentrated-file shape alone.

## Compatibility Notes

- No Convex endpoint signatures changed.
- No schema or validator contracts changed.
- No widget-facing tour contracts changed.

## Verification

Passed:

- `pnpm --filter @opencom/convex typecheck`
- `bash -lc 'set -a; source packages/convex/.env.local; set +a; pnpm --filter @opencom/convex test -- --run tests/tourProgress.test.ts'`

Notes:

- The focused test needed network access to the configured Convex deployment.
- The run emitted stderr noise from remote `testing/helpers:*` lookups, but Vitest completed green with `14` tests passed.
