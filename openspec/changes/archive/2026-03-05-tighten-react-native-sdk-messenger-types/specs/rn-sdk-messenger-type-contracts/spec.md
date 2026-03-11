## ADDED Requirements

### Requirement: Messenger composition MUST use explicit shared prop contracts

RN SDK messenger composition SHALL use canonical shared prop interfaces between composition layers.

#### Scenario: MessengerContent passes conversation state props

- **WHEN** `MessengerContent` passes conversation-related props to `OpencomMessenger`
- **THEN** props SHALL conform to canonical shared interfaces
- **AND** broad cast escapes SHALL not be required

### Requirement: Broad cast escapes MUST be removed from covered messenger composition paths

Covered messenger composition files MUST avoid `as any` in core prop wiring paths.

#### Scenario: Type mismatch exists between composer and consumer

- **WHEN** caller and callee prop shapes differ
- **THEN** the implementation SHALL use a typed adapter transform
- **AND** it SHALL not rely on broad cast suppression

### Requirement: Type hardening MUST preserve runtime messenger behavior

Type contract refactors SHALL preserve existing runtime behavior of composed messenger views.

#### Scenario: Messenger renders and handles conversation changes

- **WHEN** the composed messenger view renders and conversation selection changes
- **THEN** UI and callback behavior SHALL remain equivalent to pre-hardening behavior
