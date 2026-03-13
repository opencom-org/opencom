# AI Source Metadata Contract

This document defines the source payload contract used by AI responses across Convex, widget UI, and inbox AI review surfaces.

## Source Shape

Each source entry includes:

- `type: string` - knowledge source type (for example `article`, `internalArticle`, or `snippet`)
- `id: string` - source record identifier from retrieval
- `title: string` - human-readable source title
- `articleId?: string` - optional explicit Help Center article ID for link navigation

## Linking Rules

- `articleId` is the canonical navigation field when present.
- For legacy records, `type === "article"` falls back to `id` as the article identifier.
- Non-article sources remain visible as attribution labels and must not render clickable article links.

Shared helper: `resolveArticleSourceId(...)` in `@opencom/web-shared` applies this logic for all frontend surfaces.

## UI Expectations

- Widget AI messages:
  - Article sources render as clickable controls that open the Help Center article view.
  - Non-article sources render as plain attribution text.
- Inbox AI review:
  - Article sources render as clickable controls that route to `/articles/<articleId>`.
  - Non-article sources remain non-clickable attribution entries.
