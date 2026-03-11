# web-settings-domain-modularity Specification

## Purpose
TBD - created by archiving change decompose-web-settings-page-by-domain. Update Purpose after archive.
## Requirements
### Requirement: Settings page domains MUST be implemented in dedicated modules

High-complexity settings domains SHALL be extracted from `settings/page.tsx` into dedicated components/hooks so domain logic is not co-located in one page file.

#### Scenario: Team settings flow changes

- **WHEN** invite/role/ownership behavior is updated
- **THEN** the implementation SHALL be modified in team settings domain modules
- **AND** `settings/page.tsx` SHALL only compose those modules

### Requirement: Extraction MUST preserve settings behavior and permissions

Domain extraction SHALL not change user-visible permissions, mutation targets, or success/error behavior.

#### Scenario: Admin invites a member

- **WHEN** an admin submits a team invitation from settings
- **THEN** the same invite action SHALL be called with existing payload semantics
- **AND** success/error feedback behavior SHALL remain functionally equivalent

### Requirement: Orchestration-heavy settings routes SHOULD prefer controller-hook and domain-module decomposition

When a settings route grows large because it owns multiple domains, action handlers, local state slices, and section-level wiring, the preferred decomposition pattern SHOULD keep the route focused on composition while extracted controller hooks and local domain modules own focused orchestration and view-model shaping.

#### Scenario: Settings page mixes multiple domains and long prop surfaces

- **GIVEN** a settings route where section props become large because the page owns cross-domain orchestration
- **WHEN** contributors refactor that route for maintainability
- **THEN** they SHOULD prefer explicit controller-hook and domain-module extraction boundaries
- **AND** the route SHOULD remain focused on composition and top-level wiring

### Requirement: Explicit prop passing remains acceptable and context is not the default remedy

Settings modularity guidance SHALL treat shallow, cohesive prop passing as acceptable and SHALL NOT require context as the default response to large page files.

#### Scenario: Contributor evaluates a prop-heavy settings section

- **GIVEN** a settings page section that receives many props from a parent route
- **WHEN** the contributor evaluates maintainability options
- **THEN** they MAY keep explicit prop passing when the contract remains cohesive and shallow
- **AND** they SHOULD prefer controller-hook/domain-module decomposition before introducing context for page-local orchestration state
