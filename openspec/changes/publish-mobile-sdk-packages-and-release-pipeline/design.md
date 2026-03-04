## Context

Current docs and package state are inconsistent: docs claim npm installation while package metadata and dependency graph are not publish-ready. Without a release pipeline, versioning and distribution remain manual and error-prone.

## Goals / Non-Goals

**Goals:**
- Make the mobile SDK installable from a supported registry.
- Ensure transitive dependencies are resolvable outside the monorepo.
- Automate build/test/version/publish release flow.
- Align docs with real distribution and installation paths.

**Non-Goals:**
- Publishing every monorepo package in this change.
- Redesigning SDK public API.

## Decisions

### 1) Define an explicit publishable package set and dependency policy

Decision:
- Publish the minimum required package set for external SDK consumption and eliminate unresolved `workspace:*` dependencies in published artifacts.

Rationale:
- External consumers must resolve all dependencies from registry-compatible versions.

Alternatives considered:
- Publish only the top-level package while keeping unresolved workspace dependencies. Rejected because installs fail.

### 2) Use automated versioning + publish workflow

Decision:
- Implement a release workflow that performs versioning, changelog generation, build/typecheck/tests, and registry publish in one controlled pipeline.

Rationale:
- Reduces manual release errors and keeps docs/versioning in sync.

Alternatives considered:
- Manual publish commands. Rejected due to repeatability and auditability concerns.

### 3) Add publish smoke validation

Decision:
- Add a smoke step that validates package tarball installability in a clean environment before publish.

Rationale:
- Catches missing files/invalid dependency metadata early.

## Risks / Trade-offs

- [Risk] Changing package metadata can impact monorepo local workflows.
  - Mitigation: keep internal development path unchanged; validate both workspace and published paths.
- [Risk] Registry auth/provenance misconfiguration blocks release.
  - Mitigation: add staged dry-run workflow and explicit secret checks.

## Migration Plan

1. Define publishable package matrix and dependency resolution strategy.
2. Update package manifests for publish readiness.
3. Implement release automation workflow and secrets/provenance configuration.
4. Run dry-run publish and smoke install in CI.
5. Update docs and release runbook with final install instructions.

Rollback:
- Disable publish workflow and revert package metadata changes if release validation fails.

## Open Questions

- Should npm be primary and GitHub Packages fallback, or vice versa?
- Do we require signed provenance attestations for initial public releases?
