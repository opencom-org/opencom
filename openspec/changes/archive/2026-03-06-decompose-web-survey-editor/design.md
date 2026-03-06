## Context

The survey editor route currently owns:

- data loading/mutations for survey lifecycle
- all survey draft state and question editing logic
- tab switching and all tab rendering (builder, targeting, settings, analytics)

This creates a high-coupling editor where domain updates require touching one large page file.

## Goals / Non-Goals

**Goals:**

- Isolate survey editor domain logic into focused modules/hooks.
- Isolate tab UIs into dedicated components with explicit props contracts.
- Keep behavior and Convex payload semantics unchanged.

**Non-Goals:**

- Changing survey authoring UX or tab ordering.
- Introducing new survey capabilities.
- Changing Convex survey schemas or endpoints.

## Decisions

### 1) Extract draft/question logic into a dedicated hook

Decision:

- Move question CRUD/reorder/default option logic and draft change tracking into a survey editor hook.

Rationale:

- Question editing has the highest local state density and is independent from tab shell rendering.

### 2) Extract tab bodies into section components

Decision:

- Create dedicated components for:
  - builder tab
  - targeting tab
  - settings tab
  - analytics tab

Rationale:

- Tab extraction reduces page size and localizes future enhancements to the relevant section.

### 3) Keep network mutations in page orchestration layer (for this slice)

Decision:

- Keep save/activate/pause/export orchestration in `page.tsx` while passing typed handlers into tab components.

Rationale:

- This minimizes risk by preserving existing mutation call paths while still separating UI/business concerns for local editor state.

## Risks / Trade-offs

- [Risk] Prop contract drift during extraction.
  - Mitigation: strict TypeScript props and focused `@opencom/web` typecheck/tests.
- [Risk] Behavior regression in question option defaults or reordering.
  - Mitigation: preserve existing helper logic and add focused tests for extracted hook behavior.

## Migration Plan

1. Extract survey types/constants and draft/question logic hook.
2. Extract tab section components, keeping current markup and event wiring.
3. Recompose page and remove obsolete in-file state helpers.
4. Run focused verification and update refactor progress docs.

Rollback:

- Revert extracted modules and re-inline section content in `page.tsx` if regressions are found.

## Open Questions

- Should save/status/export mutation orchestration move into a `useSurveyEditorMutations` hook in a follow-up slice, or remain page-level for explicitness?
