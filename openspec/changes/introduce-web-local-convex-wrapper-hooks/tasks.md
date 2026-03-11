## 1. Foundation

- [x] 1.1 Create a minimal web-local Convex adapter layer for thin typed hook primitives in `apps/web`.
- [x] 1.2 Define conventions for domain wrapper hook placement, naming, and explicit local typing boundaries.
- [x] 1.3 Ensure new wrapper-layer escape hatches centralize any unavoidable casts or `@ts-expect-error` usage.

## 2. Initial domain migrations

- [x] 2.1 Add domain-specific wrapper hooks for the current settings and messaging admin hotspot files: `src/app/settings/page.tsx`, `src/app/settings/MessengerSettingsSection.tsx`, and `src/app/inbox/page.tsx`.
- [x] 2.2 Add domain-specific wrapper hooks for the current content and support authoring hotspot files: `src/app/articles/page.tsx`, `src/app/articles/[id]/page.tsx`, and `src/app/articles/collections/page.tsx`.
- [x] 2.3 Add domain-specific wrapper hooks for the current campaigns/outbound/checklists/tooltips hotspot files: `src/app/campaigns/page.tsx`, `src/app/campaigns/push/[id]/page.tsx`, `src/app/campaigns/carousels/[id]/page.tsx`, `src/app/campaigns/series/[id]/page.tsx`, `src/app/outbound/[id]/page.tsx`, `src/app/checklists/page.tsx`, `src/app/checklists/[id]/page.tsx`, and `src/app/tooltips/page.tsx`.
- [x] 2.4 Migrate covered UI files away from direct generated Convex hook calls and page-local `makeFunctionReference(...)` escape hatches where wrapper coverage exists.

## 3. Controller/composition adoption

- [x] 3.1 Introduce page/controller hooks for large web routes where composing domain wrappers materially reduces page complexity.
- [x] 3.2 Keep route files focused on layout, composition, and local interaction state after wrapper adoption.
- [x] 3.3 Confirm wrapper-hook adoption aligns with adjacent web refactor changes rather than duplicating async-flow or page-composition abstractions.

## 4. Verification

- [x] 4.1 Run targeted web tests for settings, outbound, and tours flows touched by the migration.
- [x] 4.2 Run `pnpm --filter @opencom/web typecheck`.
- [x] 4.3 Run `openspec validate introduce-web-local-convex-wrapper-hooks --strict --no-interactive`.
