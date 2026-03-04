## ADDED Requirements

### Requirement: Public package portfolio MUST define publish scope explicitly

The release system SHALL maintain an explicit inventory of packages classified as public-supported, public-experimental, or internal-only.

#### Scenario: Maintainer evaluates package for publication

- **WHEN** a package is considered for npm publication
- **THEN** the package SHALL be classified in the portfolio inventory before release automation can publish it
- **AND** classification SHALL include ownership and support expectation

### Requirement: Public packages MUST be registry-installable with resolvable dependencies

Published public packages SHALL be installable in external projects with fully resolvable transitive dependencies.

#### Scenario: Consumer installs a published package in a non-monorepo project

- **WHEN** a consumer runs the documented install command
- **THEN** dependency resolution SHALL succeed without unresolved workspace protocol references
- **AND** package exports/files metadata SHALL resolve correctly in the consumer runtime

### Requirement: Distribution docs MUST match approved package portfolio

Installation and usage documentation SHALL reflect the currently approved public package set and supported consumer frameworks.

#### Scenario: New consumer follows framework-specific docs

- **WHEN** a developer follows docs for a supported package and framework path
- **THEN** they SHALL be able to install, import, and run the documented quick start successfully
