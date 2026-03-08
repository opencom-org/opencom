## 1. Foundation

- [ ] 1.1 Create a minimal mobile-local Convex adapter layer for thin typed hook primitives.
- [ ] 1.2 Define conventions for mobile domain wrapper placement, naming, and explicit local typing boundaries.
- [ ] 1.3 Ensure unavoidable casts or `@ts-expect-error` usage are centralized outside mobile screens and context files.

## 2. Initial domain migrations

- [ ] 2.1 Add wrapper hooks for auth/workspace selection and onboarding domains.
- [ ] 2.2 Add wrapper hooks for inbox/conversation and notification-related mobile domains.
- [ ] 2.3 Add wrapper hooks for settings and parity-driven supporting flows.
- [ ] 2.4 Migrate covered mobile screens and contexts away from direct generated Convex hook calls where wrapper coverage exists.

## 3. Controller/context adoption

- [ ] 3.1 Update mobile contexts and screen/controller hooks to compose domain wrappers without owning generated hook details.
- [ ] 3.2 Keep navigation/state ownership and data-access wrapper ownership distinct during migration.
- [ ] 3.3 Confirm wrapper adoption aligns with mobile parity and shared onboarding-domain changes rather than duplicating them.

## 4. Verification

- [ ] 4.1 Run targeted mobile tests or flow checks for onboarding, inbox, and settings modules touched by the migration.
- [ ] 4.2 Run relevant workspace typecheck commands for mobile-touched code.
- [ ] 4.3 Run `openspec validate introduce-mobile-local-convex-wrapper-hooks --strict --no-interactive`.
