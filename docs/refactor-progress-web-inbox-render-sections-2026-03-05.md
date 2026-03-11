# Refactor Progress: Web Inbox Render Sections (2026-03-05)

## Scope

- `apps/web/src/app/inbox/page.tsx`
- `apps/web/src/app/inbox/inboxRenderTypes.ts`
- `apps/web/src/app/inbox/InboxConversationListPane.tsx`
- `apps/web/src/app/inbox/InboxThreadPane.tsx`
- `apps/web/src/app/inbox/InboxAiReviewPanel.tsx`

## Problem Addressed

Even after hook-level modularization, inbox render trees remained concentrated in `page.tsx`, making UI updates high-risk and hard to review.

## What Was Refactored

1. Added typed render contracts in `inboxRenderTypes.ts` for conversation/message/AI-review/knowledge render payloads.
2. Extracted conversation list pane rendering into `InboxConversationListPane`.
3. Extracted thread pane rendering (header, message list, snippet/article/knowledge overlays, composer) into `InboxThreadPane`.
4. Extracted AI review rendering into `InboxAiReviewPanel`.
5. Recomposed `page.tsx` to orchestrate hooks/state and wire extracted render components.

## Result

- `apps/web/src/app/inbox/page.tsx` reduced to 587 lines (from ~1438 lines before this slice).
- Existing behavior and selectors are preserved while render responsibilities are split into dedicated modules.

## Compatibility Notes (Mobile / SDK / Convex)

- No Convex endpoint signatures changed.
- No changes to `apps/mobile`, `packages/sdk-core`, or RN SDK public contracts.
- This slice is web-only render decomposition.

## Verification

Passed:

- `pnpm --filter @opencom/web typecheck`
- `pnpm --filter @opencom/web test -- src/app/inbox/hooks/useInboxSelectionSync.test.tsx src/app/inbox/hooks/useInboxCompactPanels.test.tsx src/app/inbox/hooks/useInboxAttentionCues.test.tsx`
