## 1. Editor Domain Extraction

- [x] 1.1 Extract survey-editor shared types/constants from `page.tsx` into dedicated modules.
- [x] 1.2 Extract question CRUD/reorder/default-option logic into a dedicated hook.

## 2. Survey Tab Component Extraction

- [x] 2.1 Extract builder-tab UI into a dedicated section component.
- [x] 2.2 Extract targeting-tab UI into a dedicated section component.
- [x] 2.3 Extract settings-tab UI into a dedicated section component.
- [x] 2.4 Extract analytics-tab UI into a dedicated section component.

## 3. Page Recomposition + Verification

- [x] 3.1 Recompose `surveys/[id]/page.tsx` to orchestrate extracted modules while preserving behavior.
- [x] 3.2 Run `@opencom/web` typecheck and relevant tests for touched survey editor paths.
- [x] 3.3 Record progress in docs and update remaining-slices tracker as needed.
