## ADDED Requirements

### Requirement: Conversation view MUST separate orchestration from large render branches

The widget conversation view SHALL keep orchestration logic in `ConversationView` while moving large message/footer render branches into dedicated view modules.

#### Scenario: Updating conversation message card rendering

- **WHEN** a contributor changes message-row or footer UI rendering
- **THEN** edits SHALL be isolated to conversation view render modules
- **AND** message/action orchestration SHALL remain in the controller

### Requirement: Conversation view decomposition MUST preserve contracts

Refactor SHALL preserve `ConversationView` props, message behavior, and existing selectors/classnames used by widget integration tests.

#### Scenario: Existing widget test suite runs after decomposition

- **WHEN** widget tests and typechecks run post-refactor
- **THEN** no contract regressions SHALL be introduced
- **AND** web typecheck compatibility SHALL remain intact
