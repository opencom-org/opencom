## MODIFIED Requirements

### Requirement: Tour editor helper logic is extracted from page rendering
The system SHALL move reusable tour-editor types and helper logic out of `page.tsx` into local shared modules without changing step validation or guidance behavior.

#### Scenario: Step form defaults and guidance stay consistent after extraction
- **WHEN** a user opens the add/edit step modal
- **THEN** default step values SHALL match pre-refactor behavior
- **AND** selector-quality warnings SHALL still be computed for fragile selectors through a web-safe shared utility boundary
- **AND** route consistency guidance SHALL still appear when a step route differs from the tour default
