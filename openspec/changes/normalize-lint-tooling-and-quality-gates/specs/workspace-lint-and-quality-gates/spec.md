## ADDED Requirements

### Requirement: Target workspace packages MUST expose a consistent quality script contract

Core workspace packages covered by this change SHALL expose `lint`, `typecheck`, and `test` scripts with predictable behavior.

#### Scenario: Contributor runs package quality checks

- **WHEN** a contributor runs `pnpm --filter <package> lint`, `typecheck`, and `test`
- **THEN** each command SHALL exist and execute the package's intended quality gate

### Requirement: Root quality commands MUST execute without script-level errors

Root script aliases used for quality gates MUST resolve to valid commands and MUST NOT contain broken invocations.

#### Scenario: Root production E2E command is executed

- **WHEN** the root production E2E command is run
- **THEN** the command SHALL resolve to a valid pnpm invocation
- **AND** it SHALL start the expected test workflow rather than failing from command typos

### Requirement: CI quality workflow MUST enforce standardized lint/type checks

CI quality workflow steps SHALL call standardized package/root scripts so lint/type regressions are consistently caught.

#### Scenario: Lint regression is introduced in covered package

- **WHEN** CI runs for a change that includes a lint regression
- **THEN** the quality workflow SHALL fail on the standardized lint step
