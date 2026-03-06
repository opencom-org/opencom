## ADDED Requirements

### Requirement: Campaign-delivery domains MUST be organized via dedicated modules

Carousel and survey Convex modules SHALL organize helper, authoring, delivery, and analytics/triggering concerns through dedicated modules and expose them through stable top-level entrypoints.

#### Scenario: Updating carousel trigger behavior

- **WHEN** a contributor changes carousel trigger logic
- **THEN** changes SHALL be isolated to carousel triggering modules
- **AND** survey response/export modules SHALL not require unrelated edits

### Requirement: Campaign-delivery decomposition MUST preserve endpoint contracts

Refactor SHALL preserve existing carousel and survey endpoint export names, args, and behavior semantics.

#### Scenario: Existing mobile/web callers invoke campaign endpoints

- **WHEN** clients call existing carousel and survey endpoints after decomposition
- **THEN** endpoint names and signatures SHALL remain available
- **AND** dependent package typechecks SHALL remain compatible
