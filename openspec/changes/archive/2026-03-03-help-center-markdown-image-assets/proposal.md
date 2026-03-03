## Why

Help Center markdown imports currently only accept `.md` files, so local image assets are dropped and referenced images break after upload. We also have inconsistent article rendering behavior between web help pages and the widget, which makes markdown capability unpredictable for users.

## What Changes

- Extend Help Center folder import to ingest image files alongside markdown files.
- Upload imported images to Convex storage and map markdown image references to stable internal asset references.
- Persist article asset metadata for lifecycle management, deduplication, and export/restore fidelity.
- Add article editor support for uploading images and inserting markdown references without manual URL hosting.
- Resolve stored asset references to signed URLs at render time for both web help pages and widget article detail views.
- Extend markdown export to include images and rewrite references to portable relative paths in the exported folder.
- Add safety constraints (mime type, size, reference validation, and orphan cleanup) for asset handling.

## Capabilities

### New Capabilities

- `help-center-markdown-media-assets`: Import, store, reference, render, and export markdown-linked image assets for Help Center articles.

### Modified Capabilities

- None.

## Impact

- Convex: `schema.ts`, new/updated article-asset mutations/queries, `helpCenterImports.ts`, and article read/write flows.
- Web app: article editor UX, markdown folder import flow, and help article rendering pipeline.
- Widget: article markdown rendering path for Convex-backed image references.
- Export/import behavior: zipped markdown exports now include image binaries and stable path rewriting.
- Tests: Convex import/export tests, markdown parsing/render tests, and targeted web integration/E2E coverage.
