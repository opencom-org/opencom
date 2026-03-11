## Why

`packages/convex/convex/visitors.ts` combines visitor identity mutations, directory queries, merge/audit helpers, and permissions logic in one large module (~1070 lines). This increases merge conflict and regression risk.

## What Changes

- Extract visitors domain into dedicated modules under `packages/convex/convex/visitors/`:
  - shared validators/helpers
  - core visitor queries
  - directory/history/detail queries
  - identify/location/heartbeat mutations
- Keep `packages/convex/convex/visitors.ts` as the stable public entrypoint via re-exports.
- Preserve existing Convex function names/signatures and behavior.

## Capabilities

### New Capabilities

- `convex-visitors-domain-modularity`: Visitors domain concerns are implemented through dedicated modules with shared helpers.

### Modified Capabilities

- None.

## Impact

- Affected code:
  - `packages/convex/convex/visitors.ts`
  - new modules under `packages/convex/convex/visitors/`
- APIs:
  - No endpoint name/signature changes.
- Dependencies:
  - No new external dependencies.
