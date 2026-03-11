## Why

`packages/convex/convex/series.ts` currently mixes authoring APIs, runtime progression, scheduler wiring, and telemetry in a 2429-line module with 26 exports. This coupling raises regression risk in a critical automation path and makes safe refactors difficult.

## What Changes

- Split the monolithic series engine into focused modules for authoring CRUD, runtime progression, scheduler/event integration, and telemetry aggregation.
- Keep existing external function entry points stable while moving internals behind typed adapters.
- Preserve current progression behavior (wait states, retries, trigger evaluation, and completion/exit transitions).
- Add parity tests for representative progression and scheduler handoff paths before/after extraction.

## Capabilities

### New Capabilities

- `convex-series-engine-modularity`: The series engine is implemented as domain modules with stable contracts instead of one monolithic file.

### Modified Capabilities

- None.

## Impact

- Convex backend internals: `packages/convex/convex/series.ts` split into multiple series modules.
- Convex event/scheduler integrations that call series runtime functions.
- Convex tests for progression, retries, and trigger evaluation semantics.
