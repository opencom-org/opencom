## Context

The archived `fix-sdk-core-convex-type-surface` change solved the immediate build problem by localizing `TS2589` workarounds in sdk-core. A March 11, 2026 repo scan shows that the remaining sdk-core API files still share the same tactical pattern:

- `packages/sdk-core/src/api/aiAgent.ts`
- `packages/sdk-core/src/api/articles.ts`
- `packages/sdk-core/src/api/carousels.ts`
- `packages/sdk-core/src/api/checklists.ts`
- `packages/sdk-core/src/api/commonIssues.ts`
- `packages/sdk-core/src/api/conversations.ts`
- `packages/sdk-core/src/api/events.ts`
- `packages/sdk-core/src/api/officeHours.ts`
- `packages/sdk-core/src/api/outbound.ts`
- `packages/sdk-core/src/api/sessions.ts`
- `packages/sdk-core/src/api/tickets.ts`
- `packages/sdk-core/src/api/visitors.ts`

Each of those files still declares `getQueryRef(name: string)` and/or `getMutationRef(name: string)` helpers that return `makeFunctionReference(name)`. The runtime behavior is acceptable, but the resulting boundary is stringly typed and makes it easier for new wrappers to hide widening behind an apparently safe helper.

## Goals / Non-Goals

**Goals:**

- Replace generic `name: string` ref selector helpers in covered sdk-core API modules with explicit fixed refs.
- Preserve the archived build-safe behavior and avoid reopening broad `TS2589` regressions.
- Keep the public sdk-core wrapper API unchanged for consumers.
- Add a repeatable guardrail that prevents covered files from reintroducing string-based ref factories.

**Non-Goals:**

- Changing the public method names, payload shapes, or return contracts of sdk-core wrappers.
- Rewriting unrelated sdk-core concerns such as visitor state, client bootstrapping, or selector quality utilities.
- Forcing generated `api.*` refs into sdk-core if localized fixed `makeFunctionReference("module:function")` constants remain the safer type boundary.

## Decisions

### 1) Use explicit fixed refs, not generic selector helpers

Decision:

- Replace `getQueryRef(name: string)` and `getMutationRef(name: string)` with explicit fixed constants or tightly scoped ref modules that export named refs for actual backend targets.

Rationale:

- The remaining problem is not whether sdk-core can call Convex safely. It is whether the wrapper layer keeps target selection explicit enough to review and maintain.
- Fixed refs make each backend contract visible at the call site and prevent future wrappers from quietly selecting new targets through a shared string helper.

Alternatives considered:

- Keep the current generic helpers because typecheck already passes. Rejected because the generic helper is the main remaining non-ideal boundary in sdk-core.

### 2) Keep `TS2589` workarounds localized to fixed refs or shallow boundaries

Decision:

- If an sdk-core module still needs a deep-instantiation workaround, keep it on an explicit fixed ref declaration or another narrow, named boundary rather than a reusable `name: string` helper.

Rationale:

- The archived change proved that localized `makeFunctionReference("module:function")` usage is acceptable when generated refs are pathological.
- The problem is not the constructor. The problem is the caller-selected function name surface.

Alternatives considered:

- Replace everything with generated refs immediately. Rejected because the strongest requirement is a stable explicit boundary, not a specific ref source.

### 3) Migrate by file clusters and verify after each cluster

Decision:

- Split the migration into small file groups: session/conversation-facing wrappers first, then content/automation-facing wrappers.
- Run sdk-core typecheck and targeted sdk-core tests after each batch, with broader workspace typecheck if export inference changes.

Rationale:

- This keeps the migration small enough to catch type regressions without reopening a package-wide failure hunt.

Alternatives considered:

- Rewrite every affected sdk-core API module in one pass. Rejected because it increases the chance of avoidable inference regressions.

### 4) Add a static guard for generic factory reintroduction

Decision:

- Add or extend a focused sdk-core guard so covered wrapper modules fail verification if they reintroduce generic `getQueryRef(name: string)` or `getMutationRef(name: string)` patterns.

Rationale:

- This change is about ending a pattern, not just replacing a few occurrences once.

## Risks / Trade-offs

- [Risk] Explicit fixed refs may still trigger localized deep-instantiation failures in some modules.
  - Mitigation: keep the workaround on fixed ref constants or other named shallow boundaries instead of falling back to a generic selector helper.
- [Risk] Touching many wrapper files could subtly change exported inference.
  - Mitigation: migrate in clusters and rerun sdk-core typecheck plus targeted tests after each cluster.
- [Risk] A shared helper module could drift back into a generic selector surface.
  - Mitigation: only allow shared helpers that export fixed named refs, not helpers that accept arbitrary function names.

## Migration Plan

1. Freeze the March 11, 2026 sdk-core factory inventory and choose the fixed-ref pattern for covered modules.
2. Refactor session, conversation, visitor, ticket, and outbound wrappers first.
3. Refactor aiAgent, articles, carousels, checklists, commonIssues, events, and officeHours wrappers next.
4. Add or update guard coverage that fails on reintroduced generic string ref factories.
5. Run `pnpm --filter @opencom/sdk-core typecheck`, targeted sdk-core tests, and broader workspace verification if needed.
6. Run strict OpenSpec validation for this change.

Rollback:

- Revert only the current wrapper batch if a specific cluster reintroduces `TS2589` or consumer inference regressions. Do not restore the generic helper pattern repo-wide as the first fallback.

## Open Questions

- Do we want one shared `refs.ts` helper per sdk-core domain, or should each wrapper file own its fixed refs directly unless duplication becomes obvious?
