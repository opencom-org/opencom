## Why

In `aiAgentActions.generateResponse`, handoff paths currently store only the pre-canned handoff message in `aiResponses`, even when the AI generated a full candidate response beforehand. This leaves AI review without the full generated response context that led to handoff decisions.

## What Changes

- Persist full generated AI response context in handoff outcomes, including generated text, sources, and confidence metadata.
- Distinguish between visitor-visible handoff message and internal generated candidate response in AI review records.
- Preserve current thread behavior where visitors receive one clear handoff message.
- Update AI review payloads/UI to display full generated response context for handed-off cases.

## Capabilities

### New Capabilities

- `ai-handoff-response-traceability`: AI handoff records retain full generated response context for review and analytics while preserving visitor-facing handoff behavior.

### Modified Capabilities

- None.

## Impact

- Convex AI generation and `aiResponses` storage schema/logic.
- Web inbox AI review display and related analytics/reporting paths.
- Tests for handoff recording and review payload integrity.
