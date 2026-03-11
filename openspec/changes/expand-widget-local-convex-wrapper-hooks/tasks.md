## 1. Inventory and guardrails

- [ ] 1.1 Freeze the March 11, 2026 widget direct-import inventory and record the approved adapter, bootstrap, and test exceptions.
- [ ] 1.2 Extend widget hardening guard coverage so newly covered runtime files fail verification if they keep direct `convex/react` imports.
- [ ] 1.3 Record the current adapter escape hatches in `apps/widget/src/lib/convex/hooks.ts` so any residual casts stay deliberate and reviewable.

## 2. Harden the widget adapter boundary

- [ ] 2.1 Review `apps/widget/src/lib/convex/hooks.ts` and replace broad `as never` / `as unknown as` boundaries with narrower typed helpers where Convex typing allows it.
- [ ] 2.2 Keep any unavoidable adapter escape hatches explicit, localized, and covered by the widget hardening guard or targeted tests.

## 3. Migrate shell, session, and tracking boundaries

- [ ] 3.1 Add or extend wrapper coverage for `Widget.tsx`, `components/Home.tsx`, `useWidgetSession.ts`, `useWidgetShellValidation.ts`, `useEventTracking.ts`, and `useNavigationTracking.ts`.
- [ ] 3.2 Migrate `useWidgetConversationFlow.ts` and `useWidgetTicketFlow.ts` to consume widget-local wrappers or feature-local typed ref helpers instead of direct hook imports.

## 4. Migrate overlay and tour-support domains

- [ ] 4.1 Add or extend wrapper coverage for outbound, checklist, survey, CSAT, authoring, and tooltip overlay modules.
- [ ] 4.2 Migrate `tourOverlay/useTourOverlaySession.ts` and update any touched widget runtime tests that pin the old direct-hook boundary.

## 5. Verification

- [ ] 5.1 Run `pnpm --filter @opencom/widget typecheck`.
- [ ] 5.2 Run targeted widget tests for touched wrapper, adapter, and hardening-guard domains.
- [ ] 5.3 Run `openspec validate expand-widget-local-convex-wrapper-hooks --strict --no-interactive`.
