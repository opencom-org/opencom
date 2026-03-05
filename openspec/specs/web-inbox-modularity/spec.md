# web-inbox-modularity Specification

## Purpose
TBD - created by archiving change decompose-web-inbox-page. Update Purpose after archive.
## Requirements
### Requirement: Inbox page MUST isolate orchestration concerns into domain modules

The inbox route implementation SHALL separate orchestration concerns into explicit modules with clear contracts instead of concentrating all behavior in one route file.

#### Scenario: Updating suggestion count logic

- **WHEN** a contributor changes only suggestion-count fetch behavior
- **THEN** the change SHALL be made in the suggestions domain module
- **AND** conversation selection and URL-sync modules SHALL not require edits

#### Scenario: Updating unread cue behavior

- **WHEN** a contributor changes unread cue suppression logic
- **THEN** the change SHALL be made in the attention-cue domain module
- **AND** message action and compact panel modules SHALL remain unaffected

### Requirement: Inbox refactor MUST preserve URL and selection synchronization behavior

The inbox refactor MUST preserve current query-parameter behavior for conversation selection and de-selection.

#### Scenario: Query parameter selects a conversation

- **WHEN** the inbox route loads with a valid `conversationId` query parameter
- **THEN** the selected conversation state SHALL match that identifier
- **AND** the page SHALL keep selection synchronized with subsequent route updates

#### Scenario: Selected conversation updates URL

- **WHEN** an agent selects or clears a conversation in the inbox UI
- **THEN** the route query parameter SHALL be updated consistently with current selection
- **AND** stale legacy query keys SHALL be removed as they are today

### Requirement: Inbox decomposition MUST preserve compact panel and cue behavior

The refactor SHALL preserve compact sidecar panel rules and unread cue suppression logic.

#### Scenario: Compact viewport state changes

- **WHEN** viewport mode switches between compact and non-compact
- **THEN** compact sidecar panel state SHALL reset according to existing behavior

#### Scenario: Unread count increases for selected visible conversation

- **WHEN** unread count increases on a conversation that is currently selected and visible with focus
- **THEN** attention cues SHALL be suppressed
- **AND** unread cues SHALL still trigger for other conversations

