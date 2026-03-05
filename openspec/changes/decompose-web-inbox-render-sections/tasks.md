## 1. Render Section Boundaries

- [x] 1.1 Add typed render-section prop contracts for inbox conversation, message, and AI-review display data.
- [x] 1.2 Extract conversation list pane into a dedicated component.

## 2. Thread + Side Panel Extraction

- [x] 2.1 Extract thread pane rendering (header, message list, composer overlays) into a dedicated component.
- [x] 2.2 Extract AI review panel rendering into a dedicated component.

## 3. Recomposition + Verification

- [x] 3.1 Recompose `inbox/page.tsx` to use extracted render sections while preserving behavior and test selectors.
- [x] 3.2 Run `@opencom/web` typecheck and focused inbox tests.
- [x] 3.3 Document progress and refresh remaining-slices map.
