## Context

The widget shell currently combines validation gates, navigation, experience arbitration, unread cues, geolocation enrichment, and tab configuration in one component. This has already produced a hook-order lint violation and makes onboarding difficult because unrelated behavior changes are tightly coupled in one file.

The change must preserve production behavior: conversation flows, survey/tour/outbound blocking priority, workspace/origin validation gating, and callback bridge integration.

## Goals / Non-Goals

**Goals:**
- Remove hook-order hazards and enforce unconditional hook evaluation order.
- Break shell logic into maintainable modules with clear ownership boundaries.
- Preserve existing externally observable behavior and callback APIs.
- Improve local testability of widget shell orchestration decisions.

**Non-Goals:**
- Rewriting messenger feature components (conversation view, tours, surveys) end-to-end.
- Changing widget API surface (`OpencomWidget.init`, identify, callbacks).
- Re-theming or redesigning widget UI.

## Decisions

### 1) Introduce a shell orchestrator with deterministic hook order

Decision:
- Keep a thin `Widget` render container and move orchestration state into a dedicated shell hook (`useWidgetShellState`) that is always called before any early-return branches.

Rationale:
- Eliminates conditional hook declaration risk and localizes cross-domain state transitions.

Alternatives considered:
- Keep current structure and only move one `useCallback`: rejected because it fixes one lint error but leaves structural fragility.
- Rewrite with a global store immediately: rejected as unnecessary scope expansion for this refactor.

### 2) Extract domain-specific hooks for independent concerns

Decision:
- Partition shell responsibilities into focused hooks:
  - validation gating (workspace/origin),
  - blocking experience arbitration,
  - unread cue computation,
  - tab visibility/default selection,
  - geolocation enrichment.

Rationale:
- Each domain becomes independently testable and easier to evolve without touching unrelated logic.

Alternatives considered:
- Split only JSX into subcomponents: rejected because most complexity is state/effect orchestration, not markup.

### 3) Preserve runtime behavior through parity tests before/after split

Decision:
- Add targeted tests around:
  - blocking priority order (tour > outbound > large survey),
  - error-path rendering behavior,
  - callback registration/cleanup.

Rationale:
- Refactor confidence depends on behavioral equivalence, not just passing lint.

Alternatives considered:
- Rely only on manual QA: rejected due to high branching behavior and regressions seen in this file.

## Risks / Trade-offs

- [Risk] State ownership boundaries may be misassigned during extraction.
  - Mitigation: define hook contracts first (inputs/outputs) and migrate one domain at a time.
- [Risk] Blocking arbitration regressions can cause user-facing sequencing bugs.
  - Mitigation: add explicit orchestration tests and preserve existing priority constants.
- [Risk] Temporary duplication while moving logic may increase short-term complexity.
  - Mitigation: remove old logic immediately per domain extraction step; avoid parallel implementations.

## Migration Plan

1. Add shell orchestration hook scaffolding and move hook declarations ahead of render guards.
2. Extract validation, arbitration, and tab-selection domains incrementally with parity tests.
3. Run widget lint/typecheck/tests and targeted web/widget E2E checks where widget orchestration is exercised.
4. Remove obsolete in-file logic and finalize module boundaries.

Rollback:
- Keep extraction commits small so each domain can be reverted independently.
- If regressions appear, revert the latest domain split and retain the hook-order safety fix.

## Open Questions

- Should `Widget` keep a single orchestrator hook, or should we additionally expose a reducer module for external integration tests?
- Do we want a hard line-count guard in CI for `Widget.tsx` to prevent monolith regression?
