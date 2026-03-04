## Context

The repo expects shared quality gates, but script contracts differ across packages. Inconsistent script names and deprecated commands make CI behavior less predictable and reduce confidence that baseline quality checks are executed uniformly.

## Goals / Non-Goals

**Goals:**
- Define a consistent script contract for core packages.
- Remove deprecated or broken lint/test command paths.
- Ensure CI runs stable, deterministic quality gates.
- Preserve existing developer command ergonomics via root aliases.

**Non-Goals:**
- Introducing new lint rule sets in this change.
- Rewriting test frameworks or replacing CI provider.

## Decisions

### 1) Standard script contract per package

Decision:
- Require `lint`, `typecheck`, and `test` scripts in target packages with consistent semantics.

Rationale:
- Enables reliable root-level orchestration and selective package checks.

Alternatives considered:
- Allow package-specific script naming. Rejected due to ongoing orchestration friction.

### 2) Use explicit ESLint CLI for Next.js package

Decision:
- Replace deprecated `next lint` script usage with direct ESLint command for web package linting.

Rationale:
- Avoids deprecated behavior and clarifies lint scope/config control.

Alternatives considered:
- Keep deprecated command until future cleanup. Rejected because migration is straightforward now.

### 3) Harden root/CI quality command integrity

Decision:
- Fix broken root script entries and align CI steps with standardized package scripts.

Rationale:
- Prevents false confidence from silently broken commands.

Alternatives considered:
- Keep ad-hoc CI command variants. Rejected due to drift risk.

## Risks / Trade-offs

- [Risk] Script changes may break local developer shortcuts.
  - Mitigation: preserve root aliases and document changed commands.
- [Risk] CI runtime may increase with stricter gates.
  - Mitigation: prefer targeted filters where possible and retain broad nightly/full gates.

## Migration Plan

1. Define standardized scripts in target package manifests.
2. Update root scripts to call standardized package commands.
3. Update CI workflow references to new scripts.
4. Run lint/type/test checks to verify command integrity.
5. Update docs with canonical commands.

Rollback:
- Restore previous script definitions and CI step mappings if breakage is discovered.

## Open Questions

- Should we enforce script contract conformance with a dedicated CI guard script?
- Which additional packages should join the standardized contract in a follow-up?
