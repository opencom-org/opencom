## Context

The series editor route currently owns:

- mutation orchestration and selection state
- sidebar add-block/connection/rules/readiness/analytics rendering
- canvas rendering for blocks and connections
- inspector rendering for selected block/connection editing

This one-file approach makes routine editor changes expensive to review and maintain.

## Goals / Non-Goals

**Goals:**

- Split large render sections into focused components with explicit typed props.
- Keep business orchestration behavior unchanged.
- Reduce `page.tsx` to orchestration and top-level composition.

**Non-Goals:**

- Changing series editor UX.
- Changing block semantics or readiness logic.
- Changing Convex function signatures or payload contracts.

## Decisions

### 1) Extract by pane boundaries

Decision:

- Create dedicated components for sidebar, canvas, and inspector panes.

Rationale:

- Existing layout is already pane-oriented, making extraction low-risk.

### 2) Keep mutation hooks and selection state in page orchestration

Decision:

- Keep query/mutation calls and selection ids in `page.tsx`, passing handlers/data to child panes.

Rationale:

- Preserves existing behavior paths while reducing render coupling.

### 3) Preserve helper utilities and convert to shared local module where needed

Decision:

- Move reusable type/util helpers out of `page.tsx` into a local `seriesEditorTypes` module.

Rationale:

- Keeps pane components cohesive and avoids cross-file type duplication.

## Risks / Trade-offs

- [Risk] Prop wiring errors between pane components.
  - Mitigation: strict type contracts and focused web typecheck/tests.
- [Risk] Regression in selected-block/connection editing flow.
  - Mitigation: preserve selection callbacks and existing editor test selectors where present.

## Migration Plan

1. Extract series editor types/helpers.
2. Extract sidebar/canvas/inspector panes into dedicated components.
3. Recompose `page.tsx` with extracted panes.
4. Run focused verification and document progress.

Rollback:

- Revert extracted pane components and re-inline rendering in `page.tsx` if regressions are found.

## Open Questions

- Should block-type configuration editors (wait/email/push/tag/rules) be split into per-type components now or in a follow-up slice?
