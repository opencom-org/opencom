## 1. Migration Domain And Integration Foundations

- [ ] 1.1 Add migration persistence models for drafts, readiness reports, runs, checkpoints, and run events.
- [ ] 1.2 Implement Intercom source client/auth handling with pagination, rate-limit backoff, and scoped data fetch APIs.
- [ ] 1.3 Implement normalization/mapping primitives for supported v1 domains (contacts, companies, conversations, help center content).

## 2. Wizard Setup Flow

- [ ] 2.1 Implement migration wizard state machine and server-backed draft persistence/resume behavior.
- [ ] 2.2 Build wizard UI steps for source connection, scope selection, required mapping, and review.
- [ ] 2.3 Enforce step-level validation gates so import cannot start until required setup fields are valid.

## 3. Readiness Reporting

- [ ] 3.1 Implement preflight rule engine with deterministic `blocking` and `warning` severity outputs.
- [ ] 3.2 Implement unsupported Intercom feature detection with per-feature fallback guidance in readiness output.
- [ ] 3.3 Add readiness acknowledgement flow that blocks import on unresolved errors and requires warning acknowledgement.

## 4. Job Execution, Tracking, And Recovery

- [ ] 4.1 Implement asynchronous migration job runner with lifecycle states and domain-level progress counters.
- [ ] 4.2 Implement checkpointed resume + retry with idempotency protections to prevent duplicate imports.
- [ ] 4.3 Implement structured failure/error buckets with remediation hints and sample record references.

## 5. Completion Experience And Guardrails

- [ ] 5.1 Implement completion summary view with imported/skipped/failed counts by selected domain.
- [ ] 5.2 Implement post-migration verification checklist and persist sign-off metadata for auditability.
- [ ] 5.3 Gate migration run actions behind workspace feature flag and admin-only authorization checks.

## 6. Verification

- [ ] 6.1 Add unit tests for setup-step gating, scope/mapping invalidation, and preflight severity classification.
- [ ] 6.2 Add integration tests for checkpoint resume, retry behavior, and duplicate-import prevention.
- [ ] 6.3 Run focused package checks (typecheck/tests for touched packages) and strict `openspec validate add-intercom-migration-wizard --strict --no-interactive`.
