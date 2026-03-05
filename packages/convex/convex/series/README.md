# Series Domain Modules

This folder contains series orchestration internals split by responsibility.
`../series.ts` remains the stable entrypoint surface for `api.series.*` and `internal.series.*`.

## Ownership

- `contracts.ts`: shared validators, limits, runtime/readiness types, and status constants.
- `shared.ts`: cross-cutting helpers (permissions, graph loading, runtime guards, normalization, sorting).
- `authoring.ts`: authoring APIs and activation readiness validation.
- `runtime.ts`: progression engine, trigger evaluation, wait/retry transitions, and scheduler-driven handlers.
- `telemetry.ts`: block telemetry upserts and progress/stats/telemetry queries.
- `scheduler.ts`: typed internal scheduler/runtime adapters.

## Extension Patterns

- Keep authoring-only behavior changes in `authoring.ts` so runtime progression logic remains isolated.
- Add progression-state changes in `runtime.ts` and keep scheduler calls routed through `scheduler.ts`.
- Keep analytics counters and read-model aggregation in `telemetry.ts`; runtime should call telemetry helpers instead of patching rows directly.
- Add shared validators/contracts in `contracts.ts` before introducing new cross-module call paths.

## Cross-Surface Notes

- This refactor is backend-internal and preserves all existing Convex function names and payload contracts.
- No behavior/API contract changes are required for `apps/web`, `apps/widget`, `apps/mobile`, `packages/sdk-core`, or `packages/sdk-react-native`.
- If future work requires shared client behavior changes, update shared contracts/specs first, then consume those contracts per surface.
