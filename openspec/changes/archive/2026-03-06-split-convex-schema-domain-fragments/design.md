## Context

The Convex schema currently defines all tables in a single file:

- authentication/workspace identity tables
- inbox + notifications tables
- help center + knowledge tables
- campaigns + surveys + reporting + settings tables

This creates a high-churn hotspot where unrelated changes collide.

## Goals / Non-Goals

**Goals:**

- Split schema table declarations by domain into dedicated fragment modules.
- Preserve full schema behavior (table keys, validators, indexes, search/vector indexes).
- Keep `schema.ts` simple and compositional.

**Non-Goals:**

- Renaming or removing schema tables/indexes.
- Changing runtime Convex function behavior.
- Introducing new domain models.

## Decisions

### 1) Fragment by stable domain boundaries

Decision:

- Create fragment modules for auth/workspace, inbox/notifications, help center, engagement, outbound/support, campaigns, and operations.

Rationale:

- Aligns with existing conceptual boundaries and review ownership.

### 2) Keep `schema.ts` as single schema entrypoint

Decision:

- Keep `schema.ts` exporting one `defineSchema` call that spreads `authTables` plus fragment exports.

Rationale:

- Avoids changes to import paths for downstream tooling and maintains one canonical schema root.

### 3) Preserve declaration ordering and exact table declarations

Decision:

- Keep original table declarations unchanged in fragments and preserve spread order.

Rationale:

- Minimizes risk of behavioral drift and supports deterministic generated types.

## Risks / Trade-offs

- [Risk] Validator omission during extraction.
  - Mitigation: focused Convex typecheck and cross-surface typechecks.
- [Risk] Hidden coupling via generated schema types.
  - Mitigation: run typechecks for web/widget/mobile/sdk packages after Convex change.

## Migration Plan

1. Create domain fragment modules with extracted table declarations.
2. Recompose `schema.ts` to aggregate fragments.
3. Typecheck Convex package.
4. Typecheck web/widget/mobile/sdk-core/react-native-sdk for compatibility confidence.
5. Document progress and refresh remaining-slices map.

Rollback:

- Restore monolithic `schema.ts` and remove fragment modules.

## Open Questions

- Should future domain-specific schema slices move fragment composition into a dedicated index module with explicit table ownership metadata?
