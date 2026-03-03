## Why

`apps/widget/src/Widget.tsx` is currently a large orchestration file and currently fails `react-hooks/rules-of-hooks` due to hook declaration order. The file size and cross-cutting concerns are slowing contributor velocity and increasing regression risk in core messenger behavior.

## What Changes

- Fix hook ordering so all hooks are evaluated unconditionally before render-time error branches.
- Decompose widget shell responsibilities into focused domain hooks/modules (navigation, blocking experiences, validation, unread cues, tab/home config).
- Introduce a dedicated shell-state orchestrator to reduce scattered local state transitions.
- Preserve existing runtime behavior for view transitions, blocking priority, and session-driven flows while improving internal structure.
- Add targeted regression tests for hook safety and orchestration parity.

## Capabilities

### New Capabilities
- `widget-shell-modularity`: The widget shell is organized into explicit modules with stable hook invocation and clearly owned responsibilities.

### Modified Capabilities
- None.

## Impact

- Widget app internals: `apps/widget/src/Widget.tsx` and new `apps/widget/src/hooks/*` or `apps/widget/src/lib/*` shell modules.
- Widget tests: focused tests around shell orchestration, blocking-order behavior, and error-path rendering.
- Build/lint quality: removes current hook-order lint failure and strengthens future contributor safety.
