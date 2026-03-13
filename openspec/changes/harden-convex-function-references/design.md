## Context

The repo has already completed several earlier Convex ref-hardening slices, but the current backend inventory still contains residual `makeFunctionReference(...)` helpers that accept `name: string` and a small set of repeated `as unknown as` runner/ref casts. The remaining work is concentrated in RAG-critical files (`aiAgent.ts`, `aiAgentActions.ts`, `aiAgentActionsKnowledge.ts`, `embeddings.ts`), shared helper modules (`notifications/functionRefs.ts`, `push/functionRefs.ts`, `embeddings/functionRefs.ts`), and a set of domain-specific runtime files such as `http.ts`, `tickets.ts`, `emailChannel.ts`, and `series/scheduler.ts`.

The active constraints are already documented in `docs/convex-type-safety-playbook.md`: generated refs remain the default, shallow runner helpers are the first `TS2589` escape hatch, fixed `makeFunctionReference("module:function")` refs are allowed only for confirmed hotspots, and new generic string-ref factories are not allowed. The repo also already finished two adjacent slices that this design must not reopen by default: sdk-core `getRelevantKnowledge` now routes through an action, and embedding batch/backfill flows already use concurrency helpers.

## Goals / Non-Goals

**Goals:**

- Remove remaining generic `name: string` Convex ref helper patterns from the covered backend inventory.
- Keep any unavoidable `TS2589` workaround localized to fixed refs or named shallow runner helpers.
- Preserve existing runtime behavior while tightening the boundary shapes in `packages/convex`.
- Update guardrails and ownership records so the remaining accepted exceptions are explicit and minimal.

**Non-Goals:**

- Changing AI retrieval semantics, ranking, or public API behavior.
- Reopening sdk-core route migration work that is already verified.
- Reworking embedding throughput or batching behavior beyond boundary cleanup.
- Removing intentionally dynamic admin/test dispatch unless requirements explicitly change.

## Decisions

### Use explicit module-scope refs instead of reusable `name: string` factories

Covered backend files will replace generic helpers such as `makeInternalQueryRef(name)` with explicit named refs per target. For shared clusters that already centralize refs, the module stays shared, but it exports only fixed refs and any required named runner helpers.

- **Why:** this matches the playbook, makes each remaining `TS2589` workaround auditable, and prevents the helper surface from silently expanding.
- **Alternative considered:** keep the current helper factories and document them as accepted legacy. Rejected because it preserves the broad pattern the repo is trying to eliminate.

### Keep shallow runner casts only where generated refs still force them

The implementation will continue to use named `getShallowRunQuery`, `getShallowRunMutation`, `getShallowRunAction`, or `getShallowRunAfter` helpers only at confirmed hotspot boundaries. Inline runner casts or repeated double-cast patterns inside feature logic will not be expanded.

- **Why:** shallow helpers are the approved first-line `TS2589` workaround and are smaller than broad object casts.
- **Alternative considered:** switch every covered call site back to generated refs and raw `ctx.run*` invocations immediately. Rejected because some existing hotspots were introduced specifically to avoid deep-instantiation regressions.

### Treat RAG-critical files as the first implementation batch

`aiAgent.ts`, `aiAgentActions.ts`, `aiAgentActionsKnowledge.ts`, and `embeddings.ts` form the highest-value cleanup cluster because they still contain the most visible residual helpers and are adjacent to already-finished AI route and embedding performance work. Shared AI/embedding ref modules may be introduced or expanded if that reduces duplication without reintroducing a generic selector helper.

- **Why:** this cluster closes the remaining audit items around the active AI runtime path first and reduces duplicate helper patterns before wider backend cleanup.
- **Alternative considered:** start with lower-risk leaf files such as `widgetSessions.ts` and `workspaceMembers.ts`. Rejected because it leaves the largest remaining hotspot cluster unresolved.

### Update guardrails with each file-cluster migration

Guard tests will move in lockstep with each cleanup batch so the approved inventory reflects the new steady state. Positive assertions that currently depend on helper names or legacy hotspot lists will be rewritten to validate the new fixed-ref or exception shape.

- **Why:** the repo already uses guard tests as the enforcement mechanism for these boundaries, so the inventory cannot lag behind implementation.
- **Alternative considered:** defer all guard updates to the end. Rejected because intermediate batches would either fail verification or leave the wrong exceptions approved.

## Risks / Trade-offs

- **[TS2589 resurfaces in previously stable files]** -> Migrate in small clusters and rerun `pnpm --filter @opencom/convex typecheck` after each cluster before broadening the slice.
- **[Boundary cleanup accidentally changes runtime targets or argument shapes]** -> Preserve existing ref strings and call signatures exactly, then cover the touched cluster with focused tests.
- **[Guard tests become too coupled to temporary implementation details]** -> Prefer assertions about approved patterns and explicit exception inventory rather than helper naming alone.
- **[Scope expands back into already-finished sdk-core or performance work]** -> Keep proposal/tasks explicit that route migration and embedding concurrency items are already satisfied unless new evidence appears.

## Migration Plan

1. Migrate the RAG-critical cluster and update `packages/convex/tests/runtimeTypeHardeningGuard.test.ts` to match the new boundary shape.
2. Migrate shared helper modules and adjacent domain-specific runtime files in verification-gated micro-batches.
3. Preserve explicitly approved dynamic exceptions, validate the change with focused Convex checks, and then continue into implementation from the generated task list.

## Open Questions

- Should `supportAttachmentFunctionRefs.ts` remain a tiny fixed-ref module or be folded into the caller once the residual cast is removed?
- Which shared helper clusters still truly require shallow runner helpers after fixed refs replace the remaining generic factories?
