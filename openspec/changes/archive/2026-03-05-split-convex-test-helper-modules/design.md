## Context

Large test helper files make it difficult to find the right fixtures and increase accidental coupling between unrelated test utilities. The cost is higher in a backend with many feature domains that rely on deterministic seeds and helper shortcuts.

## Goals / Non-Goals

**Goals:**
- Decompose test helper/data monoliths into domain-focused modules.
- Preserve existing helper behavior and minimize test migration disruption.
- Improve discoverability and ownership for fixtures.
- Keep a stable compatibility entry point during transition.

**Non-Goals:**
- Rewriting all tests to new APIs in one pass.
- Changing product behavior through fixture refactors.

## Decisions

### 1) Domain-first helper folder structure

Decision:
- Organize helpers/data by feature domain with small modules and explicit exports.

Rationale:
- Makes extension and debugging local to domain changes.

Alternatives considered:
- Split by arbitrary file size only. Rejected because ownership remains unclear.

### 2) Compatibility barrel during migration

Decision:
- Keep top-level compatibility exports while tests migrate to domain import paths.

Rationale:
- Enables incremental migration without breaking all tests at once.

Alternatives considered:
- Immediate hard cutover. Rejected due to churn and review overhead.

### 3) Fixture registry documentation

Decision:
- Document where fixtures live and naming conventions for new additions.

Rationale:
- Prevents re-centralization into new mega files.

## Risks / Trade-offs

- [Risk] Temporary duplicate exports while migration is in progress.
  - Mitigation: track and remove compatibility exports once usage drops.
- [Risk] Import path churn across many tests.
  - Mitigation: migrate in batches and preserve backward-compatible barrel.

## Migration Plan

1. Create domain module folders for helpers and seed data.
2. Move pure helper/data blocks into domain modules with tests.
3. Add compatibility barrel exports from old entry points.
4. Migrate high-churn tests first, then remaining imports.
5. Remove obsolete monolithic files after migration completes.

Rollback:
- Restore compatibility barrels and revert partial migration batches if breaks appear.

## Open Questions

- Should fixture modules be co-located with feature tests or kept centralized in `testing/`?
- Do we enforce a per-file size cap for future test helper modules?
