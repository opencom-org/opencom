## ADDED Requirements
### Requirement: Widget feedback blocking and arbitration MUST NOT starve eligible survey or CSAT display without an active blocker

The widget shell MUST only defer eligible survey or CSAT presentation when a higher-priority blocking experience is actually active or when an explicit readiness contract has not yet been satisfied.

#### Scenario: Eligible small survey has no active blocking experience

- **WHEN** the widget has selected an eligible non-blocking survey candidate and no higher-priority blocking experience is active
- **THEN** the widget SHALL present the survey without waiting on unrelated pending blocker bookkeeping
- **AND** the survey SHALL become observable to the E2E harness once feedback readiness is satisfied

#### Scenario: Higher-priority blocker is active

- **WHEN** a higher-priority blocking experience such as a tour, outbound post, or large survey is actively presented
- **THEN** the widget MAY defer lower-priority survey or CSAT display until the active blocker exits
- **AND** the deferred feedback experience SHALL become eligible for presentation again after the blocker is released
