## ADDED Requirements

### Requirement: Covered sdk-core wrapper modules MUST use fixed Convex refs
The system MUST implement covered `@opencom/sdk-core` wrapper modules with explicit fixed Convex function refs rather than generic `getQueryRef(name: string)` or `getMutationRef(name: string)` factories.

#### Scenario: Covered wrapper issues a Convex call
- **WHEN** a covered sdk-core API file invokes a Convex query or mutation
- **THEN** it selects the target through a fixed local ref constant or dedicated typed ref module
- **AND** the wrapper file does not accept an arbitrary function name string to choose the target at runtime

### Requirement: Explicit ref hardening MUST preserve sdk-core wrapper contracts
The system MUST preserve existing wrapper method names, payload semantics, and returned data behavior while replacing generic string ref factories.

#### Scenario: Consumer calls a hardened wrapper method
- **WHEN** a consumer invokes an existing sdk-core wrapper method after the refactor
- **THEN** the same backend function contract is reached with equivalent arguments and results
- **AND** consumers do not need to change how they call the wrapper

### Requirement: sdk-core ref hardening MUST remain build-safe
The system MUST keep any required `TS2589` workaround localized to fixed ref declarations or another explicit shallow boundary rather than reintroducing a generic selector helper.

#### Scenario: Covered module still needs a deep-instantiation workaround
- **WHEN** a hardened sdk-core wrapper still hits Convex deep type expansion
- **THEN** the workaround is applied to an explicit fixed ref or another narrow, named boundary
- **AND** the module remains free of a reusable `name: string` function-ref factory
