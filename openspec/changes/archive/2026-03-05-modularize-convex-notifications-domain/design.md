## Context

The notifications domain currently lives in one large Convex module that mixes low-level delivery helpers, recipient lookup logic, event routing, and high-level event emitters. This coupling makes changes fragile because edits for one event type can unintentionally affect unrelated paths.

This refactor must preserve notification semantics: event routing decisions, debounce behavior for email, and recipient targeting for agent/visitor audiences.

## Goals / Non-Goals

**Goals:**
- Split notification responsibilities into clear, focused modules.
- Preserve existing event routing and delivery behavior.
- Improve type safety in helper interfaces used across notification modules.
- Increase testability of individual notification domains.

**Non-Goals:**
- Redesigning notification product behavior or templates.
- Changing notification channels or introducing new providers.
- Reworking unrelated Convex event producers outside notification boundaries.

## Decisions

### 1) Create layered notification module boundaries

Decision:
- Organize into layers:
  - recipient resolution,
  - routing/deduping,
  - channel dispatch (push/email),
  - event-specific emitters (chat/ticket/etc).

Rationale:
- Makes changes local and reduces accidental cross-domain regression.

Alternatives considered:
- Keep one file with region comments: rejected because ownership and testability remain weak.

### 2) Preserve event contracts via adapter shims during migration

Decision:
- Keep existing exported Convex mutation/action entry points while moving logic behind module adapters.

Rationale:
- Avoids breaking callers and supports incremental migration with low risk.

Alternatives considered:
- Rename/restructure all exports at once: rejected due to migration risk and reviewer burden.

### 3) Add parity tests for critical event families

Decision:
- Add focused tests for:
  - new visitor message notification path,
  - support reply email debounce path,
  - ticket assignment/status notification routing.

Rationale:
- These paths represent core logic branches and validate semantic parity after decomposition.

Alternatives considered:
- Rely only on existing broad integration coverage: rejected due to weak localization of regressions.

## Risks / Trade-offs

- [Risk] Modularization introduces temporary adapter indirection.
  - Mitigation: keep adapter layers thin and remove transitional wrappers after migration stabilizes.
- [Risk] Behavior drift in debounce/dedupe semantics during extraction.
  - Mitigation: codify current semantics in parity tests before moving logic.
- [Risk] Large migration touches many files in a sensitive backend area.
  - Mitigation: migrate one layer at a time with small, reviewable commits.

## Migration Plan

1. Create notification submodule structure and move pure helpers first.
2. Extract recipient-resolution and channel-dispatch logic behind stable adapters.
3. Extract event-specific emitters while keeping exported entry points stable.
4. Add/extend parity tests across representative chat/ticket notification paths.
5. Remove obsolete monolithic code and finalize module ownership.

Rollback:
- Revert layer-by-layer extraction commits while preserving existing entry-point exports.
- Keep adapter entry points stable to minimize rollback surface.

## Open Questions

- Should we introduce an internal notification event schema type shared across all emitters in this refactor, or defer to a follow-up?
- Do we want per-module lint/type strictness gates to prevent future monolith re-growth?
