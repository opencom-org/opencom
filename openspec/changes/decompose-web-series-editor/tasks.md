## 1. Series Editor Contract Extraction

- [x] 1.1 Extract shared series-editor types/helpers from `page.tsx` into a dedicated local module.

## 2. Pane Extraction

- [x] 2.1 Extract sidebar controls/readiness/analytics pane into a dedicated component.
- [x] 2.2 Extract flow canvas pane into a dedicated component.
- [x] 2.3 Extract inspector pane into a dedicated component.

## 3. Recomposition + Verification

- [x] 3.1 Recompose `series/[id]/page.tsx` using extracted pane components while preserving behavior.
- [x] 3.2 Run `@opencom/web` typecheck and relevant tests for touched series editor paths.
- [x] 3.3 Record progress and refresh remaining-slices map.
