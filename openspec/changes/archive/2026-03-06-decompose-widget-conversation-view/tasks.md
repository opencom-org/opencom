## 1. Domain Extraction

- [x] 1.1 Extract conversation view types/constants into `apps/widget/src/components/conversationView/types.ts` and `constants.ts`.
- [x] 1.2 Extract pure helper functions into `apps/widget/src/components/conversationView/helpers.ts`.

## 2. Render Decomposition

- [x] 2.1 Extract message-list render branch into presentational component(s).
- [x] 2.2 Extract footer-state branch (csat, email capture, suggestions, input) into presentational component(s).
- [x] 2.3 Preserve existing selector/classname contracts in extracted components.

## 3. Controller Recomposition + Verification

- [x] 3.1 Recompose `apps/widget/src/components/ConversationView.tsx` as orchestration-first controller.
- [x] 3.2 Run `pnpm --filter @opencom/widget typecheck`.
- [x] 3.3 Run `pnpm --filter @opencom/widget test`.
- [x] 3.4 Run `pnpm --filter @opencom/web typecheck`.
- [x] 3.5 Update refactor progress docs and remaining-map tracker.
