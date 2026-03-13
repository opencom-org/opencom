## ADDED Requirements

### Requirement: Mobile conversation composer MUST restore unsent drafts

The mobile app SHALL save unsent agent-authored text entered in a conversation composer and restore it when the operator returns to that same conversation before a send succeeds.

#### Scenario: Operator returns after switching apps

- **WHEN** an operator enters text in a mobile conversation, leaves the app without sending, and returns to that same conversation
- **THEN** the composer SHALL display the unsent draft as it was last saved

#### Scenario: Conversation screen remounts before send

- **WHEN** the mobile conversation screen is reloaded or remounted for the same conversation before the draft is sent successfully
- **THEN** the composer SHALL rehydrate the saved draft instead of showing an empty input

### Requirement: Mobile drafts MUST be isolated by operator context and conversation

The mobile app SHALL scope persisted drafts to the active backend, signed-in operator, active workspace, and conversation so unsent text is never restored into the wrong thread or account.

#### Scenario: Operator opens a different conversation

- **WHEN** a saved draft exists for conversation A and the operator opens conversation B
- **THEN** conversation B SHALL not display conversation A's draft

#### Scenario: Device changes operator scope

- **WHEN** a different operator account, workspace, or backend context becomes active on the same device
- **THEN** drafts saved under the previous scope SHALL not be restored into the new scope

### Requirement: Mobile draft lifecycle MUST clear only after successful send

The mobile app SHALL delete a persisted draft after its message send succeeds and SHALL keep the draft available if the send attempt fails.

#### Scenario: Message send succeeds

- **WHEN** an operator sends a drafted message successfully
- **THEN** the persisted draft for that conversation SHALL be deleted
- **AND** returning to the conversation SHALL show an empty composer

#### Scenario: Message send fails

- **WHEN** an operator attempts to send a drafted message and the send fails
- **THEN** the composer SHALL keep the draft text available for retry
