## Why

`apps/widget/src/components/ConversationView.tsx` (~830 lines) combines message/AI rendering, footer state branches (email capture, reply-time, suggestions, input), and controller logic in one component.

This increases review blast radius and makes it harder to change UI sections without touching conversation orchestration.

## What Changes

- Extract conversation view domain types/constants/helpers into dedicated modules.
- Extract large render branches (message list + footer sections) into presentational components.
- Keep `ConversationView` as the orchestration boundary with unchanged props and behavior.
- Preserve existing selectors and integration behavior.

## Capabilities

### New Capabilities

- `widget-conversation-view-modularity`: Conversation view rendering and helper logic are split into dedicated modules with a controller composition layer.

### Modified Capabilities

- None.

## Impact

- Affected code:
  - `apps/widget/src/components/ConversationView.tsx`
  - new modules under `apps/widget/src/components/conversationView/`
- APIs:
  - No public prop contract changes.
- Dependencies:
  - No new external dependencies.
