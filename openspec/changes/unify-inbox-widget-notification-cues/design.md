## Context

Web inbox and widget both detect unread increases and decide when to suppress attention cues. The logic is conceptually similar but currently duplicated. Small differences can be valid, but hidden divergence in core decision paths makes debugging noisy and behavior inconsistent.

## Goals / Non-Goals

**Goals:**
- Share core cue algorithms across web and widget.
- Keep intentional per-surface defaults explicit and isolated.
- Preserve current suppression behavior for active, focused conversation views.
- Add test coverage that validates common cue invariants.

**Non-Goals:**
- Reworking notification UX copy or sound assets.
- Unifying all persistence keys or user preference UX in this change.

## Decisions

### 1) Extract pure core functions into shared notification-cue module

Decision:
- Move snapshot building, unread increase detection, and suppression predicate logic into a shared pure module.

Rationale:
- Pure logic is easy to test and avoids copy-paste drift.

Alternatives considered:
- Leave duplicate modules and sync manually. Rejected due to long-term maintenance risk.

### 2) Keep surface storage/prefs as adapters around shared core

Decision:
- Web/widget modules keep their own storage keys/default preference behavior while delegating core calculations.

Rationale:
- Preserves user-facing defaults without duplicating algorithm logic.

Alternatives considered:
- Force identical persistence behavior across surfaces now. Rejected as unnecessary scope expansion.

### 3) Add cross-surface invariants tests

Decision:
- Define shared test vectors for unread increase and suppression rules, then assert both surface adapters satisfy expected outcomes.

Rationale:
- Locks down correctness while allowing explicit configuration differences.

## Risks / Trade-offs

- [Risk] Hidden reliance on existing surface-specific quirks.
  - Mitigation: preserve adapter boundaries and verify behavior with fixture tests.
- [Risk] Over-sharing could erase intentional UX differences.
  - Mitigation: separate core logic from configuration defaults.

## Migration Plan

1. Create shared pure cue module.
2. Migrate web cue utility to use shared core.
3. Migrate widget cue utility to use shared core.
4. Add invariant tests and run web/widget checks.
5. Remove duplicated algorithm branches.

Rollback:
- Restore previous surface-local algorithms while keeping test fixtures for regression analysis.

## Open Questions

- Should preference persistence adapters also move to a shared package later?
- Do we want a unified analytics event when a cue is suppressed across surfaces?
