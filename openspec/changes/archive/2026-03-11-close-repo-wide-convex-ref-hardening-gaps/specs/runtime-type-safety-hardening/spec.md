## MODIFIED Requirements

### Requirement: Runtime-critical modules MUST use explicit typed contracts at dynamic boundaries

Covered residual backend runtime-critical modules SHALL route dynamic internal calls through typed adapters or constrained function-reference interfaces instead of repeated broad inline casts or generic string-based ref factories.

#### Scenario: Residual backend runtime boundary schedules or invokes an internal function

- **WHEN** a covered residual backend runtime boundary schedules or invokes another Convex function dynamically
- **THEN** the invocation SHALL use a typed adapter contract or fixed typed function reference
- **AND** repeated broad inline cast patterns or arbitrary `name: string` ref helper selection SHALL not expand in the covered backend files

### Requirement: Type safety hardening MUST preserve existing runtime behavior

Type tightening changes across covered residual backend runtime paths MUST preserve functional behavior for existing auth, event, series, messaging, notification, and related execution flows.

#### Scenario: Residual backend runtime path executes after hardening

- **WHEN** a covered residual backend runtime flow runs after type hardening cleanup
- **THEN** runtime outcomes SHALL remain behaviorally equivalent to pre-hardening behavior
- **AND** only contract-safety boundary enforcement changes, not domain behavior semantics
