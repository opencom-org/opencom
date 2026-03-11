## ADDED Requirements

### Requirement: Widget email capture MUST use a compact top-anchored surface

When widget email collection is enabled for an unidentified visitor who has already sent a message, the widget SHALL present email capture as a compact surface anchored directly below the conversation header instead of as a footer panel.

#### Scenario: First visitor message triggers top-anchored email capture
- **WHEN** an unidentified visitor sends a message in a widget conversation where email collection is enabled
- **THEN** the widget SHALL render the email capture surface directly beneath the header and above the message list
- **AND** the surface SHALL enter from the top edge of the conversation rather than from the footer
- **AND** the latest message and composer SHALL remain visible and usable while the surface is shown

### Requirement: Widget email capture MUST remain pending until visitor identification completes

Once email capture has been triggered for an unidentified visitor, the widget SHALL keep the prompt visible until the visitor successfully submits an email address or is otherwise identified.

#### Scenario: Pending prompt has no dismiss path
- **WHEN** the email capture surface is visible for an unidentified visitor
- **THEN** the widget SHALL NOT render a skip or dismiss action for that surface
- **AND** subsequent conversation updates SHALL keep the prompt visible until identification succeeds

#### Scenario: Reopening the conversation keeps the pending prompt visible
- **WHEN** an unidentified visitor reopens a conversation after already sending a message but before submitting an email
- **THEN** the widget SHALL continue rendering the email capture surface in the top-anchored slot
- **AND** the conversation thread and composer SHALL remain available underneath it

#### Scenario: Successful identification clears the prompt
- **WHEN** the visitor successfully submits an email address through the email capture surface or the widget already has identifying visitor data
- **THEN** the widget SHALL hide the email capture surface
- **AND** the surface SHALL remain hidden for that identified visitor unless the widget returns to an unidentified state
