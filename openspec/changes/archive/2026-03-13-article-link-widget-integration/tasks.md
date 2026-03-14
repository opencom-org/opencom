## 1. Backend: Inbox Knowledge Vector Search

- [x] 1.1 Create `knowledge:searchWithEmbeddings` action in `packages/convex/convex/knowledge.ts` using vector search
- [x] 1.2 Add embedding generation and vector search logic (reuse from `suggestions:searchSimilar`)
- [x] 1.3 Ensure workspace filtering at vector search level
- [x] 1.4 Return results with content type, title, snippet, article ID, and relevance score
- [x] 1.5 Add Convex typecheck and tests for new query

## 2. Web Inbox: Knowledge Search Integration

- [x] 2.1 Update `apps/web/src/app/inbox/hooks/useInboxConvex.ts` to use new vector search query
- [x] 2.2 Update `InboxKnowledgeItem` type to include article ID field
- [x] 2.3 Run web typecheck

## 3. Web Inbox: Article Link Format

- [x] 3.1 Update `apps/web/src/app/inbox/page.tsx` `handleInsertKnowledgeContent` to use `article:<articleId>` format
- [x] 3.2 Ensure article ID is included in the link for public articles
- [x] 3.3 Run web typecheck

## 4. Shared Markdown: Article Link Detection

- [x] 4.1 Update `packages/web-shared/src/markdown.ts` to detect `article:` protocol URLs
- [x] 4.2 Emit `data-article-id` attribute for article links
- [x] 4.3 Remove `target="_blank"` for article links (in-widget navigation)
- [x] 4.4 Add `data-article-id` to `ALLOWED_ATTR` list
- [x] 4.5 Add tests for article link rendering
- [x] 4.6 Run web-shared tests
- [x] 4.7 Add `opencom-article-link` class for styling
- [x] 4.8 Configure DOMPurify to allow `article:` protocol

## 5. Widget: Article Link Click Handling

- [x] 5.1 Update `apps/widget/src/components/ConversationView.tsx` to add click handler for `[data-article-id]` elements
- [x] 5.2 Call `onSelectArticle(articleId)` when article link is clicked
- [x] 5.3 Prevent default link behavior for article links
- [x] 5.4 Add tests for article link click handling
- [x] 5.5 Run widget typecheck and tests
- [x] 5.6 Add CSS for `.opencom-article-link` class

## 6. Verification

- [x] 6.1 Run full workspace typecheck
- [x] 6.2 Run relevant package tests
- [x] 6.3 Manual test: Insert article link from inbox, verify opens in widget
- [x] 6.4 Manual test: Verify vector search returns relevant results in inbox
