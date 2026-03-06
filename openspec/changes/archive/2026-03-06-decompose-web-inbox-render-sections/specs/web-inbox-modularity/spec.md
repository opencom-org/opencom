## ADDED Requirements

### Requirement: Inbox render sections MUST be implemented as dedicated components

The inbox route SHALL implement major render regions in dedicated components instead of keeping all render trees in `page.tsx`.

#### Scenario: Updating conversation list row UI

- **WHEN** a contributor changes conversation-row rendering
- **THEN** the change SHALL be made in the conversation list render component
- **AND** thread pane and AI review render modules SHALL not require edits

### Requirement: Render decomposition MUST preserve inbox behavior and wiring

Render extraction SHALL preserve existing behavior for selection state, action handlers, panel toggles, and test selector semantics.

#### Scenario: Agent opens AI review and sends a reply

- **WHEN** an agent selects a conversation, opens AI review, and sends a message
- **THEN** the same behavior-owning handlers SHALL be invoked as before extraction
- **AND** rendered state and interaction semantics SHALL remain functionally equivalent
