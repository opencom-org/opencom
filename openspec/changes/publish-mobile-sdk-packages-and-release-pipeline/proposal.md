## Why

The React Native SDK package is still marked `private` and depends on workspace-only packages, while docs already instruct external installation via `@opencom/react-native-sdk`. There is no release pipeline for SDK packages and npm registry lookups currently return not found, so install guidance is not actionable.
The same planning gap applies to other potential externally consumed packages (for example shared SDK modules and framework adapters such as Next.js): we do not yet have a portfolio-wide publish policy, release governance model, or explicit backend compatibility contract strategy.

## What Changes

- Define a portfolio-wide package classification model:
  - which packages are public/installable from npm,
  - which remain internal/private,
  - and publish ordering/dependency rules across public packages.
- Define and implement a publishable package graph for all approved public consumer packages (including mobile SDK and framework-facing packages where sensible) with resolvable transitive dependencies.
- Remove workspace-only dependency blockers from publishable packages (or publish required internal dependencies).
- Define release governance for public package delivery:
  - git strategy for releases (default trunk/tag release, with scoped maintenance branches only when needed),
  - semantic versioning and npm dist-tag policy for backwards compatibility,
  - support windows and deprecation policy for older major lines.
- Define Convex backend contract versioning and compatibility guarantees for published packages that depend on backend-generated APIs/contracts.
- Create a versioned release pipeline that builds, verifies, and publishes changed public package artifacts under this governance model.
- Update installation docs and release runbook to match actual package distribution and compatibility process across supported consumer surfaces.

## Capabilities

### New Capabilities

- `public-package-portfolio-distribution`: Approved public packages are publishable/installable from configured registries with resolvable dependencies.
- `public-package-release-governance`: Public package releases follow explicit branching/tagging, SemVer, dist-tag, and support-window policies.
- `public-package-convex-compatibility`: Published packages that rely on Convex contracts declare and validate backend compatibility ranges.

### Modified Capabilities

- None.

## Impact

- Package manifests across selected public packages (`private`, versioning strategy, `publishConfig`, files/exports, dependency versions).
- CI/workflow automation for changed-package detection, ordered publish, and compatibility gates.
- Release governance docs for branching, tagging, npm dist-tags, support windows, and deprecation timelines.
- Convex compatibility contract metadata and validation rules used by release checks.
- Installation docs and release runbook for mobile and other supported consumer package entry points.
