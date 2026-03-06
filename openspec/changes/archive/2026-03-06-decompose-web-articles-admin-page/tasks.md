## 1. Contract + Utility Extraction

- [x] 1.1 Extract shared articles-admin local types/constants into a dedicated module.
- [x] 1.2 Extract pure helper utilities from `page.tsx` into a dedicated module.

## 2. Render Section Extraction

- [x] 2.1 Extract markdown import/export/history render section into a dedicated component.
- [x] 2.2 Extract article filters + table/empty-state render section into a dedicated component.
- [x] 2.3 Extract delete confirmation dialog into a dedicated component.

## 3. Recomposition + Verification

- [x] 3.1 Recompose `apps/web/src/app/articles/page.tsx` around orchestration + extracted sections.
- [x] 3.2 Run `pnpm --filter @opencom/web typecheck`.
- [x] 3.3 Record progress docs and refresh the remaining-slices map.
