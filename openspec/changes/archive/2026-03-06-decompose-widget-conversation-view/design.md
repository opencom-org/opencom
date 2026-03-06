## Context

`ConversationView.tsx` currently contains:

- constants + helper utilities
- query/action orchestration
- AI/handoff/feedback behaviors
- full message-list markup
- full footer-state markup

This concentration couples visual updates to orchestration-heavy logic.

## Goals / Non-Goals

**Goals:**

- Move pure helpers/types/constants out of `ConversationView`.
- Move large render branches into dedicated presentational modules.
- Preserve existing conversation behavior and selectors.

**Non-Goals:**

- Changing message delivery behavior.
- Changing AI/handoff logic semantics.
- Changing public `ConversationView` props.

## Decisions

### 1) Extract helper/type modules under `components/conversationView/`

Decision:

- Move constants and pure helpers into dedicated files (`constants`, `helpers`, `types`).

Rationale:

- Improves reuse and local reasoning for message/agent labeling logic.

### 2) Extract message-list and footer render sections

Decision:

- Move large message-list + footer branches to presentational components and pass controller-derived props.

Rationale:

- Reduces controller rendering complexity while preserving event wiring.

### 3) Keep controller orchestration in `ConversationView`

Decision:

- Keep query/action hooks and state transitions in `ConversationView.tsx`.

Rationale:

- Maintains existing integration semantics with minimal risk.

## Risks / Trade-offs

- [Risk] Prop surface growth for presentational components.
  - Mitigation: pass explicit props and keep business logic in controller.
- [Risk] Markup drift affecting selectors.
  - Mitigation: preserve existing class names/test IDs and run widget tests.

## Migration Plan

1. Extract helper/type modules.
2. Extract message list/footer components.
3. Recompose `ConversationView.tsx`.
4. Run widget typecheck + widget tests + web typecheck.
5. Update refactor docs.

Rollback:

- Inline extracted components/helpers back into `ConversationView.tsx`.
