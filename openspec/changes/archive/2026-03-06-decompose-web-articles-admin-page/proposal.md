## Why

`apps/web/src/app/articles/page.tsx` mixes article CRUD orchestration, markdown import/export workflows, filter derivation, and all render sections in one monolithic route file. This makes changes hard to review and increases regression risk.

## What Changes

- Extract shared articles-admin contracts/helpers into dedicated local modules.
- Split the route UI into focused section components:
  - markdown import/export/history section
  - filters + article table section
  - delete confirmation dialog
- Keep query/mutation orchestration and workflow handlers in `page.tsx`.
- Preserve existing behavior and test selectors for import/export and article actions.

## Capabilities

### New Capabilities

- `web-articles-admin-modularity`: Articles admin route render concerns are implemented through dedicated section modules with shared local contracts.

### Modified Capabilities

- None.

## Impact

- Affected code:
  - `apps/web/src/app/articles/page.tsx`
  - new articles-admin modules under `apps/web/src/app/articles/`
- APIs:
  - No Convex API changes.
- Dependencies:
  - No new external dependencies.
