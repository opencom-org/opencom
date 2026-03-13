# web-sdk-boundary-isolation Specification

## Purpose

Define requirements that keep the web app from depending on SDK runtime wrapper modules while preserving access to shared web-safe selector utilities.

## ADDED Requirements

### Requirement: Web selector-scoring imports avoid SDK runtime wrapper packages
The system SHALL provide selector-scoring utilities needed by `apps/web` through a web-safe shared boundary that does not require importing SDK runtime API wrapper modules.

#### Scenario: Web editor surfaces import selector scoring through a web-safe boundary
- **WHEN** the tooltip editor or tour editor needs selector-quality scoring
- **THEN** the web code SHALL import the scoring function and supporting types from a web-safe shared boundary
- **AND** the import path SHALL NOT require `apps/web` to depend on `@opencom/sdk-core`

### Requirement: Web builds are insulated from unrelated SDK runtime wrapper type failures
The system SHALL ensure the web app build dependency graph does not traverse unrelated SDK runtime API wrapper modules solely to access selector utilities.

#### Scenario: SDK runtime wrapper issues do not block web selector utility consumers
- **WHEN** the web app typechecks or builds
- **THEN** web verification SHALL NOT fail solely because of type issues in unrelated SDK runtime API wrapper modules
- **AND** selector utility imports used by web SHALL resolve without loading those runtime wrapper modules
