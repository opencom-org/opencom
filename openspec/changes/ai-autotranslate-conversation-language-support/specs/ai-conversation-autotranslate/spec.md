## ADDED Requirements

### Requirement: Conversation flows MUST track language context for translation

Conversation messaging and AI workflows SHALL track detected/source language and preferred output language context.

#### Scenario: Visitor sends message in non-default language

- **WHEN** a visitor message is detected in a language different from workspace default
- **THEN** conversation language context SHALL be updated with detected/source language metadata

### Requirement: AI and agent replies MUST support automatic delivery translation

AI responses and opted-in agent replies SHALL be translated to conversation-preferred visitor language while preserving original source text.

#### Scenario: AI responds in visitor-preferred language

- **WHEN** AI generates a response for a conversation with preferred language set
- **THEN** delivered content SHALL be translated to the preferred language
- **AND** original generated text SHALL remain available for review

#### Scenario: Agent sends translated reply

- **WHEN** an agent sends a reply with auto-translate enabled
- **THEN** visitor-visible message SHALL be translated to the target language
- **AND** original agent text SHALL be retained for audit/review

### Requirement: Translation failures MUST degrade safely with explicit status

If translation cannot be completed, message delivery SHALL continue with original text and explicit translation status metadata.

#### Scenario: Translation service fails

- **WHEN** translation provider returns an error or timeout
- **THEN** original message text SHALL still be delivered
- **AND** translation status SHALL indicate failure for operational review
