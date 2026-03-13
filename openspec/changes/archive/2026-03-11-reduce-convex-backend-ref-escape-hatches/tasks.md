## 1. Hotspot inventory and guardrails

- [x] 1.1 Freeze the March 11, 2026 backend hotspot inventory and define the preferred fixed-ref helper shape for each covered module.
- [x] 1.2 Update backend guard coverage so new `unsafeApi` / `unsafeInternal` object casts or expanded hotspot files are caught deliberately.

## 2. Narrow the broadest object-cast hotspots

- [x] 2.1 Replace broad object-cast ref selection in `aiAgentActions.ts`, `outboundMessages.ts`, and `carousels/triggering.ts` with explicit fixed refs or narrow local ref helpers.
- [x] 2.2 Preserve AI agent, outbound push, and carousel triggering runtime behavior while keeping any remaining shallow runner cast localized.

## 3. Tighten the remaining narrow workarounds

- [x] 3.1 Review `widgetSessions.ts` and `push.ts` to reduce broad `as unknown as` boundaries where explicit typed helpers can carry the same contract.
- [x] 3.2 Document any residual exception that still cannot be narrowed further after local experimentation.

## 4. Verification

- [x] 4.1 Run `pnpm --filter @opencom/convex typecheck`.
- [x] 4.2 Run targeted Convex tests covering touched hotspot domains and backend hardening guards.
- [x] 4.3 Run `openspec validate reduce-convex-backend-ref-escape-hatches --strict --no-interactive`.
