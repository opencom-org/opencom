## Why

The mobile app inbox currently covers basic conversation list/detail flows but lacks core web inbox capabilities: AI review context, clear AI-vs-human message attribution, and dedicated visitors directory/detail navigation. This creates product parity gaps for mobile operators.

## What Changes

- Bring mobile inbox flows closer to web parity for AI workflow review and message attribution.
- Add mobile visitor directory list/search/detail flows with navigation from inbox conversation context.
- Surface AI handoff context and response review in mobile conversation workflows.
- Preserve existing mobile inbox performance and basic messaging behavior.

## Capabilities

### New Capabilities

- `mobile-inbox-parity`: Mobile app inbox supports AI review context, AI message attribution, and visitor directory/detail navigation comparable to core web workflows.

### Modified Capabilities

- None.

## Impact

- Mobile app screens under `apps/mobile/app/(app)` for inbox/conversation plus new visitor directory screens.
- Mobile data consumption of existing conversation/AI response/visitor Convex APIs.
- Mobile UX tests for parity-critical navigation and AI review flows.
