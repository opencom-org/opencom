## 1. Implementation

- [ ] 1.1 Create shared web admin helpers/hooks for covered async action flows, confirmation prompts, and normalized feedback.
- [ ] 1.2 Migrate high-duplication covered web admin routes away from bespoke inline async save/delete orchestration.
- [ ] 1.3 Ensure covered routes continue to provide route-specific messaging while using shared action flow primitives.
- [ ] 1.4 Remove raw repetitive boilerplate where shared helpers fully replace it.

## 2. Verification

- [ ] 2.1 Run targeted web tests for covered routes touched by the migration.
- [ ] 2.2 Run `pnpm --filter @opencom/web typecheck`.
- [ ] 2.3 Run `openspec validate standardize-web-admin-async-and-confirmation-flows --strict --no-interactive`.
