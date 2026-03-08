## 1. Foundation

- [ ] 1.1 Create a minimal widget-local Convex adapter layer for thin typed hook primitives.
- [ ] 1.2 Define conventions for widget domain wrapper placement, naming, and explicit local typing boundaries.
- [ ] 1.3 Ensure unavoidable casts or `@ts-expect-error` usage are centralized outside widget runtime and overlay UI files.

## 2. Initial domain migrations

- [ ] 2.1 Add wrapper hooks for widget shell/session/bootstrap and conversation flow domains.
- [ ] 2.2 Add wrapper hooks for tours, outbound, surveys, and checklist delivery domains.
- [ ] 2.3 Add wrapper hooks for authoring and overlay flows where generated Convex hooks currently live in runtime/UI modules.
- [ ] 2.4 Migrate covered widget modules away from direct generated Convex hook calls where wrapper coverage exists.

## 3. Runtime/controller adoption

- [ ] 3.1 Update central widget runtime/controller modules to compose domain wrappers without owning generated hook details.
- [ ] 3.2 Keep runtime-state ownership and data-access wrapper ownership distinct during migration.
- [ ] 3.3 Confirm wrapper adoption aligns with widget runtime-state refactor work rather than duplicating it.

## 4. Verification

- [ ] 4.1 Run targeted widget tests or flow checks for shell/runtime and overlay modules touched by the migration.
- [ ] 4.2 Run relevant workspace typecheck commands for widget-touched code.
- [ ] 4.3 Run `openspec validate introduce-widget-local-convex-wrapper-hooks --strict --no-interactive`.
