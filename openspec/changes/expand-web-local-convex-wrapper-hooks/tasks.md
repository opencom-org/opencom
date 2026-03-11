## 1. Inventory and guardrails

- [ ] 1.1 Freeze the March 11, 2026 web direct-import inventory and record the approved provider, adapter, and test exceptions.
- [ ] 1.2 Extend web hardening guard coverage so newly covered files fail verification if they keep direct `convex/react` imports.

## 2. Migrate shared auth, reporting, and visitor domains

- [ ] 2.1 Add or extend wrapper/controller coverage for `AuthContext`, onboarding/help flows, and shared component consumers such as `AppSidebar`, `AudienceRuleBuilder`, `SuggestionsPanel`, and `WorkspaceSelector`.
- [ ] 2.2 Migrate reporting, visitors, inbox list, snippets, and segments modules away from direct `convex/react` and inline `makeFunctionReference(...)` usage.

## 3. Migrate settings and CRUD admin routes

- [ ] 3.1 Add wrapper/controller coverage for the remaining settings sections and `useTeamMembersSettings.ts`.
- [ ] 3.2 Migrate remaining tours, surveys, tickets, campaigns email, and outbound routes to local wrapper hooks or route controllers.

## 4. Verification

- [ ] 4.1 Run `pnpm --filter @opencom/web typecheck`.
- [ ] 4.2 Run targeted web tests for touched wrapper and hardening-guard domains.
- [ ] 4.3 Run `openspec validate expand-web-local-convex-wrapper-hooks --strict --no-interactive`.
