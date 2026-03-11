## ADDED Requirements

### Requirement: Trusted doc-drift findings SHALL be remediable through docs-only pull requests

The automation SHALL be able to turn eligible doc-drift findings into a documentation-only remediation branch and pull request.

#### Scenario: Same-repo branch drift produces a remediation pull request

- **WHEN** a trusted scan detects doc drift on an eligible branch in the same repository
- **THEN** the remediation workflow SHALL create or update a remediation branch from that branch
- **AND** it SHALL open or update a pull request that targets the originating branch

### Requirement: Automated remediation SHALL stay within an approved writable doc scope

The remediation workflow SHALL restrict automated edits to an explicit allowlist of documentation paths.

#### Scenario: Agent proposes a non-doc code edit

- **WHEN** the remediation workflow detects changes outside the configured documentation allowlist
- **THEN** it SHALL fail the remediation run
- **AND** it SHALL NOT open or update a pull request with those out-of-scope changes

### Requirement: Automated remediation SHALL validate fixes before opening or updating a pull request

The remediation workflow SHALL verify that the generated changes actually resolve the targeted drift findings.

#### Scenario: Remediation removes targeted drift

- **WHEN** the agent proposes documentation updates for a set of structured drift findings
- **THEN** the workflow SHALL rerun the configured drift verification against the changed docs
- **AND** it SHALL only open or update the pull request if the targeted findings no longer reproduce

#### Scenario: Remediation produces no valid doc changes

- **WHEN** the remediation workflow finishes with no doc changes or with unresolved targeted drift findings
- **THEN** it SHALL report the failure in workflow output
- **AND** it SHALL NOT create a new pull request

### Requirement: Restricted contexts SHALL not trigger privileged remediation

The automation SHALL refuse write-capable remediation in restricted contexts.

#### Scenario: Forked pull request drift is detected

- **WHEN** doc drift is detected for a pull request from a forked repository or another restricted context
- **THEN** the system SHALL publish findings for maintainers
- **AND** it SHALL NOT create a remediation branch or pull request automatically

### Requirement: Remediation prompts SHALL be bounded by scan evidence

The agent input SHALL be limited to the structured findings, canonical source references, and approved writable doc scope for the remediation run.

#### Scenario: Agent receives remediation context

- **WHEN** the remediation workflow invokes the configured coding agent
- **THEN** the prompt or input payload SHALL include the targeted findings, canonical source references, target branch, and writable path allowlist
- **AND** it SHALL exclude unrelated repo-wide editing objectives
