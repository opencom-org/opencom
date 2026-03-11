## Context

The codebase intentionally uses dynamic behavior in some edges, but high-impact runtime paths currently carry unnecessary broad casts that mask integration errors. Targeted type tightening in these paths can improve safety without requiring a full schema overhaul.

## Goals / Non-Goals

**Goals:**
- Reduce unsafe casts in runtime-critical modules.
- Replace broad unknown fields with constrained unions/interfaces where practical.
- Preserve runtime behavior while improving compile-time guarantees.
- Add guardrails to prevent reintroduction of broad casts in targeted paths.

**Non-Goals:**
- Removing every `unknown` usage repository-wide.
- Rewriting Convex-generated types.
- Large-scale domain model redesign.

## Decisions

### 1) Prioritize high-risk runtime paths first

Decision:
- Scope tightening to runtime-critical modules and shared types consumed by those paths.

Rationale:
- Maximizes safety impact with manageable migration cost.

Alternatives considered:
- Repo-wide type cleanup. Rejected as too broad for one change.

### 2) Introduce typed adapters for dynamic internal calls

Decision:
- Wrap dynamic scheduler/internal references in typed utility adapters used by events and series flows.

Rationale:
- Contains dynamic boundaries and avoids repeated inline casting.

Alternatives considered:
- Keep inline casts with comments. Rejected because comments do not enforce correctness.

### 3) Add regression guardrails for targeted files

Decision:
- Add a targeted static check or lint guard for broad casts in covered runtime modules.

Rationale:
- Prevents quick regressions back to unsafe patterns.

Alternatives considered:
- Rely on reviewer discipline only. Rejected as unreliable.

## Risks / Trade-offs

- [Risk] Type tightening could surface latent mismatches and slow short-term delivery.
  - Mitigation: incremental PR slices and explicit adapter boundaries.
- [Risk] Over-constraining types may block legitimate dynamic use cases.
  - Mitigation: allow documented, isolated escape hatches at boundary modules.

## Migration Plan

1. Add typed helpers for internal scheduler/runtime references.
2. Migrate `events` and `series` call sites to typed helpers.
3. Tighten `authWrappers` and relevant shared `types` definitions.
4. Add targeted guards/tests and run Convex typecheck/tests.
5. Document approved dynamic boundaries.

Rollback:
- Revert individual module migrations while keeping newly added typed adapters for incremental reuse.

## Open Questions

- Which unknown-bearing shared types should remain intentionally loose for backwards compatibility?
- Should guardrails fail on all `as any` in covered modules or allow narrowly documented exceptions?
