## Why

Residual Convex type-hardening work still leaves manual string-based function-ref helpers and repeated `as unknown as` escape hatches in backend hotspots, especially around AI knowledge retrieval and shared helper modules. A focused follow-up is needed now so the remaining exceptions match the repo playbook, stay explicitly guard-railed, and do not expand again.

## What Changes

- Replace remaining generic `name: string` `makeFunctionReference(...)` helpers in covered `packages/convex/convex/**` hotspots with fixed module-scope refs or narrowly scoped shared ref modules.
- Reduce remaining repeated `as unknown as` ref and runner casts in runtime-critical Convex files by keeping unavoidable `TS2589` workarounds behind named local helpers only.
- Close the residual backend inventory across RAG-critical files, shared helper modules, and domain-specific runtime boundaries, while preserving accepted dynamic exceptions such as `testAdmin.ts` unless requirements change.
- Update guardrails and change ownership records so the repo-wide hardening inventory reflects the remaining covered files and the new steady-state exception list.
- Keep already completed work, including sdk-core `getRelevantKnowledge` action routing and embedding batching concurrency, out of scope except where guard or proposal text must acknowledge it as already satisfied.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `convex-function-ref-boundaries`: extend the covered backend inventory to the remaining shared helper modules and runtime hotspots that still rely on generic string-based ref helpers.
- `runtime-type-safety-hardening`: tighten the remaining runtime-critical Convex boundaries so ref and runner casts stay localized, named, and minimal.
- `cross-surface-convex-ref-boundary-hardening`: record this change as the owner for the remaining backend inventory and anti-regression guard updates, while keeping approved exceptions explicit.

## Impact

- Affected code: `packages/convex/convex/aiAgent.ts`, `packages/convex/convex/aiAgentActions.ts`, `packages/convex/convex/aiAgentActionsKnowledge.ts`, `packages/convex/convex/embeddings.ts`, `packages/convex/convex/notifications/functionRefs.ts`, `packages/convex/convex/push/functionRefs.ts`, `packages/convex/convex/embeddings/functionRefs.ts`, `packages/convex/convex/http.ts`, `packages/convex/convex/tickets.ts`, and the remaining runtime helper files identified by the repo audit.
- Guardrails: `packages/convex/tests/runtimeTypeHardeningGuard.test.ts`, plus any supporting spec deltas and inventory notes that define approved exceptions.
- Docs/process: `docs/convex-type-safety-playbook.md` may need minor follow-up if the accepted hotspot inventory changes.
- Runtime/API impact: no intended product behavior change; this is a hardening and maintainability cleanup of Convex call boundaries.
