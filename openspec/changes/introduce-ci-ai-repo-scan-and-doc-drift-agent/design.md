## Context

The repo already encodes a documentation precedence model in `docs/open-source/source-of-truth.md`: runtime code, scripts, and workflow definitions outrank curated docs. In practice, however, drift still happens. A current example is that `docs/testing.md` still describes a CI sequence that does not match `.github/workflows/ci.yml`, which means reviewers currently have to detect contract drift manually.

This change adds new automation in a sensitive area:

- it spans GitHub Actions, repo scripts, documentation, and repository credentials
- it needs persistent state so a run can compare itself with a prior scan
- it needs a safe write path for opening remediation pull requests without turning pull request workflows into a privilege escalation path

The design therefore separates deterministic scanning from write-capable remediation and keeps the agent bounded by structured evidence rather than letting it freestyle over the whole repository.

## Goals / Non-Goals

**Goals:**

- Detect contract changes in workflows, package scripts, env var references, and curated docs using a deterministic repo scan.
- Compare the current scan with a previously trusted scan so maintainers see what materially changed between runs.
- Detect doc drift against the latest code and automation contracts.
- Allow trusted automation to create or update docs-only remediation branches and pull requests back into the originating branch.
- Preserve current GitHub Actions hygiene: pinned actions, least-privilege permissions, and explicit fork handling.
- Fit the existing repo workflow style instead of introducing a separate external orchestration system.

**Non-Goals:**

- Auto-fixing product code or non-documentation files.
- Replacing existing lint, typecheck, security, or test workflows.
- Using `pull_request_target` to build or execute untrusted pull request code.
- Solving every documentation-quality problem in the first iteration; the initial scope is contract drift, not editorial perfection.

## Decisions

### 1. Treat repo scan output as structured contract data, not a freeform AI review

Decision:

- Add a deterministic scan step that produces machine-readable manifests for:
  - root and package scripts,
  - GitHub workflow jobs and referenced commands,
  - documented env vars and secrets,
  - curated docs claims tied to source-of-truth contracts.
- Use the AI agent only after the deterministic scan has narrowed the mismatch set.

Rationale:

- This keeps findings reproducible, diffable, and auditable.
- It reduces token cost and keeps remediation prompts small.
- It gives maintainers a useful report even when agent execution is disabled.

Alternatives considered:

- Pure LLM repo review. Rejected because findings would be harder to diff across runs and easier to hallucinate.
- Pure regex linting with no agent. Rejected because remediation would remain manual and higher-friction.

### 2. Persist baseline state outside the main branch history

Decision:

- Persist the trusted baseline scan manifest in a dedicated automation state branch, for example `ci/ai-scan-state`.
- Upload per-run manifests and reports as workflow artifacts for debugging and audit.

Rationale:

- Workflow artifacts are good per-run evidence, but they are retention-bound and cross-run retrieval requires extra workflow metadata.
- Committing a new baseline file to `master` on every successful run would add noisy machine churn to the primary branch history.
- A dedicated state branch keeps the baseline versioned and fetchable by later runs without polluting product history.

Alternatives considered:

- Artifacts only. Rejected because retention windows make them a weak long-term source of truth.
- Baseline file on the default branch. Rejected due to commit noise and review overhead.

### 3. Split read-only scanning from privileged remediation

Decision:

- Run repo scanning in an unprivileged workflow path that can execute on `pull_request`, `push`, `schedule`, and `workflow_dispatch`.
- Run remediation in a privileged path only after scan completion and only for trusted contexts, using `workflow_run` or an equivalent explicit handoff.

Rationale:

- Pull request scans need to run broadly, including on restricted contexts where write tokens and secrets should not be exposed.
- Remediation needs write permissions and potentially a GitHub App token, so it must be isolated.
- This follows GitHub’s documented model where a `workflow_run`-triggered workflow can take privileged actions after an intentionally less-privileged precursor workflow.

Alternatives considered:

- Single workflow with write permissions on every event. Rejected because it expands blast radius.
- `pull_request_target` for end-to-end remediation. Rejected because GitHub explicitly warns against using it to build or run pull request code.

### 4. Reuse a common scan workflow across triggers

Decision:

- Put the core scan logic in a reusable workflow or shared script layer and call it from:
  - `pull_request` for branch comparison,
  - `push` to the default branch (`master` today) for baseline promotion,
  - `schedule` for periodic drift sweeps,
  - `workflow_dispatch` for manual investigation.
- Add concurrency controls so newer runs supersede stale runs on the same branch.

Rationale:

- The repo already relies on GitHub workflows, so reuse keeps the operational model familiar.
- Shared scan logic prevents trigger-specific divergence.
- Concurrency prevents multiple overlapping doc-remediation attempts from competing on the same branch.

Alternatives considered:

- Separate bespoke workflows per trigger with duplicated logic. Rejected because duplication would create automation drift.

### 5. Keep remediation file scope narrow and validate before opening a PR

Decision:

- Restrict automated edits to an explicit allowlist such as `docs/**`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, and other maintainer-facing docs approved for the first rollout.
- Require remediation to rerun the drift check and fail if:
  - remaining contract mismatches still exist for the targeted docs,
  - non-allowlisted files were modified,
  - the change set is empty.

Rationale:

- The agent should not be able to mutate application code while resolving documentation drift.
- Focused post-fix verification gives a deterministic pass/fail gate before PR creation.

Alternatives considered:

- Allow broad repo edits. Rejected as too risky for first release.
- Open PRs without rerunning drift verification. Rejected because it would create noisy, low-confidence PRs.

### 6. Prefer a GitHub App identity for privileged write actions

Decision:

- Use a GitHub App installation token for branch creation and pull request updates when repository policy allows it.
- Allow `GITHUB_TOKEN` as a fallback only if repo policy and branch protection rules make it sufficient.

Rationale:

- A GitHub App provides better auditability, narrower scoping, and more predictable bot behavior for automation-owned branches.
- It keeps long-lived personal tokens out of the design.

Alternatives considered:

- Personal access token. Rejected because it is harder to govern safely.
- `GITHUB_TOKEN` only. Rejected as the default because it may be too limited for some protected-branch or cross-workflow update flows.

### 7. Keep the agent provider pluggable behind the workflow contract

Decision:

- Design the workflow around a provider-neutral prompt contract and artifact handoff so the team can use one of several GitHub-compatible agent runners.
- Candidate runners include `openai/codex-action`, `anthropics/claude-code-action`, or another GitHub-compatible coding agent with equivalent sandbox and prompt controls.

Rationale:

- The workflow design should survive a provider swap.
- The critical repo contract is the scan artifact schema and remediation guardrails, not the specific LLM vendor.

Alternatives considered:

- Hard-code a single vendor in the design. Rejected because tool choice is still open.

### 8. Start with contract-focused drift classes

Decision:

- The first scanner version will cover high-signal, low-ambiguity drift classes:
  - documented command names vs actual package scripts,
  - docs vs workflow step/command contracts,
  - documented env vars/secrets vs code/workflow references,
  - canonical branch or path references in maintainer-facing docs.
- Optional prose tools such as Vale or textlint can run alongside the scan, but they are supportive quality gates, not the source-of-truth engine.
- Optional executable-doc tooling such as Doc Detective can be layered in later for scenario-based docs validation.

Rationale:

- These classes are directly derivable from the current repo and already produce actionable mismatches.
- They fit the existing source-of-truth contract and provide an immediate win without overpromising semantic documentation synthesis.

## Risks / Trade-offs

- [Risk] A too-strict scanner will produce noisy findings and low-value remediation PRs.
  - Mitigation: start with deterministic, high-confidence drift classes and require explicit allowlists/exceptions for tolerated mismatches.
- [Risk] Privileged remediation could become a security footgun if it executes untrusted code.
  - Mitigation: keep write-capable remediation in a separate trusted workflow path and treat pull request contents as data, not executable automation logic.
- [Risk] Baseline state could drift from the default branch if promotion rules are unclear.
  - Mitigation: define one promotion policy for trusted default-branch scans and include baseline metadata (`sha`, branch, timestamp, schema version) in the state manifest.
- [Risk] Repeated scans on active branches could create PR spam.
  - Mitigation: use concurrency, update-in-place PR behavior, and dedupe remediation by branch and finding fingerprint.
- [Risk] The agent may propose doc edits that technically remove drift but worsen clarity.
  - Mitigation: keep prompts evidence-bounded, keep edits docs-only, and preserve normal PR review before merge.

## Migration Plan

1. Define the scan manifest schema and implement deterministic collectors for scripts, workflows, env vars, and curated docs claims.
2. Add a read-only repo-scan workflow plus artifact publishing and summary output.
3. Add baseline promotion to the automation state branch for trusted default-branch runs.
4. Add privileged remediation workflow logic with branch trust checks, writable path allowlists, and PR creation/update behavior.
5. Run manual dry-runs against known drift, including the current `docs/testing.md` vs `.github/workflows/ci.yml` mismatch.
6. Enable scheduled scans and same-repo branch remediation once drift noise is acceptable.

Rollback:

- Disable the privileged remediation workflow and keep scan/report-only mode active.
- Leave the baseline branch intact so manual comparison remains available.
- Fall back to human-authored PRs using the generated drift reports if agent remediation proves noisy.

## Open Questions

- Should same-repo pull requests auto-run remediation immediately, or should remediation require a label/comment/manual dispatch in the first rollout?
- Which documentation roots belong in the initial writable allowlist beyond `docs/**` and the top-level maintainer docs?
- Should baseline promotion happen on every successful `master` push, or only on scheduled/manual runs after scan noise is reviewed?
- Which agent provider should be the first implementation target, given the repo’s existing secret-management and compliance preferences?
