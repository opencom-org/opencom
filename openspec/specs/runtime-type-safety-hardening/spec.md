# runtime-type-safety-hardening Specification

## Purpose
TBD - created by archiving change tighten-runtime-types-without-any. Update Purpose after archive.
## Requirements
### Requirement: Runtime-critical modules MUST use explicit typed contracts at dynamic boundaries

Covered residual backend runtime-critical modules SHALL route dynamic internal calls through typed adapters or constrained function-reference interfaces instead of repeated broad inline casts or generic string-based ref factories.

#### Scenario: Residual backend runtime boundary schedules or invokes an internal function

- **WHEN** a covered residual backend runtime boundary schedules or invokes another Convex function dynamically
- **THEN** the invocation SHALL use a typed adapter contract or fixed typed function reference
- **AND** repeated broad inline cast patterns or arbitrary `name: string` ref helper selection SHALL not expand in the covered backend files

### Requirement: Shared types consumed by runtime-critical paths MUST avoid broad unknown payloads when structure is known

Shared type definitions used by runtime-critical logic MUST model known payload shape with explicit types or constrained unions.

#### Scenario: Runtime logic consumes shared payload field

- **WHEN** runtime-critical code reads a shared payload field with known structure
- **THEN** that field SHALL be typed with an explicit shape rather than unconstrained `unknown`

### Requirement: Type safety hardening MUST preserve existing runtime behavior

Type tightening changes across covered residual backend runtime paths MUST preserve functional behavior for existing auth, event, series, messaging, notification, and related execution flows.

#### Scenario: Residual backend runtime path executes after hardening

- **WHEN** a covered residual backend runtime flow runs after type hardening cleanup
- **THEN** runtime outcomes SHALL remain behaviorally equivalent to pre-hardening behavior
- **AND** only contract-safety boundary enforcement changes, not domain behavior semantics

