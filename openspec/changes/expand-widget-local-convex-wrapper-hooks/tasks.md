## 1. Inventory and guardrails

- [ ] 1.1 Freeze the March 11, 2026 widget direct-import inventory and record the approved adapter, bootstrap, and test exceptions.
- [ ] 1.2 Extend widget hardening guard coverage so newly covered runtime files fail verification if they keep direct `convex/react` imports.

## 2. Migrate shell, session, and tracking boundaries

- [ ] 2.1 Add or extend wrapper coverage for `Widget.tsx`, `components/Home.tsx`, `useWidgetSession.ts`, `useWidgetShellValidation.ts`, `useEventTracking.ts`, and `useNavigationTracking.ts`.
- [ ] 2.2 Migrate `useWidgetConversationFlow.ts` and `useWidgetTicketFlow.ts` to consume widget-local wrappers or feature-local typed ref helpers instead of direct hook imports.

## 3. Migrate overlay and tour-support domains

- [ ] 3.1 Add or extend wrapper coverage for outbound, checklist, survey, CSAT, authoring, and tooltip overlay modules.
- [ ] 3.2 Migrate `tourOverlay/useTourOverlaySession.ts` and update any touched widget runtime tests that pin the old direct-hook boundary.

## 4. Verification

- [ ] 4.1 Run `pnpm --filter @opencom/widget typecheck`.
- [ ] 4.2 Run targeted widget tests for touched wrapper and hardening-guard domains.
- [ ] 4.3 Run `openspec validate expand-widget-local-convex-wrapper-hooks --strict --no-interactive`.
