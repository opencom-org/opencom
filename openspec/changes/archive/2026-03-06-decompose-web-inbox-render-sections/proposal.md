## Why

`apps/web/src/app/inbox/page.tsx` still keeps large render trees for conversation list, thread/composer overlays, and AI review/suggestions side panels in one file. Even with orchestration hooks extracted, UI changes remain high-risk because concerns are still tightly co-located.

## What Changes

- Extract inbox render sections into dedicated components:
  - conversation list pane
  - thread pane and composer overlays
  - AI review panel
- Keep `page.tsx` focused on orchestration/data wiring and high-level layout composition.
- Preserve existing inbox behavior, panel rules, and action handlers.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `web-inbox-modularity`: Extend modularity requirements to include render-layer section decomposition in addition to orchestration hooks.

## Impact

- Affected code:
  - `apps/web/src/app/inbox/page.tsx`
  - new inbox render section components under `apps/web/src/app/inbox/`
- APIs:
  - No Convex API changes.
- Dependencies:
  - No new external dependencies.
