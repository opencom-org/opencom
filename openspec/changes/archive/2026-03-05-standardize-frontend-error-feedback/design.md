## Context

Alert-based error UX blocks interaction and is inconsistent across surfaces. We need one frontend error feedback contract that improves user clarity and keeps handling code maintainable.

## Goals / Non-Goals

**Goals:**
- Replace raw `alert` usage with standardized non-blocking feedback.
- Keep user-facing error copy actionable and consistent.
- Provide reusable utility/helpers for mapping unknown errors.
- Preserve existing operation semantics while improving UX.

**Non-Goals:**
- Rebranding the entire UI notification system.
- Refactoring backend error shapes in this change.

## Decisions

### 1) Use shared error feedback primitives per surface

Decision:
- Adopt common error feedback primitives (toast/inline/banner) exposed by shared frontend utilities, adapted for web and widget contexts.

Rationale:
- Consistent UX without forcing identical component implementations in every surface.

Alternatives considered:
- Keep per-feature custom alerts. Rejected due to inconsistency and poor UX.

### 2) Centralize unknown-error normalization

Decision:
- Add helper utilities that convert unknown thrown values into safe user-facing messages and optional diagnostics.

Rationale:
- Reduces repeated ad-hoc `instanceof Error` blocks and copy drift.

Alternatives considered:
- Continue local ad-hoc mapping. Rejected for maintainability.

### 3) Prioritize high-impact paths first

Decision:
- Start with current alert hotspots in settings and widget ticket/mutation flows.

Rationale:
- Immediate UX consistency where users currently see blocking alerts.

## Risks / Trade-offs

- [Risk] Non-blocking feedback might be missed if not visually prominent.
  - Mitigation: include persistent/error-styled variants for critical failures.
- [Risk] Surface-specific components could still diverge over time.
  - Mitigation: centralize error mapping and test shared behavior requirements.

## Migration Plan

1. Define shared error feedback and unknown-error normalization utilities.
2. Replace raw alerts in identified web and widget hotspots.
3. Add targeted frontend tests for displayed feedback and retry affordances.
4. Remove obsolete alert-based branches and document usage guidelines.

Rollback:
- Temporarily revert replaced call sites while preserving utilities for incremental migration.

## Open Questions

- Should mobile app surfaces be included in this standardization now or tracked as follow-up?
- Do we require analytics events for surfaced frontend errors in this change?
