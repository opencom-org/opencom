## Why

AI responses currently store source metadata as type/id/title, but widget chat only renders source titles as plain text and does not provide direct article navigation. This weakens answer traceability and makes self-serve follow-up harder for visitors.

## What Changes

- Extend AI response source metadata to include linkable Help Center reference data for article sources.
- Render AI source references in widget chat as clickable article links that open corresponding articles.
- Surface the same linkable source references in AI review/chat contexts where appropriate.
- Preserve non-article source handling without broken links.

## Capabilities

### New Capabilities

- `ai-help-center-linked-sources`: AI responses expose linkable Help Center article sources in chat/review surfaces.

### Modified Capabilities

- None.

## Impact

- Convex AI response storage and query payload shape for sources.
- Widget chat rendering of AI source references.
- Inbox AI review/source presentation logic.
