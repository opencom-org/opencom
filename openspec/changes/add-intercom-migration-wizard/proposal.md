## Why

Teams switching from Intercom to Opencom still face high migration friction: they must manually export data, map fields, and validate what will or will not transfer before going live. That uncertainty slows down conversions and onboarding, so we need a guided migration path that makes switching predictable and low risk.

## What Changes

- Add an in-product Intercom migration wizard that guides teams from connection to import completion.
- Add a step-by-step flow for:
  - connecting an Intercom workspace,
  - selecting migration scope (for example contacts, companies, conversations, help center content),
  - mapping required fields and identities,
  - running a preflight check before import,
  - executing import with clear progress visibility.
- Add compatibility reporting that flags unsupported Intercom objects/features and provides explicit fallback guidance.
- Add resumable migration jobs with retry handling, import logs, and actionable error states.
- Add a post-migration verification checklist and completion summary so teams can confirm readiness before switching traffic.

## Capabilities

### New Capabilities

- `intercom-migration-wizard-flow`: Opencom provides a guided, multi-step wizard to connect Intercom and complete migration setup end to end.
- `intercom-migration-readiness-reporting`: Opencom provides preflight compatibility and validation output so teams know migration risk before import.
- `intercom-migration-job-tracking-and-recovery`: Opencom runs migration imports as observable, resumable jobs with progress, error details, and retry paths.

### Modified Capabilities

- None.

## Impact

- Web app onboarding/settings UI for migration setup, progress, and completion states.
- Backend migration services/jobs, import orchestration, and persistence for mapping/validation/run history.
- Integration layer for Intercom API access and data normalization into Opencom domain models.
- QA scope across happy path, partial failures, resume/retry behavior, and post-migration verification.
