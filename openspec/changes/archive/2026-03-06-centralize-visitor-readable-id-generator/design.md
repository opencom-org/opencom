## Context

Visitor fallback labels are used in multiple operator surfaces and test seeds. Today, deterministic generation logic is duplicated in:

- `apps/web/src/lib/visitorIdentity.ts`
- `packages/convex/convex/visitorReadableId.ts`

The duplicated word dictionaries and hashing logic increase maintenance cost and can silently diverge.

## Goals / Non-Goals

**Goals**

- Establish one source of truth for deterministic numbered visitor-readable IDs.
- Keep existing Convex and web public helper contracts stable.
- Preserve deterministic output compatibility for existing visitor IDs.

**Non-Goals**

- Redesigning visitor display-label precedence rules in web UI.
- Introducing new ID formats beyond existing adjective-noun-number fallback.
- Migrating all identity helpers in one pass beyond this specific extraction.

## Decisions

### 1) Move numbered generator into `@opencom/types`

Decision:

- Create `packages/types/src/visitorReadableId.ts` containing adjective/noun dictionaries and deterministic formatter.

Rationale:

- `@opencom/types` is shared by web, Convex, mobile, and SDK surfaces without runtime/browser coupling.

Alternatives considered:

- Keep logic in Convex and import into web. Rejected due package-boundary coupling.
- Keep duplication with comments. Rejected because comments do not prevent drift.

### 2) Preserve current web API by adapting `formatHumanVisitorId`

Decision:

- Keep `formatHumanVisitorId(visitorId, variant)` in web.
- Delegate `numbered` variant to shared formatter.
- Keep web-local `verb` variant behavior intact.

Rationale:

- Avoids callsite churn while removing duplicated numbered generator logic.

### 3) Keep Convex wrapper signature unchanged

Decision:

- Maintain `formatReadableVisitorId(visitorId: Id<\"visitors\"> | string): string` in Convex as a thin wrapper around shared formatter.

Rationale:

- Preserves backend callsite compatibility and avoids broad refactors.

## Risks / Trade-offs

- [Risk] Dictionary reordering could remap historical labels.
  - Mitigation: preserve dictionary order and add deterministic regression assertions.
- [Risk] Partial extraction could leave hidden duplicates.
  - Mitigation: remove numbered generator internals from web/Convex and rely on shared export.

## Migration Plan

1. Add shared visitor-readable-ID utility in `@opencom/types` and export it.
2. Refactor Convex wrapper to consume shared utility.
3. Refactor web visitor identity utility to consume shared utility for numbered IDs.
4. Add targeted unit tests and run package-level verification.

Rollback:

- Revert shared utility adoption in web/Convex independently if regressions appear.

## Open Questions

- Should the `verb` variant be promoted into shared types in a follow-up change, or remain web-only as an internal/testing helper?
