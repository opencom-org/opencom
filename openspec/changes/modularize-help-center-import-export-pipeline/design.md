## Context

The Help Center markdown pipeline is feature-rich and correctness-sensitive. It currently interleaves file collection, markdown parsing, asset reconciliation, storage operations, and export packaging in one module. This makes it difficult to reason about behavior changes and hard to isolate bugs.

## Goals / Non-Goals

**Goals:**
- Separate parse/rewrite/import/export concerns into clear modules.
- Reuse one canonical path/reference normalization strategy across import and export.
- Preserve current behavior for sync preview/apply, unresolved reference reporting, and portable export bundles.
- Improve testability for each pipeline stage.

**Non-Goals:**
- Changing Help Center content model semantics.
- Redesigning the admin UI for sync/export.
- Introducing new storage providers.

## Decisions

### 1) Stage-based pipeline modules

Decision:
- Implement modules for `ingest`, `markdown-parse`, `asset-rewrite`, `sync-apply`, and `export-build`.

Rationale:
- Mirrors actual pipeline stages and keeps each stage independently testable.

Alternatives considered:
- Keep one file with section comments. Rejected because coupling and review difficulty remain.

### 2) Canonical path/reference utilities shared by import and export

Decision:
- Move normalization and asset-reference rewrite utilities into shared helpers consumed by both sync and export flows.

Rationale:
- Prevents drift where import and export rewrite rules diverge over time.

Alternatives considered:
- Duplicate logic per flow. Rejected due to regression risk.

### 3) Behavior-lock tests for unresolved and rewritten references

Decision:
- Add fixture-driven tests for unresolved references, canonical `oc-asset://` mapping, and relative export rewrites.

Rationale:
- Ensures portability and safety behavior remains intact during decomposition.

Alternatives considered:
- Manual QA only. Rejected because edge cases are path-dependent.

## Risks / Trade-offs

- [Risk] Stage boundaries introduce temporary plumbing complexity.
  - Mitigation: document stage contracts and keep orchestration layer thin.
- [Risk] Rewrite parity regressions can silently break markdown rendering.
  - Mitigation: add fixture snapshots for import/output pairs.
- [Risk] Migration touches sensitive data flow.
  - Mitigation: incremental extraction with parity checks after each stage.

## Migration Plan

1. Extract shared path/reference helpers and add baseline tests.
2. Extract parse and rewrite stages with unchanged outputs.
3. Extract sync apply and export build orchestration into dedicated modules.
4. Remove obsolete monolith branches and finalize module ownership notes.
5. Run Convex tests and strict OpenSpec validation.

Rollback:
- Revert by stage while preserving stable external mutation/query entry points.

## Open Questions

- Should the parser/rewrite helpers become reusable outside Help Center in this change or in follow-up?
- Do we add explicit size/perf budgets for large folder imports now or later?
