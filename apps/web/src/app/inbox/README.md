# Inbox Orchestration Modules

This route keeps UI composition in [`page.tsx`](./page.tsx) and pushes behavior into focused domain hooks under `hooks/`.

## Ownership Map

- Selection and URL sync:
  [`useInboxSelectionSync.ts`](./hooks/useInboxSelectionSync.ts)
  owns `conversationId` / legacy `conversation` query handling, selected conversation reconciliation, and route updates.
- Compact panel behavior:
  [`useInboxCompactPanels.ts`](./hooks/useInboxCompactPanels.ts)
  owns open/close/reset rules for `ai-review` and `suggestions` panels.
- Suggestions count loading:
  [`useInboxSuggestionsCount.ts`](./hooks/useInboxSuggestionsCount.ts)
  owns async count fetching and loading/error fallback behavior.
- Attention cues and title updates:
  [`useInboxAttentionCues.ts`](./hooks/useInboxAttentionCues.ts)
  owns unread snapshot comparisons, suppression checks, sound/browser cues, and document title updates.
- Message actions:
  [`useInboxMessageActions.ts`](./hooks/useInboxMessageActions.ts)
  owns optimistic action flows for select/read, send, resolve, and convert-to-ticket.

## Extension Points

- Add new query-driven selection semantics in `useInboxSelectionSync` without adding URL logic back into `page.tsx`.
- Add new compact-panel variants by extending `InboxCompactPanel` and reset helpers in `useInboxCompactPanels`.
- Add additional cue channels (for example, toast or haptics) in `useInboxAttentionCues`, reusing suppression gates.
- Add new message-level mutations in `useInboxMessageActions`, keeping optimistic patching and rollback local to that module.

## Cross-Surface Constraints

- Web inbox refactor must not change Convex API signatures or shared domain contracts.
- `apps/mobile`, `packages/sdk-core`, and `packages/sdk-react-native` remain unaffected by this decomposition because no shared payload/schema or SDK interface was changed.
- Any future cross-surface behavior change should land first in shared packages/specs, then be consumed by web/mobile/widget.

## Tests

- Selection-sync invariants:
  [`useInboxSelectionSync.test.tsx`](./hooks/useInboxSelectionSync.test.tsx)
- Compact-panel reset behavior:
  [`useInboxCompactPanels.test.tsx`](./hooks/useInboxCompactPanels.test.tsx)
- Attention-cue suppression and title behavior:
  [`useInboxAttentionCues.test.tsx`](./hooks/useInboxAttentionCues.test.tsx)
