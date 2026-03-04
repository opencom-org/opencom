# ai-handoff-response-traceability Specification

## Purpose
TBD - created by archiving change persist-full-ai-response-on-handoff. Update Purpose after archive.
## Requirements
### Requirement: Handoff outcomes MUST retain full generated AI response context for review

When a handoff occurs after AI generation, review records SHALL retain generated response content and associated source/confidence metadata.

#### Scenario: Handoff triggered after AI generates candidate response

- **WHEN** AI produces a candidate response and handoff decision is triggered
- **THEN** AI review records SHALL persist generated candidate response context
- **AND** handoff reason metadata SHALL remain attached

### Requirement: Visitor-facing thread MUST continue showing handoff message only

Handoff traceability changes MUST NOT alter visitor-facing behavior that displays a single handoff message in the conversation thread.

#### Scenario: Visitor receives handoff reply

- **WHEN** handoff path is executed
- **THEN** conversation thread SHALL show the configured handoff message
- **AND** unsent generated candidate response SHALL not be posted to visitor thread

### Requirement: AI review payloads MUST distinguish generated and delivered response contexts

AI review query responses SHALL indicate whether displayed text is generated candidate content or delivered handoff content for handed-off records.

#### Scenario: Operator opens AI review for handed-off conversation

- **WHEN** AI review is opened for a handed-off interaction
- **THEN** the UI payload SHALL provide both generated candidate and delivered handoff contexts when available
- **AND** labels SHALL allow operator to distinguish the two

