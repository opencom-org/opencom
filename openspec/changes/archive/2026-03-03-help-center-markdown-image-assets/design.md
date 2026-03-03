## Context

The Help Center currently supports markdown import/export for article text, but the import pipeline only ingests markdown files and ignores local images. Users who maintain docs in local folders cannot keep inline images working after sync. At runtime, article rendering is inconsistent: the widget renders sanitized markdown, while the public web article page renders newline-split plain text.

This change crosses Convex data model, import/export logic, authoring UI, and both rendering surfaces (web + widget). It also introduces file lifecycle requirements (upload validation, reference integrity, and deletion behavior).

## Goals / Non-Goals

**Goals:**

- Support uploading image files as part of markdown folder imports.
- Preserve image references by converting local markdown image paths into stable, storage-backed references.
- Provide first-class image upload/insert support in the article editor.
- Render article images consistently in web help pages and widget article detail views.
- Support export round-trip by including binaries and rewriting references to portable relative paths.
- Enforce safety constraints for file type, size, protocol handling, and deletion cleanup.

**Non-Goals:**

- Supporting non-image binary media (video/audio/PDF) in this change.
- Replacing the existing article editor with a rich WYSIWYG editor.
- Public CDN persistence with never-expiring URLs (Convex signed URL retrieval remains source of truth).

## Decisions

### 1) Add explicit `articleAssets` metadata table

Decision:

- Introduce a new `articleAssets` table keyed by workspace with links to storage and optional article/import associations.
- Core fields: `workspaceId`, `articleId?`, `importSourceId?`, `storageId`, `assetKey`, `fileName`, `mimeType`, `size`, `width?`, `height?`, `createdBy?`, `createdAt`, `updatedAt`, `deletedAt?`.
- Add indexes for workspace scope, per-article listing, and import-source lookup.

Rationale:

- Existing `articles.content` string cannot support lifecycle operations, dedupe, export mapping, or cleanup.
- Explicit metadata is required to safely manage storage-backed files and references.

Alternatives considered:

- Embed raw Convex URLs in markdown only: rejected because URLs are not stable for lifecycle/export and complicate cleanup.
- Store binary payloads in article documents: rejected due to size and indexing limitations.

### 2) Use stable internal markdown reference format

Decision:

- Rewrite image references to `oc-asset://<assetId>` at import/upload time.
- Add shared resolver helpers that map `oc-asset://` references to fresh `ctx.storage.getUrl(...)` URLs per request.

Rationale:

- Decouples article content from storage URL volatility.
- Enables export to remap references back to relative file paths deterministically.

Alternatives considered:

- Keep original relative paths in stored markdown: rejected because runtime renderers lack source-folder context.
- Store absolute app URLs: rejected because it creates environment coupling and brittle migrations.

### 3) Two-phase folder import: assets first, markdown second

Decision:

- Extend import payload to accept both markdown files and image files.
- Stage valid images to storage and build a normalized relative-path lookup map.
- Parse markdown image tokens, resolve file-relative paths, and rewrite to stable asset references before article upsert.

Rationale:

- Markdown rewrite depends on known uploaded asset identities.
- Path normalization and rewrite must happen centrally to avoid client-specific behavior drift.

Alternatives considered:

- Parse markdown client-side and upload only referenced images: rejected due to trust boundary, complexity, and inconsistent behavior.

### 4) Render markdown consistently in web and widget

Decision:

- Reuse markdown + sanitize behavior for web Help article view, then resolve asset refs before rendering.
- Keep widget parser behavior, but add support for `oc-asset://` resolution and ensure image styling parity.

Rationale:

- The same article content must produce equivalent safe output on both surfaces.
- Existing widget parser already supports safe `<img>` output and is a strong baseline.

Alternatives considered:

- Continue plain text on web and markdown in widget: rejected because it breaks capability consistency and image support.

### 5) Export round-trip fidelity over literal source preservation

Decision:

- On export, bundle image binaries into deterministic asset paths (for example `_assets/<asset-key>/<filename>`).
- Rewrite `oc-asset://` references to relative markdown paths during export generation.

Rationale:

- Users need a portable folder that works locally and can be re-imported without manual edits.
- Deterministic paths simplify diffing and repeated exports.

Alternatives considered:

- Export markdown with unresolved internal refs: rejected because exported docs would not render locally.

## Risks / Trade-offs

- [Risk] Import complexity increases (path resolution + file staging + rewrite).
  → Mitigation: isolate resolver/rewrite functions with focused unit tests and fixtures for edge paths.

- [Risk] Orphaned storage files from failed imports or deleted references.
  → Mitigation: transactional metadata writes where possible, plus periodic orphan cleanup task.

- [Risk] Signed URL lookup overhead during rendering.
  → Mitigation: resolve only referenced assets in a document and cache per request/render pass.

- [Risk] Existing markdown with raw external images remains mixed with internal asset refs.
  → Mitigation: allow safe external `https` images; only rewrite local refs during import/editor upload.

## Migration Plan

1. Add schema for `articleAssets` and deploy Convex indexes.
2. Add backend upload/finalize/list/delete + reference-resolution helpers.
3. Extend markdown import API to accept image files and rewrite refs.
4. Update web article editor with image upload/insert and basic asset manager.
5. Update web help article rendering to markdown + sanitized HTML + asset resolution.
6. Update widget article render path to resolve internal asset refs.
7. Extend markdown export to include image files and relative ref rewriting.
8. Add tests and run focused package checks.

Rollback strategy:

- Feature-gate new import payload handling and editor upload affordances.
- If needed, disable rewrite and continue serving existing markdown without asset refs.
- Existing article markdown remains valid text, so rollback impact is bounded.

## Open Questions

- Should asset deletion be hard-blocked when referenced, or allow soft-delete + warning?
- What max image size/type limits should be product defaults (for example 5MB and common web formats)?
- Do we need explicit image alt-text linting for accessibility in this phase, or defer?
