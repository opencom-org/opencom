## ADDED Requirements

### Requirement: SDK-core Convex wrappers remain build-safe for dependent packages
The system SHALL ensure `@opencom/sdk-core` wrapper modules do not fail dependent package typecheck or build verification because of deep generated Convex type expansion.

#### Scenario: Dependent package build traverses sdk-core wrappers
- **WHEN** a dependent package typechecks or builds while traversing `@opencom/sdk-core`
- **THEN** the SDK wrapper modules SHALL resolve Convex function references without triggering `TS2589`
- **AND** the dependent package SHALL not fail solely because of deep generated Convex ref expansion inside unaffected runtime wrappers

### Requirement: SDK-core wrapper behavior remains unchanged after type-surface stabilization
The system SHALL preserve existing SDK wrapper runtime behavior while applying localized Convex type-surface workarounds.

#### Scenario: Existing wrapper methods keep their runtime contract
- **WHEN** a consumer invokes an existing `sdk-core` wrapper method
- **THEN** the same Convex function SHALL be called with unchanged argument semantics
- **AND** the wrapper's externally observable runtime behavior SHALL remain functionally equivalent
