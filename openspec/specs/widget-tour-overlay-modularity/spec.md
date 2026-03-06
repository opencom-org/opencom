# widget-tour-overlay-modularity Specification

## Purpose
TBD - created by archiving change decompose-widget-tour-overlay-controller. Update Purpose after archive.
## Requirements
### Requirement: Widget tour overlay MUST separate controller logic from render sections

The widget tour overlay SHALL organize controller orchestration, domain helper logic, and render sections into dedicated modules while preserving existing behavior.

#### Scenario: Updating a render variant

- **WHEN** a contributor changes pointer/post/recovery tour card UI
- **THEN** view changes SHALL be isolated to tour overlay presentational modules
- **AND** controller mutation orchestration SHALL remain untouched

### Requirement: Tour overlay decomposition MUST preserve existing contracts

Refactor SHALL preserve `TourOverlay` prop contracts, mutation behavior, and existing test selectors used by widget and embedding tests.

#### Scenario: Existing tests and callers execute after decomposition

- **WHEN** widget tests render `TourOverlay` and interact with tour controls
- **THEN** existing test IDs and interaction flow SHALL still work
- **AND** web/widget typechecks SHALL remain compatible

