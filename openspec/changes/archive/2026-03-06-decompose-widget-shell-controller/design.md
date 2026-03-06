## Context

`Widget.tsx` currently contains:

- Shell/domain types and normalization helpers
- Query/mutation orchestration
- Tab header resolution and visibility branching
- Large main-shell and root-surface JSX branches

The mixed concerns create high coupling for changes that should be isolated.

## Goals / Non-Goals

**Goals:**

- Move pure shell helpers/types out of the main controller file.
- Extract main shell render sections into dedicated presentational components.
- Keep `Widget` as the orchestration boundary with unchanged props.
- Preserve existing tab behavior and unread/overlay integration semantics.

**Non-Goals:**

- Changing product behavior or navigation semantics.
- Changing Convex endpoint contracts.
- Rewriting existing hooks architecture.

## Decisions

### 1) Extract `widgetShell` domain helpers and types

Decision:

- Move shell-level types/helpers (view and ticket form helpers, tab header resolution helpers) into `apps/widget/src/widgetShell/`.

Rationale:

- Keeps business-rule helpers independent and easier to test/reuse.

### 2) Extract tabbed shell render into dedicated component

Decision:

- Move `renderMainShell` JSX branch into `widgetShell/WidgetMainShell.tsx` with explicit props.

Rationale:

- Reduces controller size while preserving orchestration ownership in `Widget.tsx`.

### 3) Keep overlays and orchestration flow in `Widget`

Decision:

- Keep session, mutation orchestration, blocking arbitration, and overlay sequencing in `Widget.tsx`.

Rationale:

- Maintains a single top-level coordination boundary while reducing render complexity.

## Risks / Trade-offs

- [Risk] Prop-drilling complexity into extracted view components.
  - Mitigation: extract only high-value render branches and keep props explicit.
- [Risk] Behavior drift in tab/header actions.
  - Mitigation: preserve branching logic and run focused widget shell tests.

## Migration Plan

1. Extract shell types/helpers.
2. Extract main shell render component(s).
3. Recompose `Widget.tsx` using extracted modules.
4. Run widget typecheck + focused tests + web typecheck.
5. Update refactor progress docs and remaining-map tracker.

Rollback:

- Inline extracted view/helper modules back into `Widget.tsx`.
