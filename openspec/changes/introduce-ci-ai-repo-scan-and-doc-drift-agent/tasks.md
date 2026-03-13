## 1. Repo Scan Manifest And Baseline Plumbing

- [ ] 1.1 Define the repo scan manifest and delta-report schemas for scripts, workflows, env vars, and curated docs claims.
- [ ] 1.2 Implement deterministic scan scripts that collect canonical repo contract data and emit machine-readable artifacts.
- [ ] 1.3 Implement baseline load and promotion logic against the chosen automation state location for trusted default-branch scans.

## 2. Read-Only Scan Workflow

- [ ] 2.1 Add the GitHub Actions workflow or reusable workflow entrypoints for `pull_request`, default-branch `push`, `schedule`, and `workflow_dispatch`.
- [ ] 2.2 Publish workflow summaries and artifacts for current scans, delta reports, and structured doc-drift findings.
- [ ] 2.3 Enforce restricted-context behavior so forked or otherwise untrusted scans remain read-only and do not attempt remediation or baseline promotion.
- [ ] 2.4 Add concurrency or dedupe controls so superseded scans do not race on the same branch.

## 3. Trusted Doc-Remediation Workflow

- [ ] 3.1 Add the privileged remediation workflow handoff from trusted scan results with explicit branch-eligibility checks.
- [ ] 3.2 Integrate the selected coding-agent runner behind a bounded prompt contract that only includes targeted findings, canonical source references, and writable doc paths.
- [ ] 3.3 Enforce the documentation allowlist and fail remediation if non-doc files are modified or if no valid doc patch is produced.
- [ ] 3.4 Rerun targeted drift verification after remediation and only proceed when the targeted findings are resolved.
- [ ] 3.5 Create or update remediation pull requests back to the originating branch using the repo-approved bot token strategy.

## 4. Documentation, Rollout, And Verification

- [ ] 4.1 Update maintainer-facing docs to describe the new repo scan workflow, baseline model, and doc-remediation flow.
- [ ] 4.2 Dry-run the workflow against the known CI-doc drift between `docs/testing.md` and `.github/workflows/ci.yml`.
- [ ] 4.3 Verify same-repo branch remediation behavior and forked-PR read-only behavior before enabling automatic remediation broadly.
- [ ] 4.4 Run `openspec validate introduce-ci-ai-repo-scan-and-doc-drift-agent --strict --no-interactive`.
