## Why

`apps/web/src/app/campaigns/series/[id]/page.tsx` combines orchestration, canvas rendering, sidebar controls, and inspector editing in one monolithic file. This increases regression risk for campaign-authoring updates.

## What Changes

- Extract series editor render sections into dedicated modules:
  - left sidebar controls/readiness
  - flow canvas
  - right inspector panel
- Keep page-level query/mutation orchestration and selection state in `page.tsx`.
- Preserve existing behavior for block CRUD, connection editing, readiness focus, and activation flow.

## Capabilities

### New Capabilities

- `web-series-editor-modularity`: Series editor render and local editing concerns are implemented through dedicated section modules.

### Modified Capabilities

- None.

## Impact

- Affected code:
  - `apps/web/src/app/campaigns/series/[id]/page.tsx`
  - new series editor modules under `apps/web/src/app/campaigns/series/[id]/`
- APIs:
  - No Convex API changes.
- Dependencies:
  - No new external dependencies.
