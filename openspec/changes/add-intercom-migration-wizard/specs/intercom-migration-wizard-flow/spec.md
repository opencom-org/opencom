## ADDED Requirements

### Requirement: Migration wizard MUST enforce a deterministic setup sequence
Opencom SHALL provide a multi-step Intercom migration wizard that enforces this ordered sequence: connect workspace, choose migration scope, map required identities/fields, review preflight results, and start import.

#### Scenario: Admin completes setup in required order
- **WHEN** a workspace admin starts an Intercom migration
- **THEN** the wizard SHALL display each setup step in the required order
- **AND** the admin SHALL NOT advance past a step until its required inputs pass validation

#### Scenario: Wizard restores in-progress setup
- **WHEN** a workspace admin exits the wizard before starting import and returns later
- **THEN** the wizard SHALL restore previously saved scope and mapping selections
- **AND** the wizard SHALL reopen at the next incomplete step

### Requirement: Migration wizard MUST support explicit migration scope selection
The wizard SHALL let admins explicitly include or exclude supported Intercom data domains (for example contacts, companies, conversations, and help center content) before import begins.

#### Scenario: Admin selects subset migration
- **WHEN** the admin selects only a subset of supported domains in scope selection
- **THEN** the migration plan SHALL include only the selected domains
- **AND** the review step SHALL show excluded domains as excluded by user choice

#### Scenario: Scope change invalidates stale mappings
- **WHEN** the admin removes a previously selected data domain from scope
- **THEN** mappings tied only to that domain SHALL be removed from the draft plan
- **AND** the wizard SHALL require a fresh readiness review before import can start

### Requirement: Migration wizard MUST produce a completion summary with verification checklist
After import completion, Opencom SHALL present a migration completion summary and a checklist of verification steps required before production cutover.

#### Scenario: Import completes successfully
- **WHEN** the migration job reaches completed status
- **THEN** the wizard SHALL show imported record counts by selected domain
- **AND** the completion view SHALL include a checklist covering data spot checks, routing/automation validation, and team handoff confirmation
