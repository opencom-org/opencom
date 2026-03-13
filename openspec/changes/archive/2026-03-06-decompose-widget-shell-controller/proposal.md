## Why

`apps/widget/src/Widget.tsx` (~1400 lines) mixes shell orchestration, query/mutation wiring, tab/header resolution, and large render branches for the tabbed shell and root surface.

This makes behavior-preserving changes difficult and increases regression risk for widget/web integration points.

## What Changes

- Extract widget shell domain types and pure helper functions into `widgetShell` modules.
- Extract large main-shell/tabbed-render sections into dedicated presentational components.
- Keep `Widget` as the stable orchestration entrypoint and preserve existing props/behavior.
- Preserve existing UI test selectors and tab behavior semantics.

## Capabilities

### New Capabilities

- `widget-shell-controller-modularity`: Widget shell controller logic is separated from large render sections and pure helper logic.

### Modified Capabilities

- None.

## Impact

- Affected code:
  - `apps/widget/src/Widget.tsx`
  - new modules under `apps/widget/src/widgetShell/`
- APIs:
  - No public `Widget` prop or event contract changes.
- Dependencies:
  - No new external dependencies.
