# convex-reporting-domain-modularity Specification

## Purpose
TBD - created by archiving change decompose-convex-reporting-domain. Update Purpose after archive.
## Requirements
### Requirement: Reporting domain logic MUST be implemented through dedicated modules

The Convex reporting module SHALL organize conversation, agent, CSAT, AI, snapshot, and dashboard logic in dedicated modules and expose them through a stable `reporting.ts` entrypoint.

#### Scenario: Updating CSAT eligibility behavior

- **WHEN** a contributor updates CSAT eligibility logic
- **THEN** changes SHALL be isolated to reporting CSAT modules
- **AND** unrelated AI or snapshot modules SHALL not require unrelated edits

### Requirement: Reporting decomposition MUST preserve endpoint contracts

Refactor SHALL preserve existing reporting endpoint export names, args, and behavior semantics.

#### Scenario: Existing dashboard caller invokes reporting queries

- **WHEN** clients call existing reporting endpoints after decomposition
- **THEN** endpoint names and signatures SHALL remain available
- **AND** dependent package typechecks SHALL remain compatible

