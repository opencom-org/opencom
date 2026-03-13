## Why

When agents insert article links from the web inbox, those links open in a new browser tab in the widget instead of opening the article directly in the widget's help center view. Additionally, the inbox knowledge search uses simple text matching while the widget uses vector search for better relevance.

## What Changes

- Article links inserted from inbox will use a special format that includes the article ID, enabling the widget to open them directly in the help center article view (like AI message sources do)
- Widget markdown parser will detect article links and handle them as in-widget navigation instead of external links, like we do for source links in AI messages
- Inbox knowledge search will use vector search (same as widget suggestions) for better relevance matching

## Capabilities

### New Capabilities

- `inbox-knowledge-vector-search`: Inbox knowledge picker uses vector search for semantic relevance matching instead of simple text matching

### Modified Capabilities

- `inbox-knowledge-insertion`: Article link insertion format changes from `/help/slug` to include article ID for widget integration
- `shared-markdown-rendering-sanitization`: Widget markdown rendering will detect and handle article links specially (in-widget navigation instead of external link)
- `ai-help-center-linked-sources`: Article link format in messages will be consistent with AI source link handling

## Impact

- `apps/web/src/app/inbox/page.tsx` - article link insertion format
- `apps/web/src/app/inbox/hooks/useInboxConvex.ts` - knowledge search query
- `apps/widget/src/utils/parseMarkdown.ts` - article link detection
- `apps/widget/src/components/ConversationView.tsx` - article link click handling
- `packages/web-shared/src/markdown.ts` - article link protocol handling
- `packages/convex/convex/knowledge.ts` - vector search integration
