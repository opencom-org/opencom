## MODIFIED Requirements

### Requirement: Conversation view MUST separate orchestration from large render branches

The widget conversation view SHALL keep orchestration logic in `ConversationView` while moving large message/footer render branches into dedicated view modules, and the resulting seams MUST allow focused verification without requiring a single opaque mount path that can hang the entire suite before any test executes.

#### Scenario: Updating conversation message card rendering
- **WHEN** a contributor changes message-row or footer UI rendering
- **THEN** edits SHALL be isolated to conversation view render modules
- **AND** message/action orchestration SHALL remain in the controller

#### Scenario: Investigating render-path regressions
- **WHEN** contributors need to validate conversation-view behavior under tests
- **THEN** they MUST be able to run focused import-level or seam-level verification without depending on one monolithic render spec that can stall before test execution begins

### Requirement: Conversation view decomposition MUST preserve contracts

Refactor SHALL preserve `ConversationView` props, message behavior, and existing selectors/classnames used by widget integration tests, while also preserving a stable verification path that distinguishes import-level health from render-path health.

#### Scenario: Existing widget test suite runs after decomposition
- **WHEN** widget tests and typechecks run post-refactor
- **THEN** no contract regressions SHALL be introduced
- **AND** web typecheck compatibility SHALL remain intact

#### Scenario: Import-level verification remains available during render-path investigation
- **WHEN** the integrated render-path suite is temporarily quarantined during investigation
- **THEN** the repository SHALL retain a focused `ConversationView` import smoke check or equivalent lightweight verification
- **AND** future work SHALL use that check as the first gate before reintroducing broader render-path coverage
