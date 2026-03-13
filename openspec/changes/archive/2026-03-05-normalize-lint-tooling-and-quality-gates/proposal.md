## Why

Lint and quality gates are inconsistent across the workspace. `apps/web` still uses deprecated `next lint`, `packages/convex` lacks a lint script, and root `test:e2e:prod` currently has a broken `pn` command typo, allowing avoidable quality regressions.

## What Changes

- Normalize package-level quality scripts (`lint`, `typecheck`, `test`) across critical workspace packages.
- Replace deprecated `next lint` usage with explicit ESLint CLI invocation in web package scripts.
- Add missing Convex lint wiring and fix broken root quality command definitions.
- Update CI quality checks to consistently run and fail on lint/type regressions.

## Capabilities

### New Capabilities

- `workspace-lint-and-quality-gates`: Workspace packages expose consistent quality scripts and root/CI gates run reliably.

### Modified Capabilities

- None.

## Impact

- Root and package `package.json` scripts (`apps/web`, `packages/convex`, and root).
- CI workflow steps for lint/type/test gates.
- Contributor workflow documentation for standardized quality commands.
