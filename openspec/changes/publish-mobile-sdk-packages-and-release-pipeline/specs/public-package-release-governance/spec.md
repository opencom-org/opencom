## ADDED Requirements

### Requirement: Release process MUST define git branching and tagging policy

Public package release governance SHALL define a default release path from `main` via version tags and SHALL define when maintenance branches are allowed.

#### Scenario: Standard public package release

- **WHEN** a normal release is prepared
- **THEN** release automation SHALL publish from `main` using semver release tags
- **AND** a long-lived `release` branch SHALL NOT be required for standard releases

#### Scenario: Backport fix for an older supported line

- **WHEN** maintainers must patch an older supported major/minor line
- **THEN** maintainers MAY create a scoped `release/x.y` maintenance branch for that backport
- **AND** the backport flow SHALL NOT alter standard `main` release behavior

### Requirement: Release pipeline MUST automate multi-package publication safely

The release pipeline SHALL run quality checks, versioning, and publish steps for changed public packages in dependency-safe order.

#### Scenario: Tagged release includes multiple public packages

- **WHEN** a release includes package changes affecting more than one public package
- **THEN** the pipeline SHALL detect affected packages
- **AND** publish packages in dependency-safe order
- **AND** fail the release if required quality or publishability gates do not pass

### Requirement: Public package versions MUST preserve backward compatibility expectations

Published public packages SHALL follow SemVer and dist-tag rules that protect older consumers.

#### Scenario: Non-breaking package changes

- **WHEN** a release contains only backward-compatible changes
- **THEN** maintainers SHALL publish patch/minor versions within the current major line
- **AND** consumers on that major line SHALL NOT require migration changes

#### Scenario: Breaking package changes

- **WHEN** a release introduces breaking API or behavior changes
- **THEN** maintainers SHALL publish a new major version
- **AND** release notes SHALL include migration guidance
- **AND** older supported major lines SHALL remain available according to documented support policy

#### Scenario: Prerelease channel use

- **WHEN** maintainers publish prerelease builds
- **THEN** prereleases SHALL use a non-`latest` dist-tag
- **AND** `latest` consumers SHALL NOT be upgraded to prerelease versions implicitly
