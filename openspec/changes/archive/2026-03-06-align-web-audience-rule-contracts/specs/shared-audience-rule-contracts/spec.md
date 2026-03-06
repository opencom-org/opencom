## ADDED Requirements

### Requirement: Web audience targeting payloads MUST match Convex validator contracts

Web targeting editors SHALL produce payload shapes that conform to corresponding Convex argument validators for each endpoint.

#### Scenario: Segment-capable surface submits targeting

- **WHEN** a web surface backed by `audienceRulesOrSegmentValidator` submits segment targeting
- **THEN** the payload SHALL use `{ segmentId }` shape
- **AND** it SHALL remain accepted by typecheck without unsafe casts

#### Scenario: Inline-only surface submits targeting

- **WHEN** a web surface backed by `audienceRulesValidator` submits targeting
- **THEN** the payload SHALL contain only inline condition/group rule structures
- **AND** segment references SHALL be excluded from its local targeting state

### Requirement: Shared audience-rule contracts MUST be reusable across web modules

Audience-rule condition/group/segment contract types SHALL be defined in `@opencom/types` and reused by web modules that build or normalize targeting state.

#### Scenario: Builder and helper use shared contract

- **WHEN** `AudienceRuleBuilder` and audience-rule helper modules compile
- **THEN** they SHALL import audience-rule contract types from `@opencom/types`
- **AND** duplicate local contract definitions SHALL be minimized
