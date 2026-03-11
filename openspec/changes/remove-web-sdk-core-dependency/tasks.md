## 1. Implementation

- [ ] 1.1 Identify the selector-scoring functions and types currently imported from `@opencom/sdk-core` by `apps/web`.
- [ ] 1.2 Extract or re-home the web-safe selector-scoring utilities behind a narrow shared boundary that does not depend on SDK runtime wrappers.
- [ ] 1.3 Update `apps/web` imports to use the new shared boundary and remove the direct `@opencom/sdk-core` dependency if no longer needed.
- [ ] 1.4 Verify the web dependency graph no longer requires SDK runtime API wrapper modules for selector-quality scoring.

## 2. Verification

- [ ] 2.1 Run `pnpm --filter @opencom/web typecheck`.
- [ ] 2.2 Run `pnpm --filter @opencom/web build`.
- [ ] 2.3 Run `openspec validate remove-web-sdk-core-dependency --strict --no-interactive`.
