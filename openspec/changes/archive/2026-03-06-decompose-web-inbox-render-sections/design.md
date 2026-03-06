## Context

The inbox route already extracted core orchestration logic into hooks (`selection sync`, `compact panels`, `suggestions count`, `attention cues`, `message actions`). However, `page.tsx` still contains large render trees for:

- conversation list pane
- thread header/message list/composer overlays
- AI review panel

This keeps UI complexity concentrated in one route file and makes low-risk UI changes harder.

## Goals / Non-Goals

**Goals:**

- Extract inbox render sections into dedicated components with typed prop contracts.
- Keep `page.tsx` responsible for data orchestration, hook composition, and high-level responsive layout only.
- Preserve all current behavior, test IDs, and interaction semantics.

**Non-Goals:**

- Rewriting inbox UX.
- Changing Convex APIs or hook business logic.
- Introducing new inbox capabilities.

## Decisions

### 1) Extract by render responsibility boundaries

Decision:

- Create dedicated components for:
  - conversation list pane
  - thread pane (header + message list + composer overlays)
  - AI review panel

Rationale:

- These are the largest independent render regions and have clear ownership boundaries.

### 2) Keep all behavior-owning hooks in `page.tsx`

Decision:

- Continue calling orchestration hooks in `page.tsx` and pass state/actions to render components as props.

Rationale:

- Minimizes regression risk and keeps behavior decomposition from the prior slice intact.

### 3) Preserve existing test selectors and messaging semantics

Decision:

- Keep current `data-testid` values and rendering conditions unchanged where possible.

Rationale:

- Maintains compatibility with existing tests and avoids unnecessary E2E churn.

## Risks / Trade-offs

- [Risk] Prop contract drift and optional data shape mismatch.
  - Mitigation: explicit local interfaces for render props and strict web typecheck.
- [Risk] Regression in overlay toggles/composer shortcut behavior.
  - Mitigation: preserve callback wiring and existing keyboard/event handlers.

## Migration Plan

1. Extract local render prop types and conversation list component.
2. Extract thread pane component (including composer overlays).
3. Extract AI review panel component.
4. Recompose `page.tsx` and remove obsolete inline JSX.
5. Run focused verification and update refactor docs.

Rollback:

- Revert extracted render components and restore inline rendering in `page.tsx` if regressions appear.

## Open Questions

- Should the suggestions panel render wrapper also be extracted now, or kept inline until a follow-up inbox-sidecar slice?
