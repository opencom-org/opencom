## ADDED Requirements

### Requirement: Widget shell MUST maintain stable hook invocation order

The widget shell MUST evaluate hooks unconditionally and MUST NOT declare hooks inside branches that may be skipped by error or guard returns.

#### Scenario: Workspace validation fails

- **WHEN** widget workspace validation resolves to an error state
- **THEN** the widget SHALL render the error surface without violating React hook ordering
- **AND** lint and runtime hook checks SHALL remain clean

#### Scenario: Origin validation fails

- **WHEN** origin validation rejects rendering for the current host
- **THEN** the widget SHALL short-circuit rendering safely
- **AND** all hooks SHALL still have been declared in deterministic order

### Requirement: Widget shell MUST separate orchestration concerns into explicit modules

The widget shell SHALL organize core orchestration logic into domain-focused modules with clear input/output contracts rather than one monolithic component body.

#### Scenario: Contributor updates blocking arbitration only

- **WHEN** a contributor changes blocking-priority behavior
- **THEN** the change SHALL be confined to the blocking orchestration module
- **AND** unrelated navigation and tab-selection modules SHALL not require modification

#### Scenario: Contributor updates validation behavior only

- **WHEN** workspace or origin validation behavior changes
- **THEN** the change SHALL be implemented through the validation module contract
- **AND** message list, survey, and tab modules SHALL remain unaffected

### Requirement: Widget orchestration refactor MUST preserve existing runtime behavior

The refactor SHALL preserve externally observable behavior for view transitions, blocker priority, and callback bridge registration.

#### Scenario: Multiple blocker candidates are available

- **WHEN** tour, outbound post, and large survey are simultaneously eligible
- **THEN** the widget SHALL continue applying priority as tour first, outbound second, survey third

#### Scenario: Callback bridge integration remains available

- **WHEN** the host page registers start-tour and available-tour callbacks
- **THEN** the widget SHALL continue invoking and updating these callbacks as before refactor
- **AND** callback lifecycle cleanup SHALL occur on unmount

#### Scenario: Active tab visibility changes after shell loads

- **WHEN** home/tab configuration or visitor audience rules hide the currently selected tab
- **THEN** the widget SHALL preserve current fallback behavior by selecting the first visible tab
- **AND** messages SHALL remain the default fallback when no configured tab is available
