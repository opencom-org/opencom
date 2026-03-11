## Context

The current series implementation combines unrelated concerns in a single file: workflow authoring APIs, trigger evaluation, runtime progression, scheduler retries, and block telemetry writes. This increases merge conflict frequency and makes runtime fixes risky because small edits require understanding the whole engine.

## Goals / Non-Goals

**Goals:**
- Define explicit module boundaries for authoring, runtime, scheduling, and telemetry.
- Preserve all existing runtime semantics and external contracts.
- Reduce unsafe cast usage in scheduler/runtime call sites.
- Improve testability through domain-focused modules.

**Non-Goals:**
- Redesigning the series product model or visual builder UX.
- Changing trigger language semantics in this refactor.
- Replacing Convex scheduler primitives.

## Decisions

### 1) Introduce layered series modules with a compatibility facade

Decision:
- Add `series/authoring`, `series/runtime`, `series/scheduler`, and `series/telemetry` modules.
- Keep `series.ts` as a thin facade that re-exports existing public handlers during migration.

Rationale:
- Preserves call sites while enabling incremental extraction and smaller PR scope.

Alternatives considered:
- Big-bang rename/restructure in one pass. Rejected due to high blast radius.

### 2) Use typed scheduler adapters for internal calls

Decision:
- Centralize scheduler/internal function references behind typed helpers so runtime code no longer uses repeated broad casts.

Rationale:
- Improves type safety in failure-prone retry and resume paths.

Alternatives considered:
- Keep current inline casts. Rejected because it maintains fragile contracts.

### 3) Add parity-first regression tests around progression states

Decision:
- Add focused tests for wait/resume, retry scheduling, and block completion transitions before removing old code.

Rationale:
- Ensures behavior remains stable as responsibilities move across files.

Alternatives considered:
- Rely only on end-to-end checks. Rejected because localization of regressions is weak.

## Risks / Trade-offs

- [Risk] Runtime semantics drift during extraction.
  - Mitigation: parity tests for key transitions and scheduler interactions.
- [Risk] Temporary duplication while facade and new modules coexist.
  - Mitigation: remove migrated branches in planned cleanup phase.
- [Risk] More files increase navigation cost for newcomers.
  - Mitigation: clear module naming and ownership notes.

## Migration Plan

1. Create module folders and move pure helper logic first.
2. Extract authoring APIs and telemetry logic with unchanged signatures.
3. Extract runtime progression and scheduler adapters with parity tests.
4. Remove obsolete monolith sections and keep facade exports stable.
5. Run Convex typecheck/tests and strict OpenSpec validation.

Rollback:
- Revert extraction commits module-by-module while retaining facade entry points.

## Open Questions

- Should trigger evaluation stay in runtime or move to a dedicated policy module in this change?
- Do we enforce max file-size guardrails for future series modules now or in follow-up?
