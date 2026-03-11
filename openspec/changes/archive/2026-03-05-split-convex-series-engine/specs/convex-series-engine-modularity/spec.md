## ADDED Requirements

### Requirement: Series engine MUST separate authoring, runtime, scheduler, and telemetry responsibilities

The series engine SHALL implement authoring APIs, runtime progression, scheduler/event orchestration, and telemetry updates in explicit modules with stable interfaces.

#### Scenario: Authoring logic changes

- **WHEN** a contributor updates series authoring validation or persistence behavior
- **THEN** the change SHALL be contained in the authoring module
- **AND** runtime progression and telemetry modules SHALL not require edits

#### Scenario: Telemetry logic changes

- **WHEN** a contributor updates block telemetry aggregation behavior
- **THEN** the change SHALL be contained in the telemetry module
- **AND** authoring and runtime modules SHALL remain unaffected

### Requirement: Refactor MUST preserve progression and scheduling semantics

The modularized implementation MUST preserve existing series progression behavior for retries, wait states, trigger-driven resume, and terminal status transitions.

#### Scenario: Retry scheduling after transient failure

- **WHEN** runtime progression fails and schedules a retry
- **THEN** retry timing and target internal handler SHALL remain behaviorally equivalent to pre-refactor behavior

#### Scenario: Resume from wait-for-event state

- **WHEN** a qualifying event resumes a waiting series progress record
- **THEN** the same next block transition and status updates SHALL occur as before refactor

### Requirement: Runtime scheduler integrations MUST use typed internal adapters

Scheduler/internal runtime call sites SHALL be routed through typed adapters rather than repeated broad casts in progression logic.

#### Scenario: Runtime schedules internal progression handler

- **WHEN** progression logic enqueues an internal follow-up run
- **THEN** the call SHALL use the typed scheduler adapter
- **AND** runtime-critical paths SHALL avoid new unsafe cast expansion
