## 1. Data Model And Backend Asset APIs

- [x] 1.1 Add `articleAssets` table and indexes in Convex schema for workspace/article/import-source scoping.
- [x] 1.2 Implement asset helpers for canonical `oc-asset://<assetId>` parsing, validation, and reference extraction from markdown.
- [x] 1.3 Add Convex mutations/queries to generate upload URLs, finalize image assets, list article assets, and delete unused assets.
- [x] 1.4 Enforce upload validation constraints (supported image mime types, max size, workspace ownership checks).

## 2. Import And Export Pipeline Updates

- [x] 2.1 Extend markdown folder sync payload and frontend folder selection logic to include image files.
- [x] 2.2 Update import processing to stage image files, resolve file-relative markdown image paths, and rewrite to canonical internal asset references.
- [x] 2.3 Add unresolved-reference reporting in import preview/apply responses without failing whole import runs.
- [x] 2.4 Extend markdown export to include image binaries and rewrite internal asset references to relative paths in exported markdown.
- [x] 2.5 Ensure re-import path normalization and matching supports exported asset folder structure.

## 3. Rendering Parity Across Web And Widget

- [x] 3.1 Add/extend shared markdown rendering in web Help article pages to render sanitized markdown instead of newline-split plain text.
- [x] 3.2 Resolve internal asset references to signed URLs in web rendering flow before HTML output.
- [x] 3.3 Update widget article markdown rendering to resolve internal asset references and keep sanitizer behavior intact.
- [x] 3.4 Add styling rules for article images in widget article detail content for consistent layout.

## 4. Article Editor Image Workflow

- [x] 4.1 Add image upload controls in article editor using Convex upload URL + finalize flow.
- [x] 4.2 Provide markdown snippet insertion for uploaded assets and show per-article asset list.
- [x] 4.3 Add delete/cleanup UX rules that prevent silent dangling references.

## 5. Verification And Regression Coverage

- [x] 5.1 Add Convex tests for import rewriting, unresolved references, export image inclusion, and re-import round-trip.
- [x] 5.2 Add frontend/unit tests for markdown asset reference rendering on web and widget.
- [x] 5.3 Update or add E2E coverage for help-center folder import with local images.
- [x] 5.4 Run targeted package tests/typechecks (`@opencom/convex`, `@opencom/web`, widget tests where touched) and fix regressions.
- [x] 5.5 Validate OpenSpec change strictly and update tracking docs/checklists for completion state.
