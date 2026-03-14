## ADDED Requirements

### Requirement: Automation access MUST use workspace-scoped credentials with granular scopes
Opencom SHALL let workspace admins create, rotate, disable, and expire automation credentials that are scoped to explicit resource capabilities instead of inheriting unrestricted admin access.

#### Scenario: Admin creates a read-only automation credential
- **WHEN** an admin issues an automation credential with read-only visitor and conversation scopes
- **THEN** that credential SHALL be accepted for supported read operations on those resources
- **AND** write attempts or access to unscoped resources SHALL be rejected

#### Scenario: Rotated or disabled credentials stop working
- **WHEN** an admin rotates or disables an automation credential
- **THEN** subsequent API calls using the old secret SHALL be rejected
- **AND** the credential lifecycle change SHALL be captured in audit history

### Requirement: Automation actions MUST preserve actor attribution and auditability
Actions performed through the automation API or webhook-triggered flows SHALL be attributed to a named automation actor or credential in audit logs and affected resource history so operators can distinguish external automation from human agents and built-in AI.

#### Scenario: External automation mutates a support record
- **WHEN** an automation credential sends a reply or updates a ticket, visitor, or article
- **THEN** the affected resource history SHALL identify the automation actor as the source of the change
- **AND** audit logs SHALL record the workspace, credential, action, and target resource

### Requirement: Automation platform MUST enforce secret-handling and rate-limit safeguards
Automation credentials and webhook secrets SHALL use least-privilege security controls including one-time secret reveal and per-workspace rate limiting for public automation traffic. API credential secrets are stored as one-way SHA-256 hashes. Webhook signing secrets are stored encrypted server-side, are only returned once on creation, and list and get endpoints expose only a prefix.

#### Scenario: Existing credentials do not expose recoverable secrets
- **WHEN** an admin views an existing automation credential after its initial creation
- **THEN** Opencom SHALL show non-secret metadata such as name, scopes, status, and last-used time
- **AND** the original secret value SHALL not be recoverable

#### Scenario: Client exceeds automation rate limits
- **WHEN** an automation client exceeds the configured request budget for its workspace or credential
- **THEN** the API SHALL return a rate-limit error with retry timing metadata
- **AND** the system SHALL continue protecting other workspace traffic from starvation
