## ADDED Requirements

### Requirement: Authorized conversation participants MUST be able to attach files to chat messages

The system MUST allow authorized chat participants to upload supported files, bind them to chat messages, and retrieve them from conversation history in both widget and inbox surfaces.

#### Scenario: Visitor sends a chat message with attachments

- **WHEN** a visitor uploads one or more supported files in the widget chat composer and sends the message
- **THEN** the system SHALL persist the chat message and attachment metadata together
- **AND** subsequent widget and inbox conversation reads SHALL include those attachments with secure download URLs for authorized viewers

#### Scenario: Agent sends a chat reply with attachments

- **WHEN** an authenticated agent uploads supported files while replying in the inbox
- **THEN** the system SHALL attach those files to the outgoing chat message
- **AND** the visitor conversation view SHALL surface the attachments in the thread

### Requirement: Tickets MUST support file attachments on submission and replies

The system MUST allow authorized users to attach supported files during ticket creation and while adding ticket comments.

#### Scenario: Visitor submits a ticket with attachments

- **WHEN** a visitor attaches supported files during ticket creation
- **THEN** the system SHALL create the ticket and associate the uploaded files with that ticket submission
- **AND** ticket detail queries SHALL return the submission attachments alongside the ticket description for authorized viewers

#### Scenario: Ticket reply includes attachments

- **WHEN** a visitor or agent uploads supported files while adding a ticket comment
- **THEN** the system SHALL associate those files with the created comment
- **AND** subsequent ticket detail reads SHALL include the comment attachments for authorized viewers

### Requirement: Support attachments MUST be validated, access-scoped, and cleaned up

The system MUST validate uploaded chat and ticket files, restrict attachment access to authorized readers, and clean up staged uploads that are never attached.

#### Scenario: Upload validation fails

- **WHEN** an uploaded file exceeds configured size or count limits, or its mime type is not allowed
- **THEN** attachment finalization MUST be rejected with a validation error
- **AND** the calling UI SHALL receive a user-presentable failure response without attaching the file

#### Scenario: Unauthorized attachment access is requested

- **WHEN** a user requests attachment metadata or a download URL for a conversation or ticket they cannot access
- **THEN** the system MUST deny the request
- **AND** the system MUST NOT return a storage URL for that attachment

#### Scenario: Staged upload is abandoned

- **WHEN** an uploaded attachment draft is not bound to a message, ticket, or ticket comment before its expiry window
- **THEN** the system SHALL delete the staged metadata record
- **AND** the system SHALL delete the underlying stored file during cleanup
