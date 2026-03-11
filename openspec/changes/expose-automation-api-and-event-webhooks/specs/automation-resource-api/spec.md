## ADDED Requirements

### Requirement: Automation API MUST expose CRUD access for automation-critical workspace resources
Opencom SHALL expose a versioned HTTP API that lets authorized automation clients create, read, update, delete, and list automation-critical workspace resources including conversations, messages, visitors, tickets, ticket comments, articles, collections, outbound messages, custom attributes, and custom events according to credential scope.

#### Scenario: Automation syncs knowledge content into Opencom
- **WHEN** an authorized automation client creates or updates collections and articles through the automation API
- **THEN** Opencom SHALL persist those resources with stable IDs and machine-readable state
- **AND** the same resources SHALL be retrievable through the supported external API without relying on internal Convex function names

#### Scenario: Automation reads inbox state and creates follow-on actions
- **WHEN** an authorized automation client reads a conversation and creates a reply, ticket mutation, or outbound message through scoped endpoints
- **THEN** Opencom SHALL authorize the action according to workspace-scoped permissions
- **AND** the resulting resources SHALL remain visible in existing Opencom inbox and outbound management surfaces

### Requirement: Automation API MUST support incremental sync and server-side filtering
List and search endpoints SHALL support cursor-based pagination and server-side filters including updated time, status, channel, assignee, external identifiers, email, and relevant custom-attribute predicates so automation clients can mirror state without full rescans.

#### Scenario: Cron integration polls only changed records
- **WHEN** a cron-based integration requests conversations or articles after a previously returned cursor
- **THEN** the API SHALL return only resources changed after that cursor in stable order
- **AND** the response SHALL include a next cursor for the subsequent sync request

#### Scenario: Automation filters by identity and custom attributes
- **WHEN** an automation client queries visitors or conversations using external user identifiers or supported custom-attribute filters
- **THEN** Opencom SHALL apply those filters server-side within the workspace boundary
- **AND** only matching authorized records SHALL be returned

### Requirement: Mutation endpoints MUST support safe retries and external references
Mutation endpoints SHALL support idempotency keys on non-read operations and SHALL allow automation clients to attach external references so imports and retrying agent actions do not create duplicate state.

#### Scenario: Retried create does not duplicate a resource
- **WHEN** a client retries the same create or upsert request with the same idempotency key after a timeout
- **THEN** Opencom SHALL return the original result or an equivalent stored resource
- **AND** no duplicate resource SHALL be created

#### Scenario: Imported records remain correlated to the source system
- **WHEN** an automation client upserts a visitor, article, or similar managed resource with an external reference
- **THEN** Opencom SHALL retain that mapping in a stable readable form
- **AND** later reads SHALL let the automation correlate the Opencom resource back to the source system
