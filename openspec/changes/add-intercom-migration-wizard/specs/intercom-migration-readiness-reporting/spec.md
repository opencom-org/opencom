## ADDED Requirements

### Requirement: Readiness report MUST validate migration prerequisites before import
Opencom SHALL run a preflight validation pass before import start and produce a readiness report that classifies findings as blocking errors or non-blocking warnings.

#### Scenario: Blocking validation failure prevents import
- **WHEN** preflight detects missing required mappings or missing source permissions
- **THEN** the readiness report SHALL classify those findings as blocking errors
- **AND** the wizard SHALL disable import start until all blocking errors are resolved

#### Scenario: Non-blocking warnings allow import with acknowledgement
- **WHEN** preflight detects warning-level issues that do not prevent import
- **THEN** the readiness report SHALL list each warning with impact context
- **AND** the admin SHALL be able to continue only after explicitly acknowledging warnings

### Requirement: Readiness report MUST identify unsupported Intercom features with fallback guidance
If the selected source workspace includes unsupported Intercom objects or feature constructs, the readiness report SHALL identify each unsupported item and provide a recommended fallback path.

#### Scenario: Unsupported feature is detected
- **WHEN** preflight finds an unsupported source feature in selected migration scope
- **THEN** the readiness report SHALL list the feature name and affected records count
- **AND** the report SHALL include an explicit fallback action (for example manual recreation or alternative Opencom primitive)

### Requirement: Readiness report MUST provide an auditable summary for sign-off
Opencom SHALL preserve a timestamped readiness summary for each migration attempt so teams can review what risks were accepted before import start.

#### Scenario: Admin reviews readiness before running import
- **WHEN** an admin opens the review step after preflight completes
- **THEN** the wizard SHALL show totals for blocking errors, warnings, and ready entities by selected domain
- **AND** the system SHALL store the final readiness summary linked to the eventual migration job
