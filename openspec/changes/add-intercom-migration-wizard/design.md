## Context

Opencom currently requires teams migrating from Intercom to assemble migration work manually across exports, field mapping, and verification. There is no single in-product flow that captures migration intent, validates readiness, executes long-running imports, and provides traceable completion evidence.

This change spans multiple surfaces:
- `apps/web` for wizard setup, readiness review, run monitoring, and completion summary.
- `packages/convex` for migration plan persistence, preflight analysis, and long-running import orchestration.
- Intercom integration adapters for source reads, pagination, and normalized entity mapping into Opencom models.

The most important constraints are reliability (no duplicate imports on retry), visibility (clear progress and errors), and safety (imports should not start when blocking issues exist).

## Goals / Non-Goals

**Goals:**
- Provide an end-to-end wizard for Intercom migration setup and execution.
- Make import readiness explicit via blocking error and warning classification.
- Run imports as resumable jobs with observable progress and actionable failure logs.
- Provide a completion summary and verification checklist before production cutover.

**Non-Goals:**
- Achieving full parity for every Intercom object type in the first release.
- Building continuous bidirectional sync between Intercom and Opencom.
- Migrating unrelated operational concerns (for example billing history or external BI datasets).

## Decisions

### 1) Split migration into plan phase and run phase

Decision:
- Persist a migration plan draft before execution, then create an immutable run record when import starts.

Rationale:
- Separating setup from execution allows preflight validation and approval without starting side effects.
- Immutable run records make retries and audit trails clearer.

Alternatives considered:
- Single write-once "start migration now" endpoint: rejected because it conflates setup errors with run-time failures and weakens resume behavior.

### 2) Implement preflight as a deterministic rule engine with severity levels

Decision:
- Preflight evaluates selected scope and mappings using explicit validation rules and emits findings classified as `blocking` or `warning`.

Rationale:
- Deterministic severity output gives predictable operator behavior and straightforward testability.
- Severity-based gating maps directly to UX controls (disable start vs allow with acknowledgement).

Alternatives considered:
- Best-effort import with no preflight gate: rejected because late failures increase migration risk and support load.

### 3) Execute imports with checkpointed, idempotent workers

Decision:
- Import jobs process each selected domain in bounded batches, persisting checkpoints and idempotency keys for each batch.

Rationale:
- Checkpoints enable resume after interruption without replaying successful work.
- Batch-level idempotency prevents duplicate entities when retries overlap with partial completion.

Alternatives considered:
- One-shot synchronous import request: rejected due to timeout risk, poor observability, and no practical recovery path.

### 4) Store structured run events and error buckets for operator debugging

Decision:
- Persist run events and domain-scoped error buckets (category, sample identifiers, reason, remediation hint) as first-class migration records.

Rationale:
- Structured data is easier to filter in UI and easier to aggregate for reliability improvements.
- Error bucket summaries reduce operator time compared with raw per-record logs only.

Alternatives considered:
- Raw log stream only: rejected because it is hard to interpret and hard to connect to remediation actions.

### 5) Gate initial release behind a feature flag and scoped access control

Decision:
- Ship behind a workspace feature flag and restrict migration run actions to admins.

Rationale:
- Controlled rollout lowers blast radius while we validate performance and mapping coverage.
- Admin-only run permissions reduce accidental imports during early adoption.

Alternatives considered:
- Immediate general availability: rejected because migration quality and support volume are still unknown in production workloads.

## Risks / Trade-offs

- [Risk] Intercom API rate limits can stretch migration duration.
  - Mitigation: adaptive backoff, domain-level batching, and user-visible ETA confidence bands.
- [Risk] Mapping mismatch can cause partial import quality issues.
  - Mitigation: strict blocking validations for required identities and explicit warning acknowledgement for lossy fields.
- [Risk] Resume logic complexity may introduce duplicate or skipped records.
  - Mitigation: checkpoint integrity tests, idempotency keys, and run-level reconciliation counters.
- [Risk] Large conversation/help-center datasets can generate noisy failure logs.
  - Mitigation: bucketized error summaries with downloadable detailed samples.

## Migration Plan

1. Add migration domain models and persistence primitives for drafts, preflight outputs, runs, checkpoints, and run events.
2. Implement Intercom source adapters and normalization pipeline for first-release supported domains.
3. Implement preflight rule engine and readiness-report API surface.
4. Implement migration job runner with checkpointing, retry, and idempotency protections.
5. Implement web wizard flow: setup, readiness review, run monitor, and completion checklist.
6. Enable internal testing with feature flag, run seeded test migrations, and tune retry/error UX.
7. Roll out to limited beta workspaces, monitor success/failure metrics, then expand availability.

Rollback strategy:
- Disable the migration feature flag for all workspaces.
- Stop new run creation while allowing existing in-flight runs to complete or be marked failed safely.
- Retain persisted run artifacts for audit and support-led recovery.

## Open Questions

- Which Intercom authentication mechanism should be primary for v1 (OAuth app install vs admin token input)?
- What maximum source dataset size should be supported before requiring staged imports by domain?
- Should completion checklist sign-off be stored as an auditable event with user identity and timestamp?
