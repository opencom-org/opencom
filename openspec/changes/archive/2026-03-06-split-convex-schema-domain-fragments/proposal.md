## Why

`packages/convex/convex/schema.ts` has grown into a ~2000-line single module with unrelated domains co-located. This increases review cost and makes schema updates risky.

## What Changes

- Split monolithic Convex schema table definitions into domain fragment modules under `packages/convex/convex/schema/`.
- Keep `schema.ts` as a thin composition layer that aggregates fragments into `defineSchema`.
- Preserve table names, validators, indexes, and final schema behavior.

## Capabilities

### New Capabilities

- `convex-schema-domain-fragments`: Convex schema table definitions are organized by domain fragments with a stable composition entrypoint.

### Modified Capabilities

- None.

## Impact

- Affected code:
  - `packages/convex/convex/schema.ts`
  - new schema fragment files under `packages/convex/convex/schema/`
- APIs:
  - No Convex function signature changes.
  - No table/index naming changes.
- Dependencies:
  - No new external dependencies.
