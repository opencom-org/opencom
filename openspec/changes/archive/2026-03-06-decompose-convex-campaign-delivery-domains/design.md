## Context

The campaign-delivery domain is concentrated in two large modules:

- `carousels.ts`: authoring, eligibility, impression tracking, push-trigger orchestration
- `surveys.ts`: authoring, responses, export, visitor delivery, analytics

This creates high coupling and broad review blast radius.

## Goals / Non-Goals

**Goals:**

- Split both modules by concern with shared helper modules.
- Preserve stable Convex endpoint surfaces via top-level re-export files.
- Keep behavior and validation semantics unchanged.

**Non-Goals:**

- Changing survey/carousel product behavior.
- Changing permission model or endpoint signatures.
- Introducing new campaign endpoints.

## Decisions

### 1) Re-export entrypoint pattern for both modules

Decision:

- Keep `carousels.ts` and `surveys.ts` as re-export aggregators.

Rationale:

- Keeps generated API names stable while allowing internal decomposition.

### 2) Extract shared validation and auth helpers

Decision:

- Move common validators/normalizers/access helpers into dedicated helper modules.

Rationale:

- Removes duplication and keeps behavioral contracts centralized.

### 3) Split by operational concern

Decision:

- `carousels`: `helpers`, `authoring`, `delivery`, `triggering`.
- `surveys`: `helpers`, `authoring`, `responses`, `delivery`.

Rationale:

- Aligns with domain responsibilities and ownership seams.

## Risks / Trade-offs

- [Risk] Missing re-export can hide endpoint from generated API.
  - Mitigation: Convex typecheck + dependent package typechecks.
- [Risk] Behavior drift while moving logic.
  - Mitigation: move function bodies with minimal edits and keep helper behavior centralized.

## Migration Plan

1. Extract carousel helper/concern modules and recompose `carousels.ts`.
2. Extract survey helper/concern modules and recompose `surveys.ts`.
3. Run Convex and dependent package typechecks.
4. Record progress and update remaining map.

Rollback:

- Re-inline modules back to monolithic files.
