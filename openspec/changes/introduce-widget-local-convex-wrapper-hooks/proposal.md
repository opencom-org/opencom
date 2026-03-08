## Why

The widget runtime and overlay surfaces perform many direct `useQuery`, `useMutation`, and related hook calls against generated Convex API refs inside runtime controllers, shell modules, and feature components. As widget behavior expands across messaging, tours, surveys, outbound, checklists, and authoring overlays, direct generated hook usage increases coupling between runtime orchestration and transport details, makes type complexity harder to contain, and raises the cost of safely refactoring central widget modules.

## What Changes

- Introduce widget-local typed Convex wrapper hooks that isolate generated API ref usage behind app-owned widget modules.
- Add a minimal widget-local adapter boundary, where needed, so unavoidable type escape hatches stay out of central runtime and overlay modules.
- Provide explicit domain wrapper hooks for high-churn widget areas first, including session/bootstrap, conversation flows, home/help content, tours, outbound, surveys, and authoring overlays.
- Allow central widget controller/runtime hooks to compose domain wrappers while keeping runtime-state and navigation concerns separate from data-access typing concerns.
- Preserve existing widget behavior, API targets, payload semantics, visitor-visible capabilities, and embedding/runtime integrations.

## Capabilities

### New Capabilities
- `widget-local-convex-wrapper-hooks`: Covers widget-local typed wrapper hooks that isolate generated Convex hook complexity from widget runtime and overlay modules.

### Modified Capabilities
- `widget-runtime-state-boundaries`: Clarify that widget runtime-state decomposition may depend on a dedicated local data-access wrapper layer rather than embedding generated Convex hook details in runtime modules.
- `widget-shell-controller-modularity`: Extend controller modularity expectations to support explicit separation between data-access wrappers and runtime orchestration.

## Impact

- Affected code: `apps/widget/src/Widget.tsx`, runtime hooks, overlay/controller modules, local widget hooks, and targeted widget tests.
- Affected contributors: widget runtime, shell, overlay, and embedded authoring contributors.
- Dependencies: no external dependency changes; widget-local hook boundaries and typing conventions will be introduced.
