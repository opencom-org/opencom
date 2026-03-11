## ADDED Requirements

### Requirement: The repo MUST maintain a prioritized inventory of controller-hook/domain-module refactor opportunities
The project MUST maintain an audit of high-value modules where route, controller, or surface files have become orchestration-heavy enough to warrant controller-hook/domain-module decomposition.

#### Scenario: Audit identifies a high-complexity route module
- **GIVEN** a route or controller module that mixes several unrelated domains, state machines, event handlers, and data wiring concerns
- **WHEN** the repo-wide audit is updated
- **THEN** that module is either documented as an opportunity candidate or explicitly noted as intentionally left as-is
- **AND** the audit records the rationale and recommended decomposition boundary

### Requirement: The audit MUST recommend explicit controller-hook/domain-module boundaries rather than vague modularity goals
Audit recommendations MUST describe the intended extraction boundary shape so follow-on refactors can be scoped clearly.

#### Scenario: Audit recommends decomposition for an article management page
- **GIVEN** a page with long prop surfaces caused by concentrated orchestration in the parent module
- **WHEN** the audit records that page as a candidate
- **THEN** the recommendation identifies likely controller-hook and domain-module boundaries
- **AND** it does not merely say to 'split the file up' without describing the preferred ownership model

### Requirement: Guidance MUST clarify when explicit prop passing is acceptable and when context is not the default remedy
The documented pattern MUST state that explicit prop passing remains acceptable for shallow, cohesive trees, and that context is not the default answer to orchestration-heavy files.

#### Scenario: Contributor evaluates a prop-heavy page section
- **GIVEN** a contributor considering how to simplify a prop-heavy page
- **WHEN** they consult the documented modularity guidance
- **THEN** they find guidance preferring controller-hook/domain-module decomposition before introducing context for page-local state
- **AND** they find criteria for when context is actually justified
