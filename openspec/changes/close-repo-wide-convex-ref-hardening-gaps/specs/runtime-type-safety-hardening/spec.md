## MODIFIED Requirements

### Requirement: Runtime-critical modules MUST use explicit typed contracts at dynamic boundaries

Covered runtime-critical modules and runtime-adjacent Convex integration boundaries SHALL route dynamic internal calls through typed adapters or constrained function-reference interfaces instead of repeated broad inline casts or generic string-based ref factories.

#### Scenario: Covered runtime boundary schedules or invokes an internal function

- **WHEN** a covered runtime boundary schedules or invokes another Convex function dynamically
- **THEN** the invocation SHALL use a typed adapter contract or fixed typed function reference
- **AND** repeated broad inline cast patterns or arbitrary `name: string` ref helper selection SHALL not expand in covered files

### Requirement: Type safety hardening MUST preserve existing runtime behavior

Type tightening changes across covered backend and runtime-adjacent integration surfaces MUST preserve functional behavior for existing auth, event, series, messaging, and notification execution paths.

#### Scenario: Covered runtime path executes after boundary hardening expansion

- **WHEN** covered runtime and integration flows run after expanded type hardening
- **THEN** runtime outcomes SHALL remain behaviorally equivalent to pre-hardening behavior
- **AND** only contract-safety boundary enforcement changes, not domain behavior semantics
