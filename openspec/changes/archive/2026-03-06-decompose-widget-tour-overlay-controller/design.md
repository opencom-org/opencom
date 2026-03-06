## Context

`TourOverlay.tsx` currently contains:

- Domain contracts and route-matching helpers
- Viewport and tooltip positioning calculations
- Mutation orchestration for start/advance/checkpoint/skip/dismiss actions
- Multiple render variants (pointer, post, recovery, route hint, confetti)

This concentration creates high coupling and broad review blast radius for otherwise isolated UI updates.

## Goals / Non-Goals

**Goals:**

- Split pure helper logic out of the controller.
- Split render-heavy sections into focused presentational components.
- Keep current TourOverlay props and behavior stable.
- Preserve existing test IDs and unit-test coverage expectations.

**Non-Goals:**

- Changing tour product behavior or UX copy.
- Changing convex mutation contracts.
- Replacing existing tour state machine semantics.

## Decisions

### 1) Domain helper extraction under `src/tourOverlay/`

Decision:

- Move types + pure helper logic into dedicated files:
  - `types.ts`
  - `routeMatching.ts`
  - `messages.ts`
  - `viewport.ts`

Rationale:

- Business rules become easier to test and reuse without touching JSX controller code.

### 2) Presentational extraction for large render sections

Decision:

- Move route/recovery/pointer/post/confetti sections to `tourOverlay/components.tsx` and pass controller-derived props.

Rationale:

- Keeps controller focused on orchestration and side-effects.

### 3) Controller remains the stable API boundary

Decision:

- Keep `TourOverlay` exported from `TourOverlay.tsx` with unchanged `TourOverlayProps` and mutation flow.

Rationale:

- Prevents regressions for widget shell, web embedding, and mobile/sdk usage expectations.

## Risks / Trade-offs

- [Risk] Accidental behavior drift while moving render branches.
  - Mitigation: keep markup/test IDs identical and run targeted widget tests.
- [Risk] Over-fragmentation increases import overhead.
  - Mitigation: extract only high-signal helpers and top-level render sections.

## Migration Plan

1. Extract domain types and helper utilities.
2. Extract render sections into presentational components.
3. Recompose controller with imported helpers/components.
4. Run widget typecheck and focused tour overlay tests.
5. Run web typecheck for embedding confidence and update refactor docs.

Rollback:

- Inline modules back into `TourOverlay.tsx` while preserving helper signatures.
