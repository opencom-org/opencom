## Why

The repo already treats runtime code, scripts, and workflows as the source of truth, but documentation still drifts from those contracts. One live example is that `docs/testing.md` describes a CI sequence that no longer matches `.github/workflows/ci.yml`, and today there is no automated scan that detects that mismatch, compares it with prior scans, or proposes a docs fix.

## What Changes

- Add a GitHub Actions-based repo scan workflow that snapshots selected repo contracts from code and automation, then compares the current scan against the previous trusted scan.
- Add structured doc-drift detection that maps mismatches back to canonical sources such as workflow files, package scripts, and source-of-truth docs.
- Add a trusted remediation workflow that, when drift is found on eligible branches, creates or updates a docs-only branch, applies documentation fixes, validates them, and opens or updates a pull request back into the originating branch.
- Persist machine-readable scan baselines and human-readable run artifacts so drift findings are attributable across runs instead of being ephemeral CI logs.
- Define automation guardrails for least-privilege tokens, pinned actions, writable path allowlists, and fork/untrusted-PR behavior.

## Capabilities

### New Capabilities

- `ci-repo-scan-baseline-delta-reporting`: Deterministic repo scans produce a persisted baseline, a current snapshot, and a delta report for maintainers and automation.
- `ci-doc-drift-remediation-prs`: Trusted automation can turn scan findings into validated docs-only pull requests against eligible branches.

### Modified Capabilities

- None.

## Impact

- GitHub Actions workflows under `.github/workflows/`
- New repo scan and drift-detection scripts under `scripts/`
- Machine-readable scan manifests and run artifacts under `artifacts/` or a dedicated automation state location
- Source-of-truth and contributor docs under `docs/**`, `README.md`, and related maintainer-facing docs
- Repository automation credentials and permissions for GitHub App or token-based PR creation
