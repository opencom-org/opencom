## 1. Implementation

- [ ] 1.1 Extract high-complexity settings domains from `apps/web/src/app/settings/page.tsx` into dedicated local modules/hooks while preserving behavior.
- [ ] 1.2 Reduce `settings/page.tsx` to route-level composition, top-level layout, and section orchestration.
- [ ] 1.3 Extract ticket forms list/editor concerns from `apps/web/src/app/tickets/forms/page.tsx` into dedicated local modules.
- [ ] 1.4 Preserve field CRUD, ordering, save, and delete semantics for ticket forms during extraction.

## 2. Verification

- [ ] 2.1 Run targeted web tests for settings and ticket forms touched by the refactor.
- [ ] 2.2 Run `pnpm --filter @opencom/web typecheck`.
- [ ] 2.3 Run `openspec validate refactor-web-admin-page-composition --strict --no-interactive`.
