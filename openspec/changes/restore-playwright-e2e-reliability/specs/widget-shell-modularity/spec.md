## ADDED Requirements
### Requirement: Widget Playwright coverage MUST execute under the shared E2E harness

Widget Playwright suites MUST rely on the repo's shared worker provisioning and authenticated recovery contract in a way that produces explicit execution outcomes instead of silently skipping coverage when shared auth/bootstrap regresses.

#### Scenario: Widget demo route depends on shared auth recovery

- **WHEN** a widget Playwright suite prepares the widget demo page through the shared auth/bootstrap helpers
- **THEN** the suite SHALL either reach the widget demo route with a workspace-ready authenticated context or fail explicitly during setup
- **AND** it SHALL NOT convert shared auth/bootstrap failure into a generic runtime skip
