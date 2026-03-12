## ADDED Requirements

### Requirement: React Native SDK messenger conversations MUST support attachments

The system MUST allow React Native SDK messenger users to select supported files, upload them through the existing support-attachment backend flow, send them with a conversation message, and view them again in conversation history.

#### Scenario: Visitor sends a messenger message with attachments in the RN SDK

- **WHEN** a visitor selects one or more supported files in the React Native SDK messenger composer and sends the message
- **THEN** the system SHALL upload and stage those files before binding them to the outgoing conversation message
- **AND** subsequent messenger reads SHALL include the message attachments with secure download URLs for authorized viewers

#### Scenario: Messenger upload validation fails in the RN SDK

- **WHEN** the visitor selects an unsupported file, exceeds attachment limits, or the staged upload is rejected
- **THEN** the React Native SDK SHALL present actionable error feedback in the messenger flow
- **AND** the system SHALL NOT send the message with invalid attachments

#### Scenario: Existing messenger attachments are rendered in conversation history

- **WHEN** the React Native SDK opens a conversation that already contains message attachments
- **THEN** the conversation view SHALL render those attachments with filename and size metadata
- **AND** authorized users SHALL be able to open the secure attachment link from the native client

### Requirement: React Native SDK tickets MUST support attachments on creation and replies

The system MUST allow React Native SDK ticket users to attach supported files during ticket submission and while adding ticket comments, and MUST render those attachments in ticket detail.

#### Scenario: Visitor creates a ticket with attachments in the RN SDK

- **WHEN** a visitor selects supported files while submitting a ticket from the React Native SDK
- **THEN** the system SHALL create the ticket and associate the uploaded files with that ticket submission
- **AND** ticket detail reads SHALL return those ticket-level attachments for authorized viewers

#### Scenario: Visitor replies to a ticket with attachments in the RN SDK

- **WHEN** a visitor selects supported files while adding a ticket comment from the React Native SDK
- **THEN** the system SHALL bind those files to the created ticket comment
- **AND** subsequent ticket detail reads SHALL include the comment attachments in the correct timeline position

#### Scenario: Existing ticket attachments are rendered in the RN SDK

- **WHEN** the React Native SDK opens a ticket that includes submission or comment attachments
- **THEN** the ticket detail flow SHALL render the attachments for each ticket section where they belong
- **AND** authorized users SHALL be able to open the secure attachment link from the native client

### Requirement: React Native SDK attachment support MUST remain configurable for host apps

The React Native SDK MUST provide a host-controlled attachment picking boundary so applications can enable native file selection without breaking text-only messenger and ticket usage where no picker integration is configured.

#### Scenario: Host app provides an attachment picker integration

- **WHEN** a host app configures the React Native SDK with an attachment picker implementation
- **THEN** the built-in messenger and ticket compose surfaces SHALL expose attachment selection controls
- **AND** the picked files SHALL flow through the SDK attachment upload pipeline before send or submit

#### Scenario: Host app does not provide an attachment picker integration

- **WHEN** the React Native SDK is rendered without an attachment picker integration
- **THEN** the built-in messenger and ticket compose surfaces SHALL continue to support text-only sending
- **AND** the SDK SHALL NOT crash or expose a broken attachment affordance

### Requirement: First-party mobile agent conversations MUST support attachments

The first-party mobile app MUST allow agents to send supported files from the existing conversation screen and MUST render attachments returned in conversation history.

#### Scenario: Agent sends a mobile conversation reply with attachments

- **WHEN** an authenticated agent selects supported files from the first-party mobile conversation screen and sends a reply
- **THEN** the system SHALL bind those uploaded files to the outgoing conversation message
- **AND** the conversation thread SHALL show the attachments on the newly sent reply

#### Scenario: Agent views conversation history with attachments on mobile

- **WHEN** the first-party mobile conversation screen loads messages that include attachments
- **THEN** the screen SHALL render those attachments in the appropriate message bubble or attachment list
- **AND** the agent SHALL be able to open the secure attachment link from the mobile app
