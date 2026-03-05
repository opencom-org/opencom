# Runtime Type Hardening Notes (2026-03-05)

## Scope

This pass hardens runtime-critical Convex paths in:

- `packages/convex/convex/events.ts`
- `packages/convex/convex/series.ts`
- `packages/convex/convex/lib/authWrappers.ts`
- `packages/types/src/index.ts` (series rule payload shapes)

## Approved Dynamic Escape Hatches

Dynamic behavior is still allowed at explicit boundaries, but should remain isolated:

1. Convex internal function references:
   - Use typed adapter helpers (`packages/convex/convex/lib/seriesRuntimeAdapter.ts`) instead of inline broad casts.
2. External/untyped payload ingress:
   - Keep dynamic validation at validators or parser boundaries and convert to typed structures before runtime orchestration.
3. Generated Convex type boundaries:
   - Prefer local typed wrappers/adapters over `as any` in runtime modules.

## Migration Summary

- Replaced inline `(internal as any).series.*` calls with typed adapter functions in `events.ts` and `series.ts`.
- Removed broad `as any` returns in `authWrappers.ts` by tightening generic wrapper contracts around typed args.
- Narrowed shared series-facing payload types in `@opencom/types`:
  - `Series.entryRules`, `Series.exitRules`, `Series.goalRules`
  - `SeriesBlockConfig.rules`
  - these now use explicit `AudienceRuleOrSegment` structures instead of `unknown`.

## Guardrails Added

- Source-level guard test: `packages/convex/tests/runtimeTypeHardeningGuard.test.ts`
  - blocks broad `as any` in covered modules.
  - verifies series runtime calls use typed adapter helpers.

## Follow-up Opportunities

1. Extend adapter pattern to other dynamic internal invocation hotspots outside `events` and `series`.
2. Gradually replace remaining broad `unknown` fields in shared types where runtime consumers depend on known structure.
3. Add lint-level rule exceptions/allowlist to enforce no-new-`as any` in runtime-critical modules.
