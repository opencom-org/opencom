## Why

The current chatbot is optimized more like a knowledge answer generator than a capable human support agent. That shows up most clearly in everyday conversation turns such as greetings, short follow-up messages, added context sent while a reply is still generating, and other normal chat behavior that people expect a real support teammate to handle naturally.

## What Changes

- Define AI support behavior that feels like a helpful, knowledgeable human agent rather than a rigid FAQ bot.
- Add explicit handling for common conversational turns such as greetings, thanks, brief acknowledgements, clarification asks, corrections, and "one more thing" follow-ups.
- Introduce turn-coordination behavior so consecutive visitor messages and new messages sent during AI processing are handled as part of the same live support exchange instead of producing stale, fragmented, or duplicated replies.
- Preserve clear human handoff behavior while reducing unnecessary escalations for routine conversational moments that should be handled confidently by the AI.
- Ensure widget and inbox review surfaces continue to reflect what happened when AI responses are merged, superseded, or delayed by newer visitor input.

## Capabilities

### New Capabilities
- `ai-support-conversation-behavior`: Define human-like support conversation behavior for routine chat turns, including greetings, acknowledgements, clarifications, and confident, natural-sounding support responses.
- `ai-support-turn-coordination`: Define how AI response generation tracks the latest unresolved visitor turn so back-to-back or mid-processing messages produce one coherent response based on current context.

### Modified Capabilities

## Impact

- Affected backend AI workflow and conversation state in `packages/convex/convex/aiAgent.ts`, `packages/convex/convex/aiAgentActions.ts`, and related conversation/message runtime paths.
- Affected widget chat sending and AI-response orchestration in `apps/widget/src/components/ConversationView.tsx` and `apps/widget/src/hooks/convex/useConversationViewConvex.ts`.
- Likely affects inbox AI review visibility and workflow diagnostics in web surfaces and corresponding Convex/widget tests.
- No external dependency changes are expected for the proposal itself; primary impact is behavior contracts, conversation state handling, and test coverage.
