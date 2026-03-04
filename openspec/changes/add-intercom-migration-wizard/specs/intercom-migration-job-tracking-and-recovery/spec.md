## ADDED Requirements

### Requirement: Migration imports MUST run as observable asynchronous jobs
Opencom SHALL execute migration imports as asynchronous jobs with lifecycle states and progress metrics visible to admins.

#### Scenario: Admin tracks active import progress
- **WHEN** a migration job is running
- **THEN** the job status view SHALL show current lifecycle state, percentage progress, and domain-level processed counts
- **AND** progress updates SHALL be visible without restarting the migration flow

#### Scenario: Admin views terminal job outcome
- **WHEN** a migration job reaches completed or failed status
- **THEN** the job status view SHALL show final imported, skipped, and failed counts by selected domain
- **AND** the outcome SHALL include the completion timestamp

### Requirement: Migration jobs MUST support checkpoint-based resume and retry
Opencom SHALL support resuming failed or interrupted migration jobs from the last durable checkpoint without duplicating already imported records.

#### Scenario: Retry resumes after interruption
- **WHEN** a migration job fails due to a transient error after partial import
- **THEN** an admin-triggered retry SHALL resume from the latest persisted checkpoint
- **AND** previously completed checkpoints SHALL NOT be re-imported

#### Scenario: Retry is blocked until blocking cause is fixed
- **WHEN** a failed migration has unresolved blocking configuration errors
- **THEN** the retry action SHALL be disabled
- **AND** the job detail SHALL show the blocking error categories that must be resolved

### Requirement: Migration jobs MUST expose actionable error logs
For failed or partially failed migrations, Opencom SHALL provide structured error logs that identify where failures occurred and what corrective action is recommended.

#### Scenario: Admin investigates failed records
- **WHEN** an admin opens a failed migration job detail
- **THEN** the system SHALL provide domain-specific error buckets with sample record identifiers and failure reasons
- **AND** each error bucket SHALL include recommended remediation guidance before retry
