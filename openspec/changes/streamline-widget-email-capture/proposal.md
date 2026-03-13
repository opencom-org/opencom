## Why

The widget currently shows email capture as a bottom panel inside the conversation footer right after the visitor sends a message. That prompt takes over the same area visitors use to read the newest reply and type the next message, so it feels more interruptive than helpful. If email collection should remain available until the visitor identifies themselves, the prompt needs to stay present without sitting on top of the most important part of the conversation.

## What Changes

- Move widget email capture from the bottom footer area into a compact surface anchored directly beneath the widget header, entering from the top of the conversation instead of from the bottom.
- Keep the prompt visible for unidentified visitors after they have sent a message, while preserving clear access to the latest messages and the composer.
- Remove the skip or dismiss action and the related temporary dismissal behavior so the prompt remains non-blocking but persistent until the visitor supplies an email or is otherwise identified.
- Update widget layout, motion, and automated coverage so the compact top-anchored prompt works consistently across desktop and mobile widget sizes.

## Capabilities

### New Capabilities

- `widget-email-capture-ux`: The widget provides a compact, persistent, top-anchored email collection surface that keeps the newest chat content and composer visible until visitor identification is complete.

### Modified Capabilities

- None.

## Impact

- Widget conversation rendering and state management under `apps/widget/src/components/ConversationView.tsx` and `apps/widget/src/components/conversationView/`
- Widget conversation styling and motion in `apps/widget/src/styles.css`
- Widget email-capture E2E coverage and storage helpers in `apps/web/e2e/widget.spec.ts` and related `apps/web/e2e/helpers/` utilities
- Visitor identification trigger logic already used by the widget conversation flow, without requiring new backend APIs
