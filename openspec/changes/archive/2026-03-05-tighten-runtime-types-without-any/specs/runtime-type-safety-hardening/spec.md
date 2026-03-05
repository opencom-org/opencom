## ADDED Requirements

### Requirement: Runtime-critical modules MUST use explicit typed contracts at dynamic boundaries

Covered runtime-critical modules SHALL route dynamic internal calls through typed adapters or constrained interfaces instead of repeated broad inline casts.

#### Scenario: Runtime schedules internal workflow function

- **WHEN** a runtime-critical module schedules or invokes an internal workflow handler
- **THEN** the invocation SHALL use a typed adapter contract
- **AND** repeated broad inline cast patterns SHALL not expand in covered files

### Requirement: Shared types consumed by runtime-critical paths MUST avoid broad unknown payloads when structure is known

Shared type definitions used by runtime-critical logic MUST model known payload shape with explicit types or constrained unions.

#### Scenario: Runtime logic consumes shared payload field

- **WHEN** runtime-critical code reads a shared payload field with known structure
- **THEN** that field SHALL be typed with an explicit shape rather than unconstrained `unknown`

### Requirement: Type safety hardening MUST preserve existing runtime behavior

Type tightening changes MUST preserve functional behavior for covered auth, event, and series runtime paths.

#### Scenario: Covered runtime path executes after hardening

- **WHEN** covered auth/event/series flows run after type hardening
- **THEN** runtime outcomes SHALL remain behaviorally equivalent to pre-change behavior
