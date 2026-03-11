## 1. Unified Article Schema And Migration Foundations

- [x] 1.1 Extend the `articles` domain with visibility-aware fields, shared lifecycle status handling, and compatibility metadata needed to absorb legacy internal articles.
- [x] 1.2 Implement migration/backfill logic from `internalArticles` and folder-backed article organization into unified articles plus collection assignments or root placement.
- [x] 1.3 Add compatibility handling for legacy internal article links and operational references, including recent-content records and article lookups used by agent workflows.

## 2. Article Management And Taxonomy Simplification

- [x] 2.1 Update Convex article, collection, import/export, and search APIs to use unified articles and collection-only article organization.
- [x] 2.2 Update the web articles admin/editor to manage public and internal articles in one workflow with visibility, status, and collection-aware filters.
- [x] 2.3 Remove Knowledge-page article management entry points and redirect legacy article-management routes into the unified articles experience.

## 3. Inbox Knowledge Workflow Consolidation

- [x] 3.1 Replace the inbox snippet picker, article search picker, and knowledge panel with one consolidated knowledge picker for snippets and articles.
- [x] 3.2 Implement explicit insertion actions for snippets and articles within the consolidated picker, including inline snippet create/update flows.
- [x] 3.3 Remove snippet dependency on folder hierarchy while preserving inbox search, shortcuts, and agent-facing snippet maintenance.

## 4. AI, Search, And Retrieval Alignment

- [x] 4.1 Update AI settings and retrieval logic to query unified articles with independent public/internal visibility controls plus snippets.
- [x] 4.2 Update knowledge search, recent/frequent content tracking, and embeddings to treat unified articles as the canonical article source.
- [x] 4.3 Verify public help center and widget article browse continue to expose only published public articles after unification.

## 5. Verification

- [x] 5.1 Add targeted Convex tests for unified article migration, visibility filtering, collection counts, and AI knowledge-source selection.
- [x] 5.2 Add targeted web tests for unified article management and the consolidated inbox knowledge picker/snippet workflows.
- [x] 5.3 Run focused package checks for touched areas and strict `openspec validate simplify-knowledge-content-management --strict --no-interactive`.
