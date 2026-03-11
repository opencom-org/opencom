## ADDED Requirements
### Requirement: Widget survey and CSAT Playwright flows MUST wait for deterministic feedback readiness

Widget feedback E2E scenarios MUST NOT assert survey or CSAT visibility until the widget has established the visitor/session state and feedback-query inputs required to evaluate seeded eligible experiences.

#### Scenario: Immediate seeded survey waits for feedback readiness

- **WHEN** a widget survey Playwright scenario navigates to the widget demo route after seeding an eligible immediate survey
- **THEN** the test harness SHALL wait for the widget feedback path to become ready for eligibility evaluation
- **AND** the survey SHALL either render with actionable UI or fail with an explicit readiness-related error instead of a generic visibility timeout

#### Scenario: Seeded CSAT experience waits for feedback readiness

- **WHEN** a widget CSAT Playwright scenario navigates to the widget demo route after seeding an eligible CSAT experience
- **THEN** the test harness SHALL wait for the widget feedback path to become ready for eligibility evaluation
- **AND** the CSAT experience SHALL either render with actionable UI or fail with an explicit readiness-related error instead of a generic visibility timeout

### Requirement: Widget feedback E2E fixtures MUST isolate visitor suppression state across unrelated tests

Widget survey and CSAT E2E coverage MUST use deterministic per-test visitor/session isolation unless a scenario explicitly verifies frequency or completion suppression behavior.

#### Scenario: Consecutive immediate survey tests do not share suppression state

- **WHEN** two unrelated survey Playwright tests seed eligible immediate feedback experiences in separate test runs
- **THEN** the later test SHALL NOT inherit prior impression, completion, or `once` suppression from the earlier test
- **AND** any intentional suppression behavior SHALL be validated only in scenarios that explicitly reuse the same seeded identity

#### Scenario: Frequency-control coverage intentionally reuses identity

- **WHEN** a survey or CSAT frequency-control scenario intentionally revisits the same seeded visitor identity
- **THEN** the test SHALL verify the expected suppression or re-display rule
- **AND** that identity reuse SHALL remain scoped to the scenario that asserts the rule
