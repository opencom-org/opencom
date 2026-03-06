## Context

The tour editor route currently owns:

- page header and top-level orchestration state
- steps tab rendering and step reordering/edit/delete actions
- settings tab rendering for targeting, appearance, display mode, and behavior
- step modal form state, validation, selector diagnostics, and save logic

This one-file approach mixes business logic with large render branches and makes routine tour-authoring changes expensive to reason about.

## Goals / Non-Goals

**Goals:**

- Split large tour editor render sections into focused components with explicit typed props.
- Move reusable tour-editor form helpers and local types out of `page.tsx`.
- Keep business behavior unchanged while reducing page concentration.

**Non-Goals:**

- Changing tour authoring UX or workflows.
- Changing Convex function signatures or tour payload contracts.
- Reworking selector-scoring logic in `@opencom/sdk-core`.

## Decisions

### 1) Extract by feature panel boundaries

Decision:

- Create dedicated modules for the steps panel, settings panel, and step modal.

Rationale:

- The existing route is already organized around these UI boundaries, which makes extraction low-risk and reviewable.

Alternative considered:

- Splitting only helper functions first.
- Rejected because the render branches are still the largest concentration risk.

### 2) Keep query/mutation orchestration in `page.tsx`

Decision:

- Keep Convex hooks, top-level tour state, and action handlers in `page.tsx`, passing typed props into child modules.

Rationale:

- Preserves current behavior and reduces the chance of wiring regressions while still shrinking the page substantially.

Alternative considered:

- Moving mutation orchestration into custom hooks immediately.
- Rejected for this slice because it expands scope beyond UI decomposition.

### 3) Centralize step-form normalization and warnings in a local helper module

Decision:

- Move step-form defaults, route normalization/warning helpers, and selector-warning helpers into a shared local module.

Rationale:

- These helpers are reused across modal initialization and validation and do not belong in the page render body.

Alternative considered:

- Leaving helpers in `page.tsx` and extracting only components.
- Rejected because it would still leave the page carrying tour-editor business logic.

## Risks / Trade-offs

- [Risk] Prop wiring errors between page orchestration and extracted panels.
  - Mitigation: explicit local types, focused web typecheck, and targeted tours E2E coverage.
- [Risk] Modal extraction could regress step-save validation or selector warning visibility.
  - Mitigation: keep validation logic intact and preserve existing test selectors/data-testid hooks.
- [Risk] Convex-generated types may trigger TypeScript depth limits in app builds.
  - Mitigation: keep hook usage concentrated in the page orchestration layer and avoid widening generated types across child modules.

## Migration Plan

1. Extract tour-editor local types/helpers.
2. Extract steps panel, settings panel, and step modal into dedicated components.
3. Recompose `page.tsx` around the extracted modules.
4. Run focused verification and document progress.

Rollback:

- Re-inline extracted modules into `page.tsx` if regressions are found during verification.

## Open Questions

- Should step validation/save logic move into a dedicated hook in a follow-up slice, or stay in page orchestration after this UI decomposition pass?
