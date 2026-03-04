## Why

Current messaging and AI flows assume shared language context and do not provide automatic translation between visitors and support teams. This creates friction for multilingual conversations and limits self-serve AI usefulness across languages.

## What Changes

- Add conversation-level language detection and preference tracking for visitor interactions.
- Introduce automatic translation support for AI responses and optional agent reply translation workflows.
- Persist original and translated message forms so teams can review exact source text.
- Add UI affordances to display translation status and allow viewing original content.

## Capabilities

### New Capabilities

- `ai-conversation-autotranslate`: Conversations can automatically translate between visitor language and support/AI language with traceable original text.

### Modified Capabilities

- None.

## Impact

- Convex messaging/AI pipelines and schema for language metadata and translation payloads.
- Web inbox and widget/mobile messaging UI for translation display controls.
- AI response generation flow and related analytics/review behavior.
