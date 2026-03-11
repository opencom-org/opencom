## 1. Tour Editor Contract Extraction

- [x] 1.1 Extract shared tour-editor types/defaults/helper logic from `page.tsx` into dedicated local module(s).

## 2. Panel Extraction

- [x] 2.1 Extract the tour steps list/actions panel into a dedicated component.
- [x] 2.2 Extract the tour settings panel into a dedicated component.
- [x] 2.3 Extract the step create/edit modal into a dedicated component.

## 3. Recomposition + Verification

- [x] 3.1 Recompose `tours/[id]/page.tsx` using the extracted modules while preserving behavior.
- [x] 3.2 Run `@opencom/web` typecheck and relevant tours-focused verification for touched paths.
- [x] 3.3 Record progress in refactor docs and refresh task status.
