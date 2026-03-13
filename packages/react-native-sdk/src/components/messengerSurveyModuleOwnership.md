# Messenger + Survey Container Modularity

This document defines ownership for the decomposed RN SDK containers.

## Messenger domains

- `OpencomMessenger.tsx`
  - Shell composition only.
  - Chooses list/detail view and wires controller output to presentational views.
- `messenger/useMessengerShellController.ts`
  - Owns shell-level state (`view`, `activeConversationId`) and controlled-view synchronization.
- `messenger/useConversationListController.ts`
  - Owns conversation list data orchestration and new-conversation creation flow.
- `messenger/useConversationDetailController.ts`
  - Owns message send flow, read-marking, email capture orchestration, and visitor identify mutation wiring.
- `messenger/messengerFlow.ts`
  - Pure flow helpers (send normalization, timestamp formatting, view transitions, email-cue decisions).
- `messenger/ConversationListView.tsx` and `messenger/ConversationDetailView.tsx`
  - Presentation-only rendering.
- `messenger/styles.ts`
  - Shared style tokens for messenger presentation modules.

## Survey domains

- `OpencomSurvey.tsx`
  - Shell composition only.
  - Chooses intro/question/thank-you presentation from controller state.
- `survey/useSurveyController.ts`
  - Owns survey progression orchestration, impression recording, submission flow, and dismiss/completion actions.
- `survey/surveyFlow.ts`
  - Pure flow helpers for step transitions, required-answer gating, answer normalization, and submission state transitions.
- `survey/SurveyStepViews.tsx` and `survey/SurveyQuestionRenderer.tsx`
  - Presentation-only rendering for step and question variants.
- `survey/styles.ts`
  - Shared style tokens for survey presentation modules.
- `survey/types.ts`
  - Survey domain type contracts used by runtime delivery hooks and components.

## Extension guidance

- New rendering variants belong in `SurveyQuestionRenderer` or dedicated presentational modules.
- New progression rules belong in `surveyFlow.ts` first, then consumed via `useSurveyController`.
- Messenger state transition changes belong in `messengerFlow.ts` and controller hooks, not in view components.
- Keep host-facing props and exported component names stable for `apps/mobile` and external RN SDK consumers.
