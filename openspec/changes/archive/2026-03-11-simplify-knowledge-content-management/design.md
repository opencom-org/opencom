## Context

Knowledge content is currently split across multiple backend models and web surfaces:
- Public help content lives in `articles` and is organized with `collections`.
- Internal-only knowledge lives in `internalArticles` and is managed from `/knowledge`.
- Both articles and snippets still reference `contentFolders`, even though help-center browse already depends on collections.
- Inbox exposes three overlapping affordances: snippet picker, article link search, and a broader knowledge panel.
- AI settings, embeddings, and recent-content tracking encode the split directly through `articles`, `internalArticles`, and `snippets`.

This change is cross-cutting because it touches schema, migration, search, AI settings, inbox authoring, navigation, and legacy route compatibility. The main constraint is migration safety: internal knowledge must remain available to agents and AI while visitor-facing help center behavior remains unchanged for public content.

## Goals / Non-Goals

**Goals:**
- Consolidate public and internal article authoring into one article model and one articles admin surface.
- Retire folder-based article organization and standardize article organization on collections.
- Replace multiple inbox knowledge insertion controls with one consolidated picker.
- Preserve existing public help center behavior for public articles while keeping internal articles private to agent-facing flows.
- Provide a migration path that preserves authored content, timestamps, ownership metadata, and operational references.

**Non-Goals:**
- Merging snippets into the article schema.
- Rebuilding the public help center information architecture or widget article reader.
- Introducing a rich-text editor or redesigning markdown import/export semantics.
- Expanding snippet taxonomy beyond what is needed to remove folder dependency.

## Decisions

### 1) Consolidate on a single `articles` domain with explicit visibility

Decision:
- Extend the existing `articles` table and related APIs to support both public and internal knowledge through a new visibility field such as `public` or `internal`.
- Promote article lifecycle to a shared status model so internal and public articles use the same authoring and publish/archive workflow.
- Carry forward internal-article-specific metadata that remains useful in the unified model, including tags and legacy identity needed for migration compatibility.

Rationale:
- `articles` already powers public browse, imports, editor flows, and widget/article APIs. Extending that domain is lower risk than replacing it with a new abstraction.
- A visibility field keeps the mental model simple: one content type, two publication surfaces.
- Shared lifecycle rules reduce duplicated mutations, duplicated filters, and duplicated AI/search plumbing.

Alternatives considered:
- Keep `articles` and `internalArticles` as separate tables with a shared UI shell: rejected because it preserves split queries, split embeddings, split AI settings, and migration cost later.
- Merge public articles into `internalArticles`: rejected because it would force larger changes to established help-center and widget flows that already depend on `articles`.

### 2) Retire `contentFolders`; use collections for article organization and flat searchable snippets

Decision:
- Remove folder-based article organization and make collections the only hierarchical taxonomy for articles.
- Allow collections to contain both public and internal articles, but keep visitor-facing collection browse filtered to published public articles only.
- Remove snippet dependency on folders and rely on inbox search, shortcuts, and lightweight snippet administration instead of a hierarchical snippet tree.

Rationale:
- Collections already represent the canonical browse structure for help-center content, so keeping folders in parallel creates two ways to organize the same article.
- Mixed-visibility collections are safe because public surfaces can continue filtering by article visibility and published state.
- Snippets are most useful through recall speed, not hierarchy depth; folder removal simplifies authoring and inbox retrieval.

Alternatives considered:
- Preserve both folders and collections with clearer labeling: rejected because it keeps the core ambiguity this change is trying to remove.
- Convert folders into a second taxonomy layer under collections: rejected because it increases management overhead and does not simplify the model.

### 3) Use a phased migration with compatibility mapping instead of a big-bang cutover

Decision:
- Introduce compatibility fields and read paths first, backfill legacy internal articles into unified articles, then switch UI/routes/queries to the unified model before removing legacy code.
- Preserve a legacy-to-unified mapping so old internal article URLs, recent-content records, and background references can be redirected or rewritten safely.
- Backfill article organization from legacy folders into collections or root placement, while stripping snippet folder dependency without blocking snippet access.

Rationale:
- Convex document IDs change when records move tables, so compatibility mapping is needed to avoid broken routes and stale references.
- A phased rollout reduces risk for AI retrieval and inbox authoring flows that currently depend on legacy content types.
- This approach allows verification of counts and search parity before deleting old models.

Alternatives considered:
- Direct one-shot migration with immediate deletion of legacy tables/routes: rejected because it makes rollback difficult and increases blast radius.

### 4) Replace three inbox insert surfaces with one knowledge picker plus inline snippet actions

Decision:
- Replace the snippet picker, article search picker, and knowledge panel with one consolidated knowledge picker that can return snippets and articles together.
- Define explicit insertion actions per result type so article insertion remains intentional instead of relying on whichever legacy picker was used.
- Add inline snippet creation and update flows in inbox for common authoring actions.

Rationale:
- The current inbox composer duplicates search and insertion concepts across three overlapping controls.
- A consolidated picker shortens the path from “I need reusable knowledge” to “insert it now”.
- Inline snippet maintenance supports the user goal of making snippets inbox-first without forcing a context switch to a dedicated screen for routine edits.

Alternatives considered:
- Keep separate pickers and only improve styling or search quality: rejected because it keeps the workflow fragmentation.
- Remove snippet management from web entirely and force inbox-only CRUD: rejected because teams still need a lightweight management surface outside active conversations.

### 5) Keep AI source controls visibility-aware even after article unification

Decision:
- Update AI settings and knowledge retrieval to query the unified article model while preserving independent control over public-article and internal-article inclusion.
- Normalize recent-content access, knowledge search results, and embeddings around unified articles plus snippets.

Rationale:
- Teams still need policy control over whether AI can use public help content, internal knowledge, or both.
- Preserving separate visibility-aware controls maintains operator intent while removing the implementation split.

Alternatives considered:
- Collapse AI source controls to a single “articles” toggle: rejected because it removes a meaningful operational control.

## Risks / Trade-offs

- [Risk] Migrating `internalArticles` into `articles` changes IDs and can break links or historical references.
  - Mitigation: add compatibility mapping, rewrite or dual-read recent-content and AI references, and redirect legacy routes before deleting old paths.
- [Risk] Mixed-visibility collections may make admin taxonomy noisier.
  - Mitigation: add visibility-aware filters, counts, and badges in admin views so internal/public composition stays obvious.
- [Risk] Removing snippet folders may reduce organization for teams with many saved replies.
  - Mitigation: ensure consolidated picker search remains fast and preserve shortcut-based recall; evaluate lightweight snippet metadata after rollout if needed.
- [Risk] A unified inbox picker can make insertion semantics ambiguous.
  - Mitigation: expose explicit insertion actions and type labels rather than implicit behavior hidden behind separate controls.

## Migration Plan

1. Extend the article schema and APIs with visibility-aware fields, shared status handling, and compatibility metadata for migrated internal articles.
2. Backfill internal articles into the unified article model and migrate legacy folder-backed article organization into collections or root-level placement.
3. Update article search, knowledge search, recent-content tracking, AI settings, and embedding generation to read unified articles plus snippets.
4. Replace `/knowledge` and legacy internal-article routes with redirects into the unified article management flow while preserving legacy lookups during rollout.
5. Replace the inbox snippet picker, article-link picker, and knowledge panel with one consolidated knowledge picker and inline snippet actions.
6. Verify public help-center counts, widget article visibility, AI retrieval scope, and inbox insertion parity before removing legacy tables and folder dependencies.

Rollback strategy:
- Keep legacy `internalArticles` readers and route redirects available until post-migration verification is complete.
- Ship unified admin and inbox flows behind a feature flag or guarded rollout switch.
- If rollout regressions appear, switch UI back to legacy surfaces while retaining backfilled data and compatibility mapping.

## Open Questions

- Should public article insertion from inbox default to article-link insertion, content insertion, or offer both equally in the first-release picker UI?
- Does the articles admin need inline collection creation for the migration rollout, or is the existing collections management surface sufficient?
- After snippet folders are removed, do teams need lightweight snippet labels/tags immediately, or can search plus shortcuts cover the initial release?
