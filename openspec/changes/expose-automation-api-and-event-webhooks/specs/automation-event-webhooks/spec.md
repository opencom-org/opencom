## ADDED Requirements

### Requirement: Automation event delivery MUST support both polling and webhook consumption
Opencom SHALL expose a canonical automation event feed that can be consumed either through outbound webhooks or through cursor-based polling using the same event IDs, event types, and resource references.

#### Scenario: Workspace uses cron polling instead of webhooks
- **WHEN** a workspace chooses cron-based polling for automation triggers
- **THEN** the polling endpoint SHALL expose the same canonical event identities and event semantics used for outbound webhooks
- **AND** the workspace SHALL not need a separate polling-only integration contract

### Requirement: Webhook subscriptions MUST be configurable by event type and scope filters
Workspace admins SHALL be able to register webhook endpoints that subscribe to selected automation event types and optional supported filters such as resource domain, channel, or AI workflow state.

#### Scenario: Admin subscribes only to selected trigger classes
- **WHEN** an admin configures a webhook subscription for new visitor-message events and AI handoff events
- **THEN** Opencom SHALL deliver only matching automation events to that endpoint
- **AND** unrelated resource changes SHALL not be sent to that subscription

### Requirement: Webhook deliveries MUST be signed, retried, and replayable
Opencom SHALL deliver webhook payloads with an HMAC signature, stable event and delivery identifiers, at-least-once retry behavior, and persisted attempt history that supports manual replay.

#### Scenario: Delivery retries after transient failure
- **WHEN** a webhook destination returns a retryable failure for an event delivery
- **THEN** Opencom SHALL retry delivery according to the documented backoff policy using the same canonical event ID
- **AND** later successful delivery SHALL be recorded as another attempt against that same event

#### Scenario: Admin replays a failed delivery
- **WHEN** an admin replays a previously failed webhook delivery after fixing the destination endpoint
- **THEN** Opencom SHALL re-send the stored event payload with a new delivery attempt record
- **AND** the replay SHALL remain linked to the original event and subscription history
