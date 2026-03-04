## ADDED Requirements

### Requirement: Notification cue core logic MUST be shared across web inbox and widget

Unread snapshot construction, unread increase detection, and suppression predicates SHALL be implemented in a shared core utility consumed by both surfaces.

#### Scenario: Unread increase is detected

- **WHEN** unread counts increase for one or more conversations
- **THEN** both web and widget cue adapters SHALL derive increases using the shared core algorithm

### Requirement: Surface-specific defaults MUST remain explicit configuration

Differences in defaults or persistence behavior between web and widget MUST be expressed through explicit adapter configuration rather than duplicated core algorithms.

#### Scenario: Web and widget default preference values differ

- **WHEN** a surface loads cue preferences without persisted settings
- **THEN** each surface SHALL apply its explicit configured defaults
- **AND** shared core cue calculations SHALL remain unchanged

### Requirement: Cue suppression behavior MUST remain consistent for active focused conversations

Cue suppression logic SHALL suppress attention cues when the active conversation is currently visible and focused according to shared predicate rules.

#### Scenario: Active conversation unread increases while focused

- **WHEN** unread count increases on the currently visible active conversation and focus/visibility are true
- **THEN** attention cues SHALL be suppressed
- **AND** cues for other conversations SHALL still be eligible
