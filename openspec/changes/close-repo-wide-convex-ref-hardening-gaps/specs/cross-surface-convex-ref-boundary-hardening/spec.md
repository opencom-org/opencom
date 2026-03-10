## ADDED Requirements

### Requirement: Covered source modules MUST not use generic string-based Convex ref factories

Covered source files in `packages/convex`, `apps/web`, `apps/widget`, `packages/sdk-core`, and `packages/react-native-sdk` SHALL route Convex calls through fixed typed refs or typed boundary adapters, and SHALL not define generic helpers that accept arbitrary `name: string` to build refs.

#### Scenario: Covered module calls a Convex function

- **WHEN** a covered module needs a query, mutation, action, internal call, or scheduler target
- **THEN** the call site uses a fixed typed function reference or typed adapter API for the specific function
- **AND** the module does not expose `get*Ref(name: string)`, `getInternalRef(name: string)`, or `getApiRef(name: string)` helper patterns

### Requirement: Covered source modules MUST avoid broad `any`/`unknown` Convex ref signatures

Covered source files SHALL not declare ad hoc `makeFunctionReference<..., any|unknown, ...>` or equivalent broad boundary signatures when payload structure is known.

#### Scenario: Covered module declares Convex ref constants

- **WHEN** a covered module defines a Convex function reference
- **THEN** the args and return types are explicit domain shapes (or constrained shared types)
- **AND** broad `any`/`unknown` generics are not used except for documented, approved exceptions

### Requirement: Ref-name matching in covered tests MUST use shared canonical helpers

Covered test suites that route mock behavior by Convex function identity SHALL use shared helper utilities that normalize function path comparisons and rely on supported Convex APIs for real refs.

#### Scenario: Test routes mock behavior by function reference

- **WHEN** a covered test compares a Convex function ref path
- **THEN** it uses a shared helper such as `matchesFunctionPath(...)`
- **AND** dot-vs-colon fallback logic is centralized in that helper rather than repeated inline in each test file

### Requirement: Hardening rollout MUST be batch-gated by package verification

Cross-surface ref hardening SHALL expand package-by-package only after each package batch passes required typecheck and focused tests.

#### Scenario: Team completes a package hardening batch

- **WHEN** a package batch migration is marked complete
- **THEN** the package typecheck command for that package has passed
- **AND** targeted tests covering changed ref boundaries in that package have passed before the next batch begins

### Requirement: Covered domains MUST include anti-regression guardrails

Covered packages SHALL include guardrails that detect reintroduction of prohibited broad ref factory and untyped boundary patterns in covered paths.

#### Scenario: New code reintroduces broad ref pattern in covered path

- **WHEN** a change introduces a prohibited pattern in a covered path
- **THEN** a guard test or quality check fails in CI/local verification
- **AND** the failure message identifies the violating pattern and covered scope
