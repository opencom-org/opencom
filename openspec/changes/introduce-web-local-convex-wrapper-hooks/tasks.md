## 1. Foundation

- [ ] 1.1 Create a minimal web-local Convex adapter layer for thin typed hook primitives in `apps/web`.
- [ ] 1.2 Define conventions for domain wrapper hook placement, naming, and explicit local typing boundaries.
- [ ] 1.3 Ensure new wrapper-layer escape hatches centralize any unavoidable casts or `@ts-expect-error` usage.

## 2. Initial domain migrations

- [ ] 2.1 Add domain-specific wrapper hooks for settings/security and workspace member settings flows.
- [ ] 2.2 Add domain-specific wrapper hooks for outbound list/editor flows.
- [ ] 2.3 Add domain-specific wrapper hooks for tours/editor and related authoring flows.
- [ ] 2.4 Migrate covered UI files away from direct generated Convex hook calls where wrapper coverage exists.

## 3. Controller/composition adoption

- [ ] 3.1 Introduce page/controller hooks for large web routes where composing domain wrappers materially reduces page complexity.
- [ ] 3.2 Keep route files focused on layout, composition, and local interaction state after wrapper adoption.
- [ ] 3.3 Confirm wrapper-hook adoption aligns with adjacent web refactor changes rather than duplicating async-flow or page-composition abstractions.

## 4. Verification

- [ ] 4.1 Run targeted web tests for settings, outbound, and tours flows touched by the migration.
- [ ] 4.2 Run `pnpm --filter @opencom/web typecheck`.
- [ ] 4.3 Run `openspec validate introduce-web-local-convex-wrapper-hooks --strict --no-interactive`.
