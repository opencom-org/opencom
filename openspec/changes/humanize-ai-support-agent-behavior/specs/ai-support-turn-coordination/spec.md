## ADDED Requirements

### Requirement: AI replies MUST be based on the latest unresolved visitor turn

The system SHALL compute each automated response against the newest visitor input that has not already been addressed by a delivered AI or human-agent reply.

#### Scenario: Visitor adds detail before AI reply delivery

- **WHEN** a visitor sends an initial question and then adds more detail before an AI reply is delivered
- **THEN** the next delivered AI reply SHALL incorporate the added detail
- **AND** the system SHALL NOT deliver a reply that only addresses the earlier partial context

#### Scenario: Visitor corrects earlier context

- **WHEN** a visitor corrects or replaces part of an earlier message before AI reply delivery
- **THEN** the next delivered AI reply SHALL use the corrected context
- **AND** superseded context SHALL NOT be treated as the final turn state

### Requirement: In-flight AI generation MUST coordinate with newer visitor input

The system SHALL detect when a newer visitor message arrives while an AI response is being generated and SHALL merge, retry, or supersede generation so the visitor receives one coherent response aligned with the latest conversation state.

#### Scenario: New message arrives during generation

- **WHEN** AI generation is already in progress and the visitor sends another message
- **THEN** the system SHALL avoid posting a stale reply from the earlier generation
- **AND** the system SHALL continue toward a single delivered reply that reflects the latest unresolved turn

#### Scenario: Rapid consecutive messages form one thought

- **WHEN** a visitor sends several short messages in quick succession as part of one thought
- **THEN** the system SHALL treat them as one support exchange for reply generation
- **AND** the delivered AI reply SHALL address the combined message set

### Requirement: Superseded AI attempts MUST remain reviewable without confusing the visitor thread

The system SHALL keep operator-visible traceability for delayed, merged, or superseded AI attempts while ensuring only the final delivered AI or handoff message appears in the visitor-facing thread.

#### Scenario: Earlier attempt is superseded

- **WHEN** an earlier AI generation is replaced because newer visitor context arrived
- **THEN** review surfaces SHALL indicate that the earlier attempt was superseded or merged
- **AND** the visitor thread SHALL only show the final delivered reply

#### Scenario: Coordinated retry ends in handoff

- **WHEN** newer visitor input causes regeneration and the final coordinated outcome is a human handoff
- **THEN** the review data SHALL distinguish the delivered handoff content from any superseded generated candidate
- **AND** the conversation workflow state SHALL reflect the final delivered outcome
