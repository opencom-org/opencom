## 1. Implementation

- [ ] 1.1 Extract authentication, workspace resolution, and permission enforcement responsibilities into clearer Convex boundary modules.
- [ ] 1.2 Keep query/mutation/action wrappers thin and orchestration-focused.
- [ ] 1.3 Consolidate overlapping auth/session/internal mutation backend test helpers.
- [ ] 1.4 Preserve all existing authorization and workspace access outcomes during the refactor.

## 2. Verification

- [ ] 2.1 Run targeted Convex tests covering authorization and auth/session helper behavior in touched areas.
- [ ] 2.2 Run `pnpm --filter @opencom/convex typecheck`.
- [ ] 2.3 Run `openspec validate refactor-convex-auth-and-workspace-boundaries --strict --no-interactive`.
