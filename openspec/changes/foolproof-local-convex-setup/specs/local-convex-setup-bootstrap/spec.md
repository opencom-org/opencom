## ADDED Requirements

### Requirement: The repository MUST provide a rerun-safe local Convex setup bootstrap
The local setup entrypoint SHALL guide contributors through configuring or reusing a Convex development deployment without depending on stale CLI commands or silently creating duplicate projects by default.

#### Scenario: First-time contributor configures a new Convex project
- **GIVEN** a contributor has no local Convex project configured for this repo
- **WHEN** they run the repository setup bootstrap
- **THEN** the flow SHALL guide them through the current Convex CLI login/project configuration path
- **AND** the bootstrap SHALL verify that the resulting deployment metadata is available before continuing

#### Scenario: Contributor reruns setup with an existing local Convex configuration
- **GIVEN** the repo already has a usable local Convex deployment configured
- **WHEN** the contributor reruns the setup bootstrap
- **THEN** the flow SHALL offer to keep or reconfigure the existing deployment
- **AND** it SHALL default to reuse instead of silently creating a new project

### Requirement: The setup bootstrap MUST validate the backend auth bootstrap contract before workspace provisioning
The setup flow SHALL validate the backend environment values required for the repo's local auth bootstrap path and stop with actionable guidance when required auth configuration is missing or invalid.

#### Scenario: Required backend auth env is missing
- **WHEN** the setup bootstrap detects a required auth bootstrap env value is missing on the configured deployment
- **THEN** it SHALL name the missing key
- **AND** explain why that key is required for local auth/bootstrap
- **AND** either generate/set the value automatically or tell the contributor exactly how to provide it before retrying

#### Scenario: Backend auth bootstrap is misconfigured
- **WHEN** the setup bootstrap attempts password signup or sign-in against the configured deployment and the backend returns an auth configuration error
- **THEN** the setup output SHALL preserve the backend error context
- **AND** add repo-specific guidance that helps the contributor self-correct the misconfiguration

### Requirement: The setup bootstrap MUST resolve a valid workspace without duplicate creation by default
The setup flow SHALL derive the workspace used by local surfaces from authenticated backend state whenever possible, and SHALL prefer reuse of existing workspaces on rerun paths.

#### Scenario: Empty deployment needs a bootstrap workspace
- **GIVEN** the configured deployment has no existing users or workspaces
- **WHEN** the contributor completes the required bootstrap credential prompts
- **THEN** the setup flow SHALL create the bootstrap account/workspace through the repo's supported auth path
- **AND** capture the resulting workspace identifier for local env propagation

#### Scenario: Existing deployment already has users and workspaces
- **GIVEN** the configured deployment already contains users or workspaces
- **WHEN** the contributor reruns setup
- **THEN** the flow SHALL support signing in to an existing account and selecting an existing workspace for local env propagation
- **AND** it SHALL not create a new workspace unless the contributor explicitly asks for one

### Requirement: The setup bootstrap MUST update local env files non-destructively
The repository setup tooling SHALL write the Opencom-owned local env keys needed by supported app surfaces while preserving unrelated user-managed keys and comments.

#### Scenario: Setup writes app-specific backend envs
- **WHEN** the setup bootstrap has resolved a backend URL and workspace identifier
- **THEN** it SHALL write the required Opencom-owned keys to each supported local env file
- **AND** those keys SHALL be consistent across the web, widget, mobile, landing, RN example, and local shell/test surfaces that depend on them

#### Scenario: Existing env files already contain unrelated values
- **GIVEN** one or more local env files already exist with unrelated user-managed entries
- **WHEN** the setup bootstrap updates the Opencom-managed keys
- **THEN** it SHALL preserve the unrelated entries instead of overwriting the whole file

### Requirement: The repository MUST maintain automated verification for setup orchestration behavior
The setup tooling SHALL have deterministic automated coverage for its clean-environment, rerun, validation, and env-merge behavior, with a documented opt-in real smoke path for disposable-environment testing.

#### Scenario: Clean-environment orchestration is exercised under automation
- **WHEN** the setup test harness runs against an isolated temporary environment with stubbed Convex/auth dependencies
- **THEN** it SHALL verify first-run configuration, required env validation, workspace resolution, and local env propagation behavior deterministically

#### Scenario: Existing-env rerun behavior is exercised under automation
- **WHEN** the setup test harness runs against an environment that already has local env files and an existing configured deployment
- **THEN** it SHALL verify safe reuse/reconfigure branching and non-destructive env merging
- **AND** failures in those paths SHALL produce actionable diagnostic output
