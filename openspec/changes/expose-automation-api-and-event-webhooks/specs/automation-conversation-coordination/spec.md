## ADDED Requirements

### Requirement: Conversations MUST expose automation-relevant workflow state
Opencom SHALL expose conversation AI workflow state, assignment state, handoff reason, last inbound context, and automation eligibility indicators through the automation API and event feed so external agents can decide when to act.

#### Scenario: External agent inspects a low-confidence handoff
- **WHEN** built-in AI hands a conversation off or marks it unresolved for automation follow-up
- **THEN** the conversation payload and automation event feed SHALL include the current AI workflow state and handoff reason
- **AND** the external automation client SHALL be able to inspect the latest conversation context before attempting a reply

### Requirement: Automation reply flows MUST support explicit claim and release semantics
Opencom SHALL let an authorized automation client claim a conversation for a bounded lease before sending automation-authored replies, and SHALL support releasing or escalating that claim back to human handling.

#### Scenario: Automation claims and replies within its lease
- **WHEN** an eligible automation client claims a conversation and posts a reply before the lease expires
- **THEN** the reply SHALL be accepted as that claim holder's automation response
- **AND** the conversation SHALL record the active claim holder and lease window

#### Scenario: Automation escalates back to a human
- **WHEN** an automation client determines that a human should take over and releases or escalates its claim
- **THEN** Opencom SHALL mark the conversation for human handling
- **AND** subsequent human-agent work SHALL no longer be blocked by the prior automation claim

### Requirement: System MUST prevent conflicting automated replies
Opencom SHALL reject or serialize automated reply attempts that conflict with an active automation claim or with a concurrently executing built-in AI automation path.

#### Scenario: Second automation tries to reply during an active claim
- **WHEN** another automation client attempts to send an automated reply while a valid automation claim is active
- **THEN** Opencom SHALL reject the conflicting automated write or require an explicit override path
- **AND** the conversation SHALL not receive duplicate automated replies from multiple automations

#### Scenario: Built-in AI does not post after an external automation claim becomes active
- **WHEN** built-in AI produces an automated response candidate after an external automation claim is already active
- **THEN** Opencom SHALL suppress or hold the automated send path until the claim is released
- **AND** the system SHALL preserve enough traceability for operators to review the suppressed candidate context
