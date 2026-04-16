## Context

Currently, when agents insert article links from the web inbox, the format is `[title](/help/slug)`. This link opens in a new browser tab in the widget, not in the widget's article view. The AI message sources already have a working pattern for opening articles in-widget using `onSelectArticle(articleId)`.

Additionally, the inbox knowledge search uses simple text matching (lowercase includes) while the widget's pre-send suggestions use vector search for better semantic relevance.

## Goals / Non-Goals

**Goals:**

- Article links inserted from inbox open directly in the widget's help center article view
- Widget detects article links in message content and handles them as in-widget navigation
- Inbox knowledge search uses vector search for better relevance matching

**Non-Goals:**

- Changing how AI sources are rendered (already works correctly)
- Changing internal article handling (internal articles are not public and don't have slugs)
- Changing the widget's pre-send article suggestions (already uses vector search)

## Decisions

### 1. Article Link Format

**Decision:** Use `article:<articleId>` as the link URL format (e.g., `[Article Title](article:k57f8d9g2h3j4k5l)`)

**Rationale:**

- Simple to parse in the widget
- Includes the article ID directly (no slug lookup needed)
- Consistent with how AI sources work (they use articleId)
- Avoids URL path conflicts with `/help/slug` format

**Alternatives considered:**

- `/help/slug?aid=articleId` - more complex, requires slug lookup
- `opencom://article/<articleId>` - custom protocol, more complex
- Keep `/help/slug` and add data attribute - requires DOM inspection

### 2. Widget Article Link Detection

**Decision:** Detect `article:` protocol in the shared markdown utility and emit a custom data attribute

**Rationale:**

- Centralized in the shared markdown utility
- Widget can add click handler for elements with the data attribute
- Non-breaking for other surfaces (web inbox can ignore or handle differently)

**Implementation:**

- `packages/web-shared/src/markdown.ts` - detect `article:` URLs, emit `data-article-id` attribute
- `apps/widget/src/components/ConversationView.tsx` - add click handler for `[data-article-id]` elements

### 3. Inbox Knowledge Search

**Decision:** Create a new vector search query for inbox knowledge search

**Rationale:**

- Reuses existing `contentEmbeddings` index and embedding infrastructure
- Consistent with widget suggestions behavior
- Better semantic matching than simple text search

**Implementation:**

- New query `knowledge:searchWithEmbeddings` or modify existing `knowledge:search` to optionally use vector search
- Reuse embedding logic from `suggestions:searchSimilar`

## Risks / Trade-offs

- **Risk:** Article links in old messages won't work after format change
  - **Mitigation:** Widget can detect both old `/help/slug` and new `article:` formats during transition

- **Risk:** Vector search adds latency to inbox knowledge picker
  - **Mitigation:** Use same caching/embedding approach as widget suggestions; limit results

- **Risk:** Article ID exposure in message content
  - **Mitigation:** Article IDs are already exposed in AI sources; no new security concern
