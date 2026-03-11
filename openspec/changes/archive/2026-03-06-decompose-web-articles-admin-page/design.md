## Context

The articles admin route currently owns:

- article list filtering and collection facet derivation
- markdown folder import preview/apply workflows
- markdown export archive generation and audit logging
- import-source and deletion-history rendering
- delete confirmation dialog rendering

This single-file structure raises coupling between workflow logic and UI rendering.

## Goals / Non-Goals

**Goals:**

- Split render sections into focused modules with explicit typed props.
- Extract reusable local helper/contracts from `page.tsx`.
- Keep current workflow behavior, selectors, and mutation targets unchanged.

**Non-Goals:**

- UX redesign of the articles page.
- Changes to Convex query/mutation signatures.
- Changes to shared mobile/sdk/rn package contracts.

## Decisions

### 1) Extract by UI section boundaries

Decision:

- Create dedicated section components for import/export workflows, article list/filter table, and delete dialog.

Rationale:

- Existing layout naturally separates these concerns, enabling low-risk extraction.

### 2) Keep orchestration and side effects in page route

Decision:

- Keep query/mutation wiring and handler side effects in `page.tsx`.

Rationale:

- Preserves behavioral parity while reducing UI/render noise.

### 3) Move pure helpers and local contracts into dedicated modules

Decision:

- Move helper utilities and shared local types out of `page.tsx` to reusable local modules.

Rationale:

- Improves readability and reduces duplication risks for future slices.

## Risks / Trade-offs

- [Risk] Prop contract drift during extraction.
  - Mitigation: strict type contracts and package typecheck.
- [Risk] Regression in import/export selectors used by E2E.
  - Mitigation: preserve existing `data-testid` values and button semantics.

## Migration Plan

1. Extract local contracts + helpers from `page.tsx`.
2. Extract import/export/history render section component.
3. Extract article filter/table render section and delete dialog.
4. Recompose `page.tsx` around orchestration + section composition.
5. Run focused verification and update refactor docs/map.

Rollback:

- Revert extracted modules and re-inline render sections in `page.tsx` if regressions are found.

## Open Questions

- Should markdown import/export side-effect orchestration be moved to a dedicated hook in a follow-up slice?
