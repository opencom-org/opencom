## ADDED Requirements

### Requirement: Remaining hardening gaps MUST have a single explicit owner

Every remaining Convex ref-boundary gap identified by the repo-wide inventory SHALL be assigned to one owning change or an explicit accepted exception.

#### Scenario: Team records a remaining gap from the full-repo scan

- **WHEN** a file cluster is identified as still using a prohibited broad ref-boundary pattern
- **THEN** the inventory records exactly one owner change for addressing it
- **AND** the gap is not left duplicated across multiple active proposals

#### Scenario: Team accepts a narrowly constrained dynamic exception

- **WHEN** a remaining gap cannot use fixed typed refs because the target function name is intentionally caller-selected
- **THEN** the inventory records that file as an explicit accepted exception instead of silently treating it as unfinished migration work
- **AND** the exception documents the narrow allowed scope and the guardrail that prevents it from expanding into a general runtime pattern

### Requirement: Existing package-specific hardening changes MUST remain the owners where their target architecture still applies

Older package-specific changes for web, widget, and React Native SDK boundary architecture SHALL remain the implementation owners when the current codebase still matches their intended migration model.

#### Scenario: Remaining web, widget, or React Native SDK gap matches an active older proposal

- **WHEN** a remaining gap is found in `apps/web`, `apps/widget`, or `packages/react-native-sdk`
- **THEN** the gap is tracked under the relevant existing package-specific change if that change already defines the intended boundary architecture
- **AND** this cross-surface change does not duplicate the same implementation ownership

### Requirement: Tactical predecessor changes MUST be verified before closure or supersession

Older tactical type-stability changes SHALL be checked against the current codebase to determine whether they are already implemented but unverified, or whether genuine follow-on work is still required.

#### Scenario: Older tactical change has unchecked tasks

- **WHEN** an older tactical change still has incomplete task checkboxes
- **THEN** the team verifies the current implementation against the change artifacts rather than assuming the work is missing
- **AND** the change is either completed/archived if its implemented scope is satisfied or followed by a narrower explicit delta for remaining work

### Requirement: Residual backend and guardrail work MUST ship in verification-gated micro-batches

Residual implementation owned by this change SHALL be delivered in small file clusters with package verification after each cluster.

#### Scenario: Team completes a residual backend or guardrail micro-batch

- **WHEN** a residual `packages/convex` cleanup or shared guardrail batch is ready to expand
- **THEN** the touched package typecheck has already passed
- **AND** focused tests for the touched file cluster have already passed before the next cluster begins

### Requirement: Covered paths MUST include anti-regression guardrails

Covered residual backend and shared test-helper paths SHALL include guardrails that detect reintroduction of prohibited broad ref-boundary patterns.

#### Scenario: New code reintroduces a prohibited broad ref pattern in a covered path

- **WHEN** a change adds a prohibited broad helper or untyped Convex ref boundary in a covered path
- **THEN** a guard test or quality check fails during verification
- **AND** the failure identifies the violating pattern and covered scope
