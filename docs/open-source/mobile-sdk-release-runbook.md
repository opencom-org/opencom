# Mobile SDK Package Release Runbook

This runbook governs public npm package releases for the first mobile SDK cohort.

## Branching and Tagging Policy

- Standard release path: cut release from `main` and publish from release tag.
- Standard tag format: `sdk-v<semver>` (examples: `sdk-v1.0.0`, `sdk-v1.1.0-next.1`).
- Long-lived release branch is not required.
- Backports to older supported lines may use scoped maintenance branches:
  - `release/<major>.<minor>` (example: `release/1.2`).

## SemVer and npm Dist-tag Policy

- Stable releases (`sdk-vX.Y.Z`) publish to `latest`.
- Prereleases (`sdk-vX.Y.Z-<pre>`) publish to `next`.
- Breaking changes MUST use a new major version.
- Non-breaking changes MUST remain within the current major version.
- First cohort uses lockstep versioning:
  - `@opencom/convex`, `@opencom/sdk-core`, and `@opencom/react-native-sdk` share one release version.

## Support Window and Deprecation Policy

- Support at least current major and previous major for critical fixes.
- Critical-fix support window for previous major: 180 days.
- Deprecation notice lead time: at least 60 days before end-of-support.
- Publish migration guidance before major cutover.
- If rollback is required, repoint `latest`/`next` to last-known-good versions.

## CI Release Pipeline

Workflow: `.github/workflows/publish-mobile-sdk-packages.yml`

Pipeline stages:

1. Detect changed first-cohort packages (`scripts/release/compute-release-plan.js`).
2. Validate governance + package metadata (`scripts/release/validate-release-governance.js`).
3. Validate Convex compatibility matrix (`scripts/release/validate-convex-compatibility.js`).
4. Run package build/type/test checks.
5. Pack tarballs and run clean consumer smoke installs (`scripts/release/run-smoke-installs.js`).
6. Publish affected packages in dependency-safe order (`scripts/release/publish-packages.js`).

## Maintainer Commands

Run from repository root:

```bash
pnpm release:plan -- --base <base-ref> --head <head-ref>
pnpm release:validate -- --base <base-ref> --head <head-ref> --tag sdk-vX.Y.Z
pnpm release:validate:convex-compat
pnpm release:smoke -- --pack-dir artifacts/release-tarballs
pnpm release:publish -- --base <base-ref> --head <head-ref> --tag sdk-vX.Y.Z --dry-run
```
