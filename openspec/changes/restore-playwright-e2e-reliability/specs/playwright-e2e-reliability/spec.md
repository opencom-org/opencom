# playwright-e2e-reliability Specification

## Purpose
Define the shared execution contract for protected Playwright suites so repo-managed E2E auth/bootstrap either restores a usable authenticated workspace context or fails explicitly instead of silently skipping coverage.

## Requirements
### Requirement: Protected Playwright suites MUST use a workspace-ready authenticated context

Shared Playwright auth/bootstrap helpers MUST NOT report success for protected suites unless the current page has recovered from auth routing and restored active workspace state required by protected admin and widget flows.

#### Scenario: Existing session auto-recovers from the auth probe

- **WHEN** a Playwright page visits the auth probe route and the app redirects back to an authenticated route using an existing session
- **THEN** the shared auth helper SHALL wait for the route to settle
- **AND** it SHALL verify active workspace state is available before reporting success

#### Scenario: In-page password login completes

- **WHEN** the shared auth helper performs password login in the current page context
- **THEN** it SHALL verify the login left auth routing
- **AND** it SHALL verify active workspace state is restored before persisting storage state and reporting success

### Requirement: Recoverable auth/bootstrap failures MUST remain visible to protected suites

Playwright suites that rely on repo-managed worker provisioning and auth recovery MUST fail explicitly when shared auth/bootstrap cannot recover, rather than converting that failure into a generic runtime skip.

#### Scenario: Widget suite setup cannot authenticate the page

- **WHEN** widget E2E suite setup invokes shared auth recovery and it returns failure
- **THEN** the suite SHALL fail its setup expectations
- **AND** the resulting Playwright output SHALL indicate an actionable failure instead of a skip

#### Scenario: Admin suite setup cannot authenticate the page

- **WHEN** another protected admin suite invokes shared auth recovery and it returns failure
- **THEN** the suite SHALL fail explicitly
- **AND** the failure SHALL remain attributable to shared auth/bootstrap rather than disappearing from coverage

### Requirement: Explicit prerequisite skips MUST remain narrowly scoped

Playwright suites MAY still skip when a declared external prerequisite required for the scenario is unavailable, but these skips MUST remain distinguishable from shared auth/bootstrap failures.

#### Scenario: Admin-seeding secret is unavailable

- **WHEN** a suite requires `TEST_ADMIN_SECRET` for test-only seeding or cleanup and the secret is not configured
- **THEN** the suite MAY skip those scenarios
- **AND** the skip reason SHALL identify the missing prerequisite rather than shared auth recovery
