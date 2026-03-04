## Context

Current docs and package state are inconsistent: docs claim npm installation while package metadata and dependency graph are not publish-ready. Without a release pipeline, versioning and distribution remain manual and error-prone.
The current change was mobile-centric, but release concerns are portfolio-wide: we need one coherent strategy for all externally consumed packages (mobile SDK plus other framework-facing/shared packages where sensible), including branching, SemVer support policy, and backend compatibility governance.

## Goals / Non-Goals

**Goals:**
- Define a portfolio-wide model for which packages are public vs internal.
- Make all approved public packages installable from supported registries.
- Ensure transitive dependencies are resolvable outside the monorepo.
- Automate multi-package version/build/test/publish flow.
- Define release governance (branching, tags, channels, support windows, deprecations).
- Protect existing npm consumers through explicit backward-compatibility policy.
- Define Convex backend contract versioning and compatibility checks for published packages that rely on backend contracts.
- Align docs with real distribution and installation paths across supported consumer surfaces.

**Non-Goals:**
- Publishing every monorepo package by default.
- Redesigning SDK public APIs as part of release-process work.

## Decisions

### 1) Define a public package portfolio and ownership model

Decision:
- Maintain an explicit portfolio inventory that classifies packages as:
  - public-supported (intended for external npm consumers),
  - public-experimental (opt-in prerelease channel),
  - internal-only (private).
- Only portfolio-approved public packages are included in publish automation.

Rationale:
- Prevents accidental publication of internal packages and makes support commitments explicit.

Alternatives considered:
- Keep ad-hoc per-package publication decisions. Rejected because it causes drift and unclear ownership.

### 2) Enforce dependency boundaries for publishable packages

Decision:
- Public packages MUST NOT rely on unresolved `workspace:*` dependencies at publish time.
- Public package manifests MUST declare registry-resolvable dependencies, stable exports, and explicit publish surface (`files`, `exports`, peer dependency ranges).
- Where a public package depends on shared internal logic, that logic must be moved into publishable shared packages or removed from public runtime paths.

Rationale:
- External consumers need deterministic installs without monorepo internals.

Alternatives considered:
- Publish only top-level packages while leaving workspace-only transitives. Rejected because installs break.

### 3) Use automated multi-package versioning and publish orchestration

Decision:
- Implement release automation that:
  - detects changed public packages,
  - includes affected dependent public packages when required,
  - versions and publishes in dependency-safe order,
  - records changelog/release notes per published package.

Rationale:
- Keeps multi-package releases consistent and reduces manual sequencing errors.

Alternatives considered:
- Manual publish commands per package. Rejected due to repeatability and auditability concerns.

### 4) Release from `main` by tag; avoid a permanent release branch

Decision:
- Use trunk-based releases: cut public package releases from `main` using semver tags.
- Do not require a long-lived `release` branch.
- Allow short-lived `release/x.y` branches only for backport/hotfix cases for older supported lines.

Rationale:
- Matches existing production deployment practices and minimizes branch drift.

Alternatives considered:
- Always release from a long-lived `release` branch. Rejected due to overhead and delayed fixes.

### 5) Enforce npm backward compatibility via SemVer + dist-tags + support windows

Decision:
- Adopt strict SemVer for all public packages:
  - patch/minor releases MUST remain backwards-compatible within a major line,
  - breaking changes REQUIRE a major bump.
- Use dist-tags intentionally:
  - `latest` for stable releases,
  - `next` (or equivalent) for prerelease/experimental channels.
- Define support policy:
  - maintain at least current and previous major lines for critical fixes for a documented window,
  - publish migration notes before and during major cutovers.

Rationale:
- Protects slower-moving consumers while enabling safe iteration.

Alternatives considered:
- Single rolling `latest` with no support policy. Rejected due to upgrade risk.

### 6) Version Convex compatibility explicitly across public packages

Decision:
- Treat package-to-Convex compatibility as a first-class contract:
  - define backend contract/version metadata discoverable by consumers,
  - define per-package supported backend contract range,
  - add release-time validation against minimum and current supported backend contract versions.
- For breaking backend contract changes impacting public packages:
  - ship compatibility adapters when feasible within current major lines, or
  - coordinate major package releases with migration guidance.

Rationale:
- Prevents silent runtime breakage when consumer app/package version and backend deployment version are skewed.

Alternatives considered:
- Implicit compatibility with no explicit contract range. Rejected because failures are late and hard to debug.

### 7) Add portfolio-aware publish smoke validation

Decision:
- Add smoke checks that install and minimally execute published tarballs in clean consumer fixtures for each supported package type (for example React Native and Next.js where applicable).

Rationale:
- Catches missing files, invalid metadata, and framework-specific integration regressions before publish.

## Risks / Trade-offs

- [Risk] Wider scope increases implementation complexity and timeline.
  - Mitigation: phase rollout by package cohort with explicit acceptance gates.
- [Risk] Package boundary refactors may disrupt local monorepo workflows.
  - Mitigation: validate both workspace development path and published-consumer path in CI.
- [Risk] Registry auth/provenance misconfiguration blocks release.
  - Mitigation: staged dry-run workflow and explicit secret checks.
- [Risk] Breaking changes may leak into minor/patch releases.
  - Mitigation: SemVer policy checks and compatibility test gates.
- [Risk] Public package versions may drift from backend capability assumptions.
  - Mitigation: explicit backend contract ranges and release matrix validation.

## Migration Plan

1. Inventory candidate public packages and classify each (supported, experimental, internal).
2. Define dependency boundary changes needed for publishability.
3. Update package manifests and dependency graph for approved public packages.
4. Define release governance policy (branching, tags, SemVer, dist-tags, support windows).
5. Define Convex compatibility metadata and per-package contract-range rules.
6. Implement multi-package release automation with dependency-aware publish ordering.
7. Add smoke/integration compatibility validation across relevant consumer fixtures.
8. Run dry-run releases, then stage initial public package cohort rollout.
9. Update docs/runbooks with package matrix, install paths, support, and migration guidance.

Rollback:
- Suspend publish workflow for failing package cohorts while keeping unaffected cohorts disabled from release triggers.
- Repoint dist-tags to last known-good versions and pause new publishes until compatibility gates pass.

## Open Questions

- Which additional framework-facing packages (for example Next.js integration) are in the first public-supported cohort?
- Should npm be primary with GitHub Packages fallback, or dual-publish from day one?
- Should Convex-generated contracts be exposed via a dedicated public contract package, or via stable facades in each consumer package?
- Do we require signed provenance attestations for initial public releases or after first stable cohort?
