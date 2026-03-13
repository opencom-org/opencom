# rn-sdk-messenger-container-modularity Specification

## Purpose
TBD - created by archiving change decompose-react-native-sdk-messenger-containers. Update Purpose after archive.
## Requirements
### Requirement: OpencomMessenger and OpencomSurvey MUST separate orchestration from presentation

RN SDK messenger and survey containers SHALL use domain hooks/controllers for orchestration and dedicated presentational components for rendering.

#### Scenario: Contributor updates survey progression logic

- **WHEN** survey progression rules are updated
- **THEN** changes SHALL be made in survey orchestration modules
- **AND** unrelated messenger presentation components SHALL not require edits

### Requirement: Container decomposition MUST preserve existing messenger and survey behavior

Refactoring MUST preserve existing behavior for message send/display, tab selection, AI indicator rendering, and survey step transitions.

#### Scenario: Visitor sends message in messenger

- **WHEN** a visitor sends a message through the SDK messenger UI
- **THEN** send flow and resulting conversation updates SHALL remain behaviorally equivalent to pre-refactor behavior

#### Scenario: Survey response progression advances

- **WHEN** a survey user completes a question step
- **THEN** step progression and completion behavior SHALL match pre-refactor behavior

### Requirement: Decomposed containers MUST provide testable domain modules

Extracted orchestration units SHALL expose contracts that can be tested without full container rendering.

#### Scenario: Domain hook unit test executes

- **WHEN** a domain hook is tested in isolation
- **THEN** state transitions and side effects SHALL be verifiable without rendering the full container

