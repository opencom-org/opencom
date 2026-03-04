## Context

The RN SDK containers currently carry many responsibilities in single files: query orchestration, event handlers, rendering, derived state, and side effects. This creates long review cycles and hard-to-localize regressions for common changes.

## Goals / Non-Goals

**Goals:**
- Split large containers into domain hooks + presentational components.
- Keep behavior and public component API stable.
- Improve testability of data/state orchestration units.
- Reduce per-file cognitive load for SDK contributors.

**Non-Goals:**
- Redesigning messenger/survey UX.
- Rewriting Convex APIs.
- Migrating to a different navigation system.

## Decisions

### 1) Container-shell plus domain hooks pattern

Decision:
- Keep small shell components that compose domain hooks (messages, tabs, suggestions, survey progression) and render presentational subcomponents.

Rationale:
- Separates state orchestration from UI rendering for easier testing.

Alternatives considered:
- Split only JSX sections without extracting logic. Rejected because most complexity is orchestration, not markup.

### 2) Preserve existing public props and event semantics

Decision:
- Component prop signatures and callback semantics remain stable during refactor.

Rationale:
- Avoids breaking host app integrations.

Alternatives considered:
- Simultaneous API redesign. Rejected as too high risk.

### 3) Add behavior-lock tests for high-risk flows

Decision:
- Add tests for conversation send flow, AI indicator behavior, tab switching, and survey question progression.

Rationale:
- Ensures decomposition does not alter user-visible behavior.

## Risks / Trade-offs

- [Risk] Hook extraction could duplicate or fragment state ownership.
  - Mitigation: define single-owner state boundaries before extraction.
- [Risk] Increased file count may feel heavier initially.
  - Mitigation: domain naming conventions and concise module docs.

## Migration Plan

1. Define container domain boundaries and extract pure view components.
2. Extract orchestrator hooks one domain at a time.
3. Rewire container shells to compose extracted hooks/components.
4. Add parity tests for key messenger/survey flows.
5. Remove obsolete monolithic logic and document module ownership.

Rollback:
- Revert extraction slices while keeping existing shell APIs unchanged.

## Open Questions

- Should shared messenger/survey hook primitives be public exports or remain internal-only?
- Do we enforce a max file-size guideline for RN SDK container files?
