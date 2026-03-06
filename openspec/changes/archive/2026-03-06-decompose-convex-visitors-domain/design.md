## Context

The visitors module currently owns:

- helper validators/constants
- merge canonicalization and reassignment logic
- audit-history projection helpers
- core queries (`get`, `getBySession`, `list`, `search`, `isOnline`)
- directory/detail/history queries
- identify/location/heartbeat mutations

This broad scope in one file increases coupling and review complexity.

## Goals / Non-Goals

**Goals:**

- Split visitors logic by concern into dedicated modules.
- Preserve current Convex export surface and behavior.
- Reduce monolithic file size and improve ownership boundaries.

**Non-Goals:**

- Changing visitor merge behavior.
- Changing visitor auth/permission semantics.
- Changing query/mutation args or return shapes.

## Decisions

### 1) Keep `visitors.ts` as stable entrypoint

Decision:

- Use `visitors.ts` as re-export aggregator for split modules.

Rationale:

- Preserves existing API path and avoids downstream import churn.

### 2) Isolate shared helpers/validators in one module

Decision:

- Centralize shared helper functions and validators in `visitors/helpers.ts`.

Rationale:

- Prevents logic drift across query/mutation modules and reduces duplication.

### 3) Split by runtime concern

Decision:

- `coreQueries.ts`: read-only base visitor queries.
- `directoryQueries.ts`: directory/detail/merge-history query flows.
- `mutations.ts`: identify/update-location/heartbeat mutation flows.

Rationale:

- Matches existing responsibility boundaries and supports targeted future changes.

## Risks / Trade-offs

- [Risk] Re-export wiring mistakes could hide functions from Convex.
  - Mitigation: Convex typecheck and API compile checks.
- [Risk] Behavior drift in identify merge flow.
  - Mitigation: keep mutation body logic unchanged and only move code.

## Migration Plan

1. Extract shared helpers/validators/types.
2. Extract core queries, directory queries, and mutations into dedicated modules.
3. Convert `visitors.ts` to re-export aggregator.
4. Run Convex and cross-surface typechecks.
5. Update progress docs and remaining map.

Rollback:

- Re-inline modules into `visitors.ts` and remove submodules.
