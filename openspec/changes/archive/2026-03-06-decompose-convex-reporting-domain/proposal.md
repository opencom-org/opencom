## Why

`packages/convex/convex/reporting.ts` currently combines conversation metrics, agent metrics, CSAT flows, AI metrics, snapshot caching, and dashboard summary logic in a single ~1200-line module.

## What Changes

- Split reporting domain into dedicated modules under `packages/convex/convex/reporting/`.
- Extract shared reporting access/limit/date helpers into a common helper module.
- Keep `packages/convex/convex/reporting.ts` as a stable re-export entrypoint.
- Preserve existing query/mutation names, args, and behavior.

## Capabilities

### New Capabilities

- `convex-reporting-domain-modularity`: Reporting domain endpoints are implemented via dedicated modules with shared helper contracts.

### Modified Capabilities

- None.

## Impact

- Affected code:
  - `packages/convex/convex/reporting.ts`
  - new modules under `packages/convex/convex/reporting/`
- APIs:
  - No endpoint name/signature changes.
- Dependencies:
  - No new external dependencies.
