## 1. Public Package Portfolio Definition

- [x] 1.1 Create portfolio inventory for candidate packages (public-supported, public-experimental, internal-only).
- [x] 1.2 Define package ownership and support commitments for each public-supported package.
- [x] 1.3 Decide first rollout cohort (mobile SDK plus other framework-facing/shared packages where sensible).

## 2. Publishability And Dependency Boundary Planning

- [x] 2.1 Define dependency resolution strategy for each public package in the first cohort.
- [x] 2.2 Identify and remove/replace workspace-only dependencies from publishable runtime paths.
- [x] 2.3 Define publish order/topology for interdependent public packages.

## 3. Package Metadata Updates

- [x] 3.1 Update package manifests (`private`, versioning strategy, `publishConfig`, files/exports, peer dependency ranges) for publish-ready packages.
- [x] 3.2 Ensure transitive dependency versions are registry-resolvable.
- [x] 3.3 Add package-level metadata for support tier and release channel eligibility where required.

## 4. Release Governance Definition

- [x] 4.1 Define git release policy (default tag-from-`main`, with `release/x.y` maintenance branches only for backports).
- [x] 4.2 Define SemVer rules, npm dist-tag usage (`latest` vs `next`), and support window for older major lines.
- [x] 4.3 Define deprecation and end-of-support policy for older package lines.

## 5. Convex Compatibility Governance

- [x] 5.1 Define Convex compatibility contract/versioning policy for public packages that depend on backend contracts.
- [x] 5.2 Define compatibility range metadata format and where it is surfaced (release artifacts/runtime metadata).
- [x] 5.3 Define migration playbook for backend contract breaking changes (adapter vs coordinated major release).

## 6. Release Automation

- [x] 6.1 Implement CI workflow for changed-package detection, versioning, build/type/test checks, and publish.
- [x] 6.2 Implement dependency-safe multi-package publish ordering.
- [x] 6.3 Add dry-run and consumer smoke-install validation before publish steps.
- [x] 6.4 Add compatibility gates for SemVer policy and npm channel/tag correctness.
- [x] 6.5 Add Convex compatibility validation (minimum/current supported contract matrix) in release checks.

## 7. Documentation And Validation

- [x] 7.1 Update package installation docs and release runbook to match final portfolio distribution paths.
- [x] 7.2 Publish package matrix documentation (scope, support tier, channels, and support windows).
- [x] 7.3 Document Convex compatibility/versioning guidance and migration workflows.
- [x] 7.4 Validate installation in clean consumer fixtures for each package type in the first cohort.
