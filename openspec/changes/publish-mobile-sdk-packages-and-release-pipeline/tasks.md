## 1. Public Package Portfolio Definition

- [ ] 1.1 Create portfolio inventory for candidate packages (public-supported, public-experimental, internal-only).
- [ ] 1.2 Define package ownership and support commitments for each public-supported package.
- [ ] 1.3 Decide first rollout cohort (mobile SDK plus other framework-facing/shared packages where sensible).

## 2. Publishability And Dependency Boundary Planning

- [ ] 2.1 Define dependency resolution strategy for each public package in the first cohort.
- [ ] 2.2 Identify and remove/replace workspace-only dependencies from publishable runtime paths.
- [ ] 2.3 Define publish order/topology for interdependent public packages.

## 3. Package Metadata Updates

- [ ] 3.1 Update package manifests (`private`, versioning strategy, `publishConfig`, files/exports, peer dependency ranges) for publish-ready packages.
- [ ] 3.2 Ensure transitive dependency versions are registry-resolvable.
- [ ] 3.3 Add package-level metadata for support tier and release channel eligibility where required.

## 4. Release Governance Definition

- [ ] 4.1 Define git release policy (default tag-from-`main`, with `release/x.y` maintenance branches only for backports).
- [ ] 4.2 Define SemVer rules, npm dist-tag usage (`latest` vs `next`), and support window for older major lines.
- [ ] 4.3 Define deprecation and end-of-support policy for older package lines.

## 5. Convex Compatibility Governance

- [ ] 5.1 Define Convex compatibility contract/versioning policy for public packages that depend on backend contracts.
- [ ] 5.2 Define compatibility range metadata format and where it is surfaced (release artifacts/runtime metadata).
- [ ] 5.3 Define migration playbook for backend contract breaking changes (adapter vs coordinated major release).

## 6. Release Automation

- [ ] 6.1 Implement CI workflow for changed-package detection, versioning, build/type/test checks, and publish.
- [ ] 6.2 Implement dependency-safe multi-package publish ordering.
- [ ] 6.3 Add dry-run and consumer smoke-install validation before publish steps.
- [ ] 6.4 Add compatibility gates for SemVer policy and npm channel/tag correctness.
- [ ] 6.5 Add Convex compatibility validation (minimum/current supported contract matrix) in release checks.

## 7. Documentation And Validation

- [ ] 7.1 Update package installation docs and release runbook to match final portfolio distribution paths.
- [ ] 7.2 Publish package matrix documentation (scope, support tier, channels, and support windows).
- [ ] 7.3 Document Convex compatibility/versioning guidance and migration workflows.
- [ ] 7.4 Validate installation in clean consumer fixtures for each package type in the first cohort.
