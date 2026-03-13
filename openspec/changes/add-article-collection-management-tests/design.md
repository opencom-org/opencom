## Context

The articles experience now uses collections as its primary taxonomy, with management centered on `/articles/collections`. Existing automated coverage in this repo is uneven:
- backend tests cover collection-aware article assignment, import behavior, and visitor visibility semantics
- widget/browser tests cover collection browse in visitor-facing help surfaces
- admin web tests do not directly cover collection-management CRUD or hierarchy safety

The current collection-management page renders icon-only edit/delete buttons and computes several important guardrails in local UI logic:
- child collections block deletion
- assigned articles block deletion
- parent selection excludes the current collection and its descendants

Those behaviors are important enough to keep under automation, but they are currently awkward to test robustly without adding explicit automation hooks.

## Goals / Non-Goals

**Goals:**
- Add deterministic coverage for collection-management route access and core CRUD flows.
- Verify hierarchy safety behavior without reintroducing the removed knowledge-folder model.
- Improve the collection-management UI's testability with stable selectors or accessible labels instead of brittle DOM traversal.
- Keep the collection suite independent from deployment-global state and avoid requiring `TEST_ADMIN_SECRET` for baseline admin coverage.

**Non-Goals:**
- Redesigning the collection-management UI.
- Changing collection business rules beyond what is needed for stable automation coverage.
- Expanding the proposal into full article-assignment workflow coverage across every surface.
- Reintroducing folder terminology or folder-specific abstractions.

## Decisions

### 1) Add a dedicated collection-management browser spec

Decision:
- Add a focused Playwright spec for `/articles/collections` instead of extending the legacy `knowledge.spec.ts` responsibilities indefinitely.
- Keep `knowledge.spec.ts` as a lightweight articles/legacy-route smoke suite, and use the new spec for collection CRUD and hierarchy flows.

Rationale:
- Collection-management failures should point to one route and one spec file rather than a mixed legacy knowledge suite.
- This keeps the post-refactor article coverage easier to reason about and avoids coupling collection regressions to unrelated article-editor checks.

Alternatives considered:
- Extend `knowledge.spec.ts` with collection tests: rejected because it would mix legacy redirect coverage, article-editor coverage, and collection CRUD in one file.

### 2) Add explicit testability hooks for collection actions

Decision:
- Add stable automation affordances to the collection-management page, preferring accessible labels for action buttons and targeted test ids only where necessary for repeated row/modal targeting.
- Scope the hooks to collection rows, edit/delete actions, notices, and the modal form.

Rationale:
- The current page exposes icon-only buttons and repeated table rows, which makes selectors brittle and couples tests to markup details.
- Stable hooks reduce future maintenance cost and make collection coverage resilient to styling/layout changes.

Alternatives considered:
- Use only structural selectors and icon matching: rejected because it is fragile and hard to maintain as the table evolves.

### 3) Split coverage between browser CRUD flows and focused guardrail tests

Decision:
- Cover route access, create, edit, delete of empty collections, and parent-child assignment in Playwright.
- Cover local guardrail messaging and helper logic with focused web tests where a full browser flow would require unrelated setup, especially the article-count deletion warning path.

Rationale:
- Empty-collection CRUD and parent assignment are true user workflows and should remain browser-covered.
- The warning paths for child/article counts are computed locally and can be validated more deterministically in focused tests without building extra article fixtures in the same browser flow.

Alternatives considered:
- Put every guardrail in Playwright: rejected because it increases runtime and setup complexity for logic that is already local to the page.
- Put all collection coverage in unit tests: rejected because it would miss route wiring and real modal/form behavior.

## Risks / Trade-offs

- [Risk] Adding selectors or aria labels could create small markup churn in the collections page.
  - Mitigation: keep hooks narrowly scoped to repeated controls and prefer semantic labels over broad test-only attributes.
- [Risk] Splitting coverage across Playwright and focused web tests can leave ambiguity about where a regression belongs.
  - Mitigation: keep the browser suite focused on user-visible CRUD flows and keep helper/notice tests explicitly named around guardrail logic.
- [Risk] Collection tests may become flaky if they depend on pre-existing workspace state.
  - Mitigation: use unique collection names per run and keep baseline CRUD coverage self-contained within the authenticated worker workspace.

## Migration Plan

1. Add stable selectors or accessible labels to the collection-management page for repeated action controls and notices.
2. Add a dedicated Playwright spec for collection-management access, create/edit/delete of empty collections, and parent-child assignment coverage.
3. Add focused web tests for collection guardrail helper behavior and warning notice rendering paths that do not need full browser setup.
4. Update test docs or skip metadata if the suite shape changes.
5. Run focused web and Playwright verification for the new collection coverage.

Rollback strategy:
- If the new coverage proves too brittle, remove the added hooks and keep only the focused guardrail tests while revisiting browser scope.

## Open Questions

- None.
