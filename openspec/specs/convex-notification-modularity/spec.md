# convex-notification-modularity Specification

## Purpose
TBD - created by archiving change modularize-convex-notifications-domain. Update Purpose after archive.
## Requirements
### Requirement: Notification orchestration MUST be implemented through explicit domain modules

The notifications domain SHALL separate recipient lookup, routing/deduping, channel dispatch, and event emitters into explicit modules with stable interfaces.

#### Scenario: Contributor updates recipient resolution logic

- **WHEN** recipient lookup rules change for a notification type
- **THEN** the change SHALL be contained within recipient-resolution modules
- **AND** routing and channel dispatch modules SHALL not require modification

#### Scenario: Contributor updates event payload composition

- **WHEN** a ticket or chat event payload format is adjusted
- **THEN** the change SHALL be implemented in event-emitter modules
- **AND** recipient resolution and channel dispatch modules SHALL remain unaffected

### Requirement: Notification refactor MUST preserve routing and debounce semantics

The notifications refactor MUST preserve existing routing outcomes, dedupe behavior, and debounce timing semantics for current notification events.

#### Scenario: New visitor message triggers agent notifications

- **WHEN** a visitor sends a new message in a conversation
- **THEN** the system SHALL continue routing agent notifications to the same audience and channels as before refactor
- **AND** event dedupe keys SHALL remain semantically equivalent

#### Scenario: Support reply triggers debounced visitor email

- **WHEN** support sends one or more messages within the debounce window
- **THEN** the system SHALL preserve existing batching/debounce behavior for visitor email notifications
- **AND** message-thread content selection SHALL remain behaviorally equivalent

### Requirement: Notification modules MUST expose typed internal contracts

Notification helper modules MUST use explicit typed interfaces for shared context and payload contracts to reduce `any`-based coupling.

#### Scenario: Shared helper is consumed by multiple notification modules

- **WHEN** a shared helper is imported by emitter and dispatch modules
- **THEN** the helper SHALL expose typed inputs/outputs
- **AND** unsafe broad typing in orchestration-critical helper paths SHALL be reduced

