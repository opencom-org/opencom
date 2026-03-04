## ADDED Requirements

### Requirement: Mobile SDK distribution MUST provide registry-installable packages with resolvable dependencies

Published mobile SDK packages SHALL be installable from supported registries with fully resolvable transitive dependencies.

#### Scenario: Consumer installs SDK in external project

- **WHEN** a consumer runs the documented SDK install command in a non-monorepo project
- **THEN** dependency resolution SHALL succeed without unresolved workspace protocol references

### Requirement: Release pipeline MUST automate versioned SDK publication

The release pipeline SHALL perform versioning, quality checks, build, and publish for configured mobile SDK packages.

#### Scenario: Release pipeline runs for a tagged release

- **WHEN** a release is triggered for SDK packages
- **THEN** the pipeline SHALL run required quality/build checks
- **AND** publish versioned artifacts to configured registry targets on success

### Requirement: Installation documentation MUST match published distribution reality

Mobile SDK documentation SHALL describe the currently supported install commands and registry configuration requirements.

#### Scenario: New consumer follows docs

- **WHEN** a developer follows the documented installation flow
- **THEN** they SHALL be able to install and import the SDK successfully
