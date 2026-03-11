## ADDED Requirements

### Requirement: Repo scans SHALL produce a machine-readable contract manifest

The automation SHALL scan canonical repo contracts and emit a machine-readable manifest that can be diffed across runs.

#### Scenario: Pull request scan captures current repo contract state

- **WHEN** the repo scan workflow runs for a pull request or manual branch scan
- **THEN** it SHALL emit a manifest that includes the scanned branch or ref, commit SHA, schema version, and the collected contract data for the configured drift classes
- **AND** it SHALL publish that manifest as a workflow artifact or equivalent run output

### Requirement: Repo scans SHALL compare the current manifest with a trusted prior baseline

The automation SHALL compare the current manifest with a previously trusted scan so maintainers can see what materially changed between runs.

#### Scenario: Branch scan compares against a persisted baseline

- **WHEN** the repo scan workflow runs for an eligible branch
- **THEN** it SHALL load the trusted baseline manifest for comparison
- **AND** it SHALL generate a delta report that identifies added, removed, or changed contract items

#### Scenario: Default-branch scan promotes a new trusted baseline

- **WHEN** a trusted scan runs on the default branch and completes successfully
- **THEN** the workflow SHALL persist the new manifest as the next trusted baseline
- **AND** it SHALL record metadata that links the baseline to the source commit and generation time

### Requirement: Repo scans SHALL surface doc drift as structured findings

The automation SHALL identify documentation drift by comparing curated maintainer-facing docs with canonical repo contracts.

#### Scenario: Docs reference a stale workflow or command contract

- **WHEN** a doc references a command, workflow step, branch, path, env var, or secret that no longer matches the canonical repo contract
- **THEN** the scan SHALL report a structured finding that identifies the doc location, the canonical source, and the mismatch category

#### Scenario: No drift is detected

- **WHEN** the scan finds no configured contract mismatches
- **THEN** it SHALL report a clean result in the workflow summary and structured outputs

### Requirement: Untrusted scan contexts SHALL remain read-only

The repo scan workflow SHALL operate without privileged write behavior in untrusted contexts.

#### Scenario: Forked pull request triggers a scan

- **WHEN** the scan workflow runs for a pull request from a forked repository or another restricted context
- **THEN** it SHALL still produce findings and artifacts
- **AND** it SHALL NOT attempt to promote baseline state, create branches, or open pull requests
