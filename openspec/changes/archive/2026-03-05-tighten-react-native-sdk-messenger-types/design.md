## Context

Messenger view composition currently depends on cast-based escape hatches for prop wiring. This hides shape mismatches and defers failures to runtime/UI behavior rather than compile-time feedback.

## Goals / Non-Goals

**Goals:**
- Remove cast escapes in messenger composition.
- Define explicit prop contracts shared across composed messenger views.
- Preserve existing runtime behavior while improving type safety.
- Add tests/guards to prevent regression to broad casts in these paths.

**Non-Goals:**
- Redesigning messenger UI.
- Refactoring unrelated RN SDK domains.

## Decisions

### 1) Shared prop contract types for messenger composition

Decision:
- Create canonical type definitions for composed messenger props and use them in `MessengerContent` and `OpencomMessenger`.

Rationale:
- One source of truth prevents drift between caller and callee.

Alternatives considered:
- Keep local duplicated prop interfaces. Rejected due to mismatch risk.

### 2) Remove `as any` in favor of explicit adapter transforms

Decision:
- Where shape differences exist, introduce small typed adapters instead of broad casts.

Rationale:
- Makes compatibility behavior explicit and testable.

Alternatives considered:
- Leave casts with comments. Rejected as non-enforceable.

### 3) Add type-level and runtime parity checks

Decision:
- Add typecheck-driven tests and targeted runtime tests for composed prop flows.

Rationale:
- Ensures correctness at both compile and runtime layers.

## Risks / Trade-offs

- [Risk] Tight contracts may surface hidden optional/nullable assumptions.
  - Mitigation: add explicit adapter mapping and targeted tests.
- [Risk] Extra type definitions increase upfront maintenance.
  - Mitigation: centralize definitions and document ownership.

## Migration Plan

1. Define canonical composed messenger prop interfaces.
2. Update `OpencomMessenger` and `MessengerContent` to consume canonical interfaces.
3. Replace cast sites with typed adapters where needed.
4. Run RN SDK typecheck/tests and fix contract drift.
5. Add guardrails against reintroducing broad casts in these files.

Rollback:
- Restore previous local interfaces and cast-based wiring while preserving discovered contract tests.

## Open Questions

- Do we export these prop contracts publicly or keep them internal-only?
- Should we add lint guards for `as any` in RN SDK component composition paths?
