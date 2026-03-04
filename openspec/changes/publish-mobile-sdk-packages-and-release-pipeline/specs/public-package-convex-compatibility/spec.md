## ADDED Requirements

### Requirement: Public packages using Convex contracts MUST declare compatibility ranges

Any published public package that relies on Convex backend contracts SHALL declare its supported backend contract version range.

#### Scenario: Package release preparation includes Convex-dependent package

- **WHEN** maintainers prepare a release for a package that depends on Convex contracts
- **THEN** release metadata SHALL include minimum and maximum supported backend contract versions (or equivalent compatible range)

### Requirement: Release validation MUST check Convex compatibility matrix

Release automation SHALL validate Convex-dependent public packages against the documented supported backend contract range.

#### Scenario: Release validation runs for Convex-dependent package

- **WHEN** release checks run
- **THEN** validation SHALL exercise compatibility against minimum and current supported backend contract versions
- **AND** release SHALL fail if compatibility checks do not pass

### Requirement: Runtime incompatibility MUST fail deterministically with guidance

When a consumer uses a package with an unsupported backend contract version, the package SHALL surface an explicit compatibility failure.

#### Scenario: Consumer app initializes against unsupported backend contract

- **WHEN** package initialization detects backend contract version outside supported range
- **THEN** the package SHALL return a deterministic compatibility error with actionable upgrade guidance
- **AND** the error SHALL be distinguishable from transient network or authentication failures
