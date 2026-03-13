# web-tour-editor-modularity Specification

## Purpose
TBD - created by archiving change decompose-web-tour-editor. Update Purpose after archive.
## Requirements
### Requirement: Tour editor pane rendering is modularized behind dedicated local components
The system SHALL implement the web tour editor through dedicated local modules for the steps panel, settings panel, and step create/edit modal while preserving existing authoring behavior.

#### Scenario: Tour editor composes extracted panels
- **WHEN** the web tour editor route renders
- **THEN** page-level orchestration SHALL remain in `page.tsx`
- **AND** steps rendering SHALL be delegated to a dedicated local component
- **AND** settings rendering SHALL be delegated to a dedicated local component
- **AND** step create/edit modal rendering SHALL be delegated to a dedicated local component

### Requirement: Tour editor helper logic is extracted from page rendering
The system SHALL move reusable tour-editor types and helper logic out of `page.tsx` into local shared modules without changing step validation or guidance behavior.

#### Scenario: Step form defaults and guidance stay consistent after extraction
- **WHEN** a user opens the add/edit step modal
- **THEN** default step values SHALL match pre-refactor behavior
- **AND** selector-quality warnings SHALL still be computed for fragile selectors
- **AND** route consistency guidance SHALL still appear when a step route differs from the tour default

### Requirement: Tour editor behavior remains unchanged after recomposition
The system SHALL preserve existing tour save, activation, authoring-session launch, and step CRUD flows after the editor is recomposed around extracted modules.

#### Scenario: Existing authoring actions continue to work
- **WHEN** a user edits tour settings, saves the tour, activates or deactivates it, opens on-site authoring, or creates/updates/reorders/deletes steps
- **THEN** the same Convex mutations SHALL be invoked with unchanged payload semantics
- **AND** the user-visible authoring flow SHALL remain functionally equivalent

