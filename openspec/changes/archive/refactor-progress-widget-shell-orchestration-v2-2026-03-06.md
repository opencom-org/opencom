# Refactor Progress: Widget Shell Orchestration Phase 2 (2026-03-06)

## Scope

- `apps/widget/src/Widget.tsx`
- `apps/widget/src/hooks/useWidgetConversationFlow.ts`
- `apps/widget/src/hooks/useWidgetArticleNavigation.ts`
- `apps/widget/src/hooks/useWidgetTicketFlow.ts`

## Problem Addressed

After the earlier shell-frame extraction, `Widget.tsx` still owned too much of the browser-side state machine directly:

- draft conversation reuse and in-flight create deduplication
- read-state synchronization when opening and leaving conversations
- article-detail navigation, large-mode toggling, and collapse timing
- ticket list/detail/create orchestration

Those behaviors were correct, but they still made the main shell controller harder to reason about and change safely.

## What Was Refactored

1. Extracted conversation lifecycle orchestration into `useWidgetConversationFlow`:
   - selected conversation state
   - reusable draft detection
   - in-flight create deduplication
   - fresh conversation creation
   - read-state synchronization
   - back-to-list handling
2. Extracted article navigation/presentation orchestration into `useWidgetArticleNavigation`:
   - search query state
   - selected article state
   - help-collection selection
   - large-mode toggle/collapse timing
   - article back-navigation
3. Extracted ticket list/detail/create orchestration into `useWidgetTicketFlow`:
   - ticket list query
   - selected ticket query
   - ticket form query
   - ticket submission error normalization
   - comment submission
   - ticket-detail and ticket-create navigation
4. Rewired `Widget.tsx` to consume those hooks instead of keeping the same logic inline.
5. Removed dead route-local state that no longer served a purpose (`previousView`).

## Result

- `apps/widget/src/Widget.tsx` reduced to `966` lines from `1285`.
- The main widget controller is still large, but more of it is now genuinely shell orchestration rather than mixed orchestration plus local state machines.
- Conversation, article, and ticket flows now have clearer ownership boundaries for future follow-up work.

## What Still Appears To Remain In This Track

- `Widget.tsx` still owns a lot of tab-content composition.
- Blocking experience arbitration is still coordinated from the main controller, alongside overlay wiring.
- This track likely still has one more useful pass left, but it no longer appears to be the single highest-priority hotspot in the repo.

## Compatibility Notes

- No shared contracts changed.
- No Convex endpoint signatures changed.
- This pass is widget-local orchestration refactoring only.

## Verification

Passed:

- `pnpm --filter @opencom/widget typecheck`
- `pnpm --filter @opencom/widget test -- --run src/test/widgetShellOrchestration.test.tsx src/test/widgetNewConversation.test.tsx src/test/widgetTicketErrorFeedback.test.tsx`
- `pnpm --filter @opencom/widget test`
