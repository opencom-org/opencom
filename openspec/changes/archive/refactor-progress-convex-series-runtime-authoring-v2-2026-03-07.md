# Refactor Progress: Convex Series Runtime / Authoring Phase 2 (2026-03-07)

## Scope

- `packages/convex/convex/series/authoring.ts`
- `packages/convex/convex/series/runtime.ts`
- `packages/convex/convex/series/readiness.ts`
- `packages/convex/convex/series/runtimeProgressState.ts`
- `packages/convex/convex/series/runtimeExecution.ts`
- `packages/convex/convex/series/runtimeProcessing.ts`
- `packages/convex/convex/series/runtimeEnrollment.ts`

## Problem Addressed

The series backend domain had become one of the clearest remaining concentration points:

- `runtime.ts` mixed enrollment/trigger matching, status transitions, progress history, block execution, scheduling, retries, and telemetry
- `authoring.ts` still embedded the full readiness evaluator alongside CRUD/query mutations

That made the runtime path harder to reason about and forced authoring/runtime invariants to stay mentally coupled.

## What Was Refactored

1. Extracted authoring readiness evaluation into `readiness.ts`:
   - graph-entry validation
   - block-level config validation
   - workspace delivery prerequisites
   - warning/blocker result assembly
2. Extracted runtime stats/history/status transitions into `runtimeProgressState.ts`:
   - `applySeriesStatsDelta`
   - `transitionProgressStatus`
   - `appendProgressHistory`
3. Extracted runtime block execution into `runtimeExecution.ts`:
   - connection selection
   - wait duration resolution
   - tag mutation handling
   - content-delivery adapter checks
   - current-block execution
4. Extracted runtime progress engine into `runtimeProcessing.ts`:
   - wait resumption
   - exit/goal transitions
   - retry scheduling
   - telemetry updates
   - block-to-block advancement
5. Extracted runtime enrollment/trigger matching into `runtimeEnrollment.ts`:
   - entry-trigger matching
   - idempotency context derivation
   - initial progress insert/dedup
6. Rewired `runtime.ts` and `authoring.ts` to act as orchestration entry points over those focused helpers.

## Result

- `packages/convex/convex/series/runtime.ts` is down to `210` lines from `1078`.
- `packages/convex/convex/series/authoring.ts` is down to `482` lines from `784`.
- The series backend is now split into clearer responsibility boundaries:
  - authoring/readiness
  - enrollment
  - progress-state bookkeeping
  - block execution
  - progress processing
- The main remaining complexity is now spread across focused modules instead of hidden inside two oversized files.

## What Still Appears To Remain In This Track

- `runtimeExecution.ts` and `runtimeProcessing.ts` are still meaningful logic concentrations, though they are now isolated by purpose rather than mixed into one controller.
- If this domain gets another pass, the next clean slice is likely:
  - trimming block-specific adapters further, or
  - isolating exit/goal/wait progression branches inside `runtimeProcessing.ts`
- This track is now at a reasonable stop point unless a new bug or change request lands directly in series orchestration.

## Compatibility Notes

- No public Convex endpoint names changed.
- No series contract validators changed.
- No series schema shape changed.

## Verification

Passed:

- `pnpm --filter @opencom/convex typecheck`

Blocked by environment:

- `bash -lc 'set -a; source packages/convex/.env.local; set +a; pnpm --filter @opencom/convex test -- --run tests/series.test.ts tests/seriesRuntimeProgression.test.ts'`
  - integration suites reached live Convex connectivity setup but failed with repeated WebSocket handshake errors (`Received network error or non-101 status code`) before the series assertions completed

Additional note:

- A direct package-local `pnpm exec vitest ...` attempt also hit a local optional Rollup dependency resolution problem (`@rollup/rollup-darwin-arm64` missing), so the repo-root test invocation above was the more reliable check path in this shell
