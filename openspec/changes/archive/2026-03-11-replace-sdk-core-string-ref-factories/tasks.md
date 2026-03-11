## 1. Ref inventory and guardrails

- [x] 1.1 Freeze the March 11, 2026 sdk-core factory inventory and define the approved fixed-ref pattern for covered wrapper modules.
- [x] 1.2 Add or update guard coverage that fails if covered sdk-core API files reintroduce `getQueryRef(name: string)` or `getMutationRef(name: string)`.

## 2. Replace session and messaging-facing factories

- [x] 2.1 Replace generic selector helpers in `sessions.ts`, `conversations.ts`, `visitors.ts`, `tickets.ts`, and `outbound.ts` with explicit fixed refs.
- [x] 2.2 Preserve current wrapper contracts and update any touched sdk-core tests or fixtures for those domains.

## 3. Replace content and automation-facing factories

- [x] 3.1 Replace generic selector helpers in `aiAgent.ts`, `articles.ts`, `carousels.ts`, `checklists.ts`, `commonIssues.ts`, `events.ts`, and `officeHours.ts`.
- [x] 3.2 Keep any required `TS2589` workaround localized to fixed ref declarations or another explicit shallow boundary.

## 4. Verification

- [x] 4.1 Run `pnpm --filter @opencom/sdk-core typecheck`.
- [x] 4.2 Run targeted sdk-core tests for the touched wrapper modules.
- [x] 4.3 Run `openspec validate replace-sdk-core-string-ref-factories --strict --no-interactive`.
