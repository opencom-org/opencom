## 1. Foundation

- [x] 1.1 Create a minimal mobile-local Convex adapter layer for thin typed hook primitives.
- [x] 1.2 Define conventions for mobile domain wrapper placement, naming, and explicit local typing boundaries.
- [x] 1.3 Ensure unavoidable casts or `@ts-expect-error` usage are centralized outside mobile screens and context files, with `app/_layout.tsx` remaining the only accepted direct provider boundary.

## 2. Initial domain migrations

- [x] 2.1 Add wrapper hooks for auth/workspace selection and onboarding domains, then migrate `apps/mobile/src/contexts/AuthContext.tsx` and `apps/mobile/app/(app)/onboarding.tsx`.
- [x] 2.2 Add wrapper hooks for notification and settings domains, then migrate `apps/mobile/src/contexts/NotificationContext.tsx` and `apps/mobile/app/(app)/settings.tsx`.
- [x] 2.3 Add wrapper hooks for inbox and conversation flows, then migrate `apps/mobile/app/(app)/index.tsx` and `apps/mobile/app/(app)/conversation/[id].tsx`.
- [x] 2.4 Confirm no new mobile screen or context file outside the provider boundary imports `convex/react` directly once its domain wrapper exists.

## 3. Controller/context adoption

- [x] 3.1 Update mobile contexts and screen/controller hooks to compose domain wrappers without owning generated hook details.
- [x] 3.2 Keep navigation/state ownership and data-access wrapper ownership distinct during migration.
- [x] 3.3 Confirm wrapper adoption aligns with mobile parity and shared onboarding-domain changes rather than duplicating them.

## 4. Verification

- [x] 4.1 Run targeted mobile tests or flow checks for onboarding, inbox, and settings modules touched by the migration.
- [x] 4.2 Run `pnpm --filter @opencom/mobile typecheck` and any relevant workspace typecheck commands for mobile-touched code.
- [x] 4.3 Run `openspec validate introduce-mobile-local-convex-wrapper-hooks --strict --no-interactive`.
