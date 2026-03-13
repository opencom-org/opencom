## ADDED Requirements

### Requirement: Shared backend ref modules MUST export fixed refs instead of generic selector helpers

The system MUST implement covered shared backend Convex ref modules with explicit module-scope function-ref constants and named runner helpers instead of reusable `name: string` selector helpers.

#### Scenario: Shared helper module exposes reusable backend refs

- **WHEN** a covered helper module under `packages/convex/convex/**` publishes refs for other runtime files
- **THEN** each supported target SHALL be exported as an explicit named ref constant
- **AND** the module SHALL NOT expose a reusable `makeInternalQueryRef(name)`, `makeInternalMutationRef(name)`, or `makeInternalActionRef(name)` style selector helper

### Requirement: Accepted dynamic backend exceptions MUST stay explicitly inventoried

The system MUST record any intentionally dynamic backend Convex dispatch as an explicit accepted exception with a narrow scope instead of leaving it as an ambiguous unfinished migration.

#### Scenario: Backend file intentionally dispatches by caller-supplied function name

- **WHEN** a backend path cannot use fixed typed refs because the function target is intentionally selected at runtime
- **THEN** the file SHALL be documented as an approved exception with its allowed scope
- **AND** anti-regression guardrails SHALL prevent the same dynamic pattern from spreading to additional covered runtime files
