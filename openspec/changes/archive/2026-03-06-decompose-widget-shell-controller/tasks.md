## 1. Shell Helper + Type Extraction

- [x] 1.1 Extract widget shell types into `apps/widget/src/widgetShell/types.ts`.
- [x] 1.2 Extract ticket-form normalization and tab-header helpers into `apps/widget/src/widgetShell/helpers.ts`.

## 2. Main Shell Render Decomposition

- [x] 2.1 Extract tabbed shell render section into `apps/widget/src/widgetShell/WidgetMainShell.tsx`.
- [x] 2.2 Preserve existing tab behavior, actions, unread cues, and ticket-entry flow in the extracted shell component.

## 3. Controller Recomposition + Verification

- [x] 3.1 Recompose `apps/widget/src/Widget.tsx` as orchestration-first controller using extracted `widgetShell` modules.
- [x] 3.2 Run `pnpm --filter @opencom/widget typecheck`.
- [x] 3.3 Run `pnpm --filter @opencom/widget test -- --run src/test/widgetShellOrchestration.test.tsx`.
- [x] 3.4 Run `pnpm --filter @opencom/widget test -- --run src/test/widgetTourStart.test.tsx`.
- [x] 3.5 Run `pnpm --filter @opencom/web typecheck`.
- [x] 3.6 Update refactor progress docs and remaining-map tracker.
