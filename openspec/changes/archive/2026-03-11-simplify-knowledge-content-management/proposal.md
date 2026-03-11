## Why

Knowledge content is currently split across `/articles`, `/knowledge`, and `/snippets`, with separate data models for public articles, internal articles, snippets, collections, and folders. That makes authoring, search, AI configuration, and inbox reuse harder to reason about, and it leaves agents switching between multiple surfaces for content that is conceptually part of the same knowledge system.

## What Changes

- Define a single article-management model for both public help content and internal-only knowledge, with explicit visibility semantics instead of a separate internal-article product surface.
- **BREAKING** Remove the dedicated Knowledge page and internal-article workflow once the unified article-management flow is in place.
- Replace the parallel use of collections and content folders for article organization with one primary taxonomy for knowledge content.
- Promote inbox knowledge insertion to a first-class workflow so snippets and other agent-facing knowledge can be found and inserted from inbox without depending on separate management screens during active support work.
- Align search, recent-content access, AI knowledge-source settings, and embeddings with the simplified content model so knowledge content no longer behaves like unrelated silos.

## Capabilities

### New Capabilities

- `unified-knowledge-content-model`: Manage public and internal articles through one article model and one admin surface with explicit visibility rules.
- `knowledge-organization-taxonomy`: Define a single organizational system for knowledge content instead of maintaining overlapping collections and folders.
- `inbox-knowledge-insertion`: Make inbox the primary workflow for finding and inserting snippets and other agent-facing knowledge while preserving lightweight administration for reusable content.

### Modified Capabilities

- None.

## Impact

- Convex: `articles`, `internalArticles`, `snippets`, `contentFolders`, `knowledge`, `aiAgent`, embeddings, schema definitions, and migration/backfill flows.
- Web app: `/articles`, `/articles/[id]`, `/articles/collections`, `/knowledge`, `/knowledge/internal/*`, `/snippets`, `/inbox`, sidebar navigation, and AI settings.
- Data model and settings: internal-article records, folder assignments, recent-content access records, and AI knowledge-source configuration.
- Tests: targeted Convex coverage for migration/query behavior and web coverage for unified article management and inbox insertion flows.
