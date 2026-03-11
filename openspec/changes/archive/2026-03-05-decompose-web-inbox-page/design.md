## Context

The inbox page is a central operator workflow and currently owns many independent responsibilities: URL/query synchronization, selection state, compact sidecar state, suggestion count fetching, title updates, unread cue suppression, and action mutations. The file is difficult to reason about as a single unit and has a high chance of merge conflicts and subtle regressions.

The refactor must preserve existing behavior for routing, conversation selection, compact experience, and notification cues.

## Goals / Non-Goals

**Goals:**
- Split inbox orchestration into explicit domain hooks/modules with narrow contracts.
- Keep page-level composition simple and easy to extend.
- Preserve user-visible behavior and existing API interactions.
- Improve testability of inbox state transitions and side effects.

**Non-Goals:**
- Rebuilding the inbox UI design.
- Replacing existing backend APIs or mutation/query semantics.
- Re-architecting message editor or suggestion panel UX from scratch.

## Decisions

### 1) Domain hooks for orchestration, page for composition

Decision:
- Keep `page.tsx` as a composition layer and extract domain behavior into hooks:
  - `useInboxSelectionSync` (URL <-> selected conversation),
  - `useInboxAttentionCues` (title/cue/snapshot behavior),
  - `useInboxSuggestions` (count fetching and loading/error handling),
  - `useInboxCompactPanels` (compact sidecar open/close rules).

Rationale:
- Separates behavior into units that can be tested independently and changed with lower blast radius.

Alternatives considered:
- Split only JSX into subcomponents: rejected because complexity is mostly state/effect orchestration.

### 2) Preserve existing URL contract as a first-class invariant

Decision:
- Define and test a stable URL-sync contract so `conversationId` query behavior remains unchanged during refactor.

Rationale:
- Deep-linking and shareable state are core operational workflows; any silent contract drift is high impact.

Alternatives considered:
- Simplify by removing URL sync: rejected due to workflow regression risk.

### 3) Introduce focused parity tests for extracted hooks

Decision:
- Add tests for:
  - selected conversation/query synchronization,
  - compact panel reset conditions,
  - unread cue suppression logic and title updates.

Rationale:
- Behavior preservation is easier to verify through hook-level tests than broad page snapshots.

Alternatives considered:
- Depend only on existing E2E flows: rejected because coverage is too broad for quick refactor feedback.

## Risks / Trade-offs

- [Risk] Extracted hooks may accidentally duplicate state ownership.
  - Mitigation: define single-owner state boundaries before extraction and enforce via hook contracts.
- [Risk] Query-sync regressions can break deep-link workflows.
  - Mitigation: add dedicated tests for route/query transitions and keep existing URL shape unchanged.
- [Risk] More files increase perceived complexity.
  - Mitigation: group by domain with clear naming and keep each module small and purpose-specific.

## Migration Plan

1. Introduce hook/module scaffolding with current behavior copied as-is.
2. Migrate one behavior domain at a time into hooks while keeping page output unchanged.
3. Add/adjust focused tests for each migrated domain.
4. Remove obsolete page-local effect/state logic and finalize composition structure.

Rollback:
- Revert individual domain extraction commits without undoing unrelated refactor progress.
- Keep behavior parity tests to quickly detect and isolate regressions.

## Open Questions

- Should we create an `inbox/state/` folder boundary now, or defer until after this decomposition stabilizes?
- Do we want a maximum line-count guard for page-level route components to prevent future monolith growth?
