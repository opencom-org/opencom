# Refactor Progress: Widget Conversation View Decomposition (2026-03-05)

## Scope

- `apps/widget/src/components/ConversationView.tsx`
- `apps/widget/src/components/conversationView/constants.ts`
- `apps/widget/src/components/conversationView/helpers.ts`
- `apps/widget/src/components/conversationView/types.ts`
- `apps/widget/src/components/conversationView/MessageList.tsx`
- `apps/widget/src/components/conversationView/Footer.tsx`
- `openspec/changes/decompose-widget-conversation-view/*`

## Problem Addressed

`ConversationView.tsx` mixed orchestration logic with large message-list and footer render branches, making local UI updates risky.

## What Was Refactored

1. Extracted conversation view constants/types/helpers into dedicated modules.
2. Extracted message-list rendering (AI badges, feedback controls, source links, typing/handoff states) into `MessageList`.
3. Extracted footer rendering (CSAT, email capture, reply-time, common issues, article suggestions, input controls) into `Footer`.
4. Recomposed `ConversationView.tsx` as orchestration-first controller wiring actions/state into extracted view components.

## Result

- `apps/widget/src/components/ConversationView.tsx` reduced to 515 lines (from ~830).
- Existing selectors/classes and behavior are preserved.
- AI/handoff/message orchestration remains centralized in controller logic.

## Compatibility Notes (Web / Widget / Mobile / SDKs)

- No shared contract changes across Convex API, `@opencom/types`, mobile app, or SDK packages.
- This slice is widget-local and maintains cross-surface compatibility.

## Verification

Passed:

- `pnpm --filter @opencom/widget typecheck`
- `pnpm --filter @opencom/widget test`
- `pnpm --filter @opencom/web typecheck`
