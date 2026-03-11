# convex-auth-wrapper-adoption Specification

## Purpose
TBD - created by archiving change expand-convex-auth-wrapper-adoption. Update Purpose after archive.
## Requirements
### Requirement: Convex domains MUST use shared auth wrappers for compatible endpoints

Convex modules SHALL use shared auth wrappers for endpoints whose existing unauthorized behavior aligns with wrapper semantics.

#### Scenario: Updating a mutation that requires workspace permission

- **WHEN** a contributor modifies a mutation with required workspace permissions
- **THEN** auth and permission checks SHALL be routed through shared auth wrappers
- **AND** endpoint args/behavior SHALL remain stable

### Requirement: Soft-fail read behavior MUST be preserved

Refactor SHALL preserve existing read-path endpoints that intentionally return fallback values instead of throwing on access denial.

#### Scenario: Existing read endpoint returns empty fallback on missing permissions

- **WHEN** callers invoke soft-fail read endpoints after wrapper adoption
- **THEN** endpoints SHALL continue returning `null`/`[]`/`0` as before
- **AND** no unauthorized throw regressions SHALL be introduced for those endpoints

