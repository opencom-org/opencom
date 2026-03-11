## Why

The widget runtime coordinates navigation, tab visibility, home configuration, tracking, overlays, and session-adjacent state across multiple modules. As this logic grows, contributors have to understand too many cross-cutting concerns at once, which increases regression risk and makes feature work harder to land safely.

## What Changes

- Clarify runtime state boundaries in the widget between navigation/view state, capability resolution, and side-effect/tracking behavior.
- Reduce central state sprawl by moving widget runtime concerns into clearer domain modules.
- Preserve current widget behavior, routing/view semantics, and runtime integrations while improving maintainability.
- Make future widget changes easier to localize and test.

## Capabilities

### New Capabilities
- `widget-runtime-state-boundaries`: Covers explicit maintainable boundaries for widget runtime state domains and transitions.

### Modified Capabilities
- `widget-shell-controller-modularity`: Extend shell-controller modularity expectations to cover clearer ownership of navigation and capability coordination.
- `widget-shell-modularity`: Clarify modularity expectations for runtime state orchestration across the widget shell.

## Impact

- Affected code: `apps/widget/src/components/WidgetContext.tsx`, runtime hooks, tab visibility logic, home/configuration coordination, and adjacent shell modules.
- Affected contributors: widget shell and runtime feature contributors.
- Dependencies: no intended product behavior changes; internal state ownership and module boundaries will change.
