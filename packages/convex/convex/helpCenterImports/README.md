# Help Center Import/Export Pipeline Modules

This folder splits the Help Center markdown pipeline into explicit stages.

## Stage Ownership

- `markdownParse.ts`
  - Frontmatter extraction and normalization.
  - Import title inference and collection path resolution.
- `referenceRewrite.ts`
  - Markdown/HTML image reference rewrites for import.
  - `oc-asset://` extraction and export-time relative rewrite.
- `pathUtils.ts`
  - Canonical path and slug normalization helpers shared by import/export.
  - Preview/path-dedup helpers and import/export frontmatter assembly.
- `syncPipeline.ts`
  - Import apply orchestration (source upsert, collection/article reconciliation, archive records).
- `exportPipeline.ts`
  - Export package orchestration (article selection, asset path mapping, portable markdown generation).
- `sourceQueries.ts`
  - Source list and run-history query aggregation.
- `restorePipeline.ts`
  - Archive restore orchestration for deleted collections/articles.

## Extension Rules

- Keep parsing changes inside `markdownParse.ts`; avoid mixing them into DB orchestration.
- Keep reference rewrite behavior in `referenceRewrite.ts` so import/export path logic stays consistent.
- Reuse `pathUtils.ts` normalization helpers from both sync and export paths.
- When adding new sync/export behavior, update `packages/convex/tests/helpCenterImports.test.ts` first.
