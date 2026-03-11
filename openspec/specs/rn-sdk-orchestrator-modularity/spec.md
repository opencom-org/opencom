# rn-sdk-orchestrator-modularity Specification

## Purpose
TBD - created by archiving change split-react-native-sdk-orchestrator. Update Purpose after archive.
## Requirements
### Requirement: OpencomSDK internals MUST separate session, storage, push, and lifecycle responsibilities

The RN SDK SHALL implement orchestration concerns in dedicated internal modules while preserving a stable public facade.

#### Scenario: Push registration logic update

- **WHEN** push registration behavior changes
- **THEN** the change SHALL be contained within the push module
- **AND** session and storage modules SHALL not require unrelated edits

### Requirement: Public OpencomSDK API MUST remain behaviorally compatible

Refactoring internals MUST preserve public method signatures and externally observable behavior for existing host apps.

#### Scenario: Host app initializes and identifies user

- **WHEN** a host app calls `initialize` then `identify`
- **THEN** visitor/session state transitions SHALL remain behaviorally equivalent to pre-refactor behavior

### Requirement: Lifecycle and persistence flows MUST remain deterministic

Lifecycle timers and persisted state restoration SHALL behave deterministically across app foreground/background cycles.

#### Scenario: App resumes from background with existing session

- **WHEN** app lifecycle changes from background to foreground
- **THEN** session restoration and lifecycle callbacks SHALL execute in deterministic order

