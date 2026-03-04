## Context

Support teams and visitors can communicate in different languages, but current AI and inbox flows do not provide translation mediation. A robust implementation needs translation transparency, language preference memory, and safe fallbacks when translation fails.

## Goals / Non-Goals

**Goals:**
- Detect/store conversation language context.
- Provide automatic translation for AI replies and optional agent-assisted replies.
- Preserve original text for audit/review and quality checks.
- Expose translation status in chat/review UI.

**Non-Goals:**
- Building a standalone human translator management system.
- Guaranteeing perfect translation quality for all languages.

## Decisions

### 1) Persist language metadata and dual-text payloads

Decision:
- Store detected/source language plus translated output while retaining original message text.

Rationale:
- Maintains transparency and enables quality review.

Alternatives considered:
- Replace original message with translated-only text. Rejected due to audit and trust concerns.

### 2) Translation pipeline integrated at AI and agent reply boundaries

Decision:
- Integrate translation in AI generation and agent send paths so visitors receive messages in conversation-preferred language.

Rationale:
- Centralized translation boundary keeps UI clients simpler and consistent.

Alternatives considered:
- Client-only translation. Rejected due to fragmentation and policy drift.

### 3) Safe fallbacks with explicit status

Decision:
- If translation fails, preserve original delivery and mark translation status for review.

Rationale:
- Avoids message loss and provides operational visibility.

## Risks / Trade-offs

- [Risk] Added latency from translation step.
  - Mitigation: async optimization and short-response caching where safe.
- [Risk] Translation errors could misrepresent intent.
  - Mitigation: preserve original text and expose "view original" controls.
- [Risk] Higher model/provider cost.
  - Mitigation: configurable language scope and threshold-based translation triggers.

## Migration Plan

1. Add schema fields for language metadata and translated/original content traces.
2. Implement translation service integration for AI and agent reply flows.
3. Add UI indicators/toggles for translation visibility.
4. Add tests for language detection, translation success/fallback, and review visibility.
5. Roll out behind workspace-level feature flag.

Rollback:
- Disable feature flag and bypass translation step while retaining schema backward compatibility.

## Open Questions

- Which translation provider(s) are acceptable for initial rollout?
- Should workspaces configure source/target language policy or rely on automatic detection only?
