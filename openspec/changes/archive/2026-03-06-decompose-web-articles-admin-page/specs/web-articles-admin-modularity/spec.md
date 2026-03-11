## ADDED Requirements

### Requirement: Articles admin render sections MUST be implemented as dedicated modules

The articles admin route SHALL implement import/export/history workflows, article list filtering/table rendering, and delete confirmation rendering through dedicated local modules instead of a single monolithic page file.

#### Scenario: Updating markdown import UI

- **WHEN** a contributor changes markdown import controls or preview rendering
- **THEN** changes SHALL be isolated to dedicated import/export section modules
- **AND** article table and delete dialog modules SHALL not require unrelated edits

### Requirement: Articles admin decomposition MUST preserve existing workflow behavior

Extraction SHALL preserve current article CRUD operations, markdown import/export flow, and existing import/export test selectors used by automation.

#### Scenario: Agent applies markdown import after preview

- **WHEN** an agent previews markdown folder changes and applies import
- **THEN** the same mutation flow and status/error notices SHALL be invoked
- **AND** existing import/export UI selectors SHALL remain functionally equivalent
