# Testing and Verification Guide

This is the canonical verification guide for contributors and maintainers.

## Validation Layers

Opencom validation is organized into three layers:

1. **Static checks**: lint + typecheck
2. **Package/runtime tests**: Vitest for package-level and Convex integration coverage
3. **E2E behavior**: Playwright for cross-surface workflows

## Baseline Commands (root)

Run from repository root:

```bash
pnpm lint
pnpm typecheck
pnpm test:convex
pnpm test:unit
pnpm test:e2e
```

Notes:

- `pnpm test` is an alias for `test:unit` then `test:e2e`.
- `pnpm test:ci` runs the same Vitest+Playwright stack in one command.

## Focused Package Checks

Use targeted checks first, then broaden as needed:

```bash
pnpm --filter @opencom/convex typecheck
pnpm --filter @opencom/convex test
pnpm --filter @opencom/convex test -- --run tests/<file>.test.ts

pnpm --filter @opencom/web typecheck
pnpm --filter @opencom/web test

pnpm --filter @opencom/widget typecheck
pnpm --filter @opencom/widget test

pnpm --filter @opencom/mobile typecheck
pnpm --filter @opencom/landing typecheck
```

## E2E Preparation Requirements

Before web E2E runs, build/distribute the widget bundle:

```bash
bash scripts/build-widget-for-tests.sh
```

If Convex-backed tests require local env loading in shell:

```bash
bash -lc 'set -a; source packages/convex/.env.local; set +a; pnpm --filter @opencom/convex test'
```

For targeted Chromium specs:

```bash
pnpm playwright test apps/web/e2e/<spec>.ts --project=chromium
```

### Parallel Worker Auth Contract

Authenticated Playwright suites are parallel-safe by design:

1. Each worker provisions or reuses one worker-local account/workspace
2. Worker state is keyed by `parallelIndex` and stored in worker-unique files
3. Auth refresh and persistence only touch the current worker's state files
4. Missing or malformed worker state fails setup explicitly (no shared fallback)

Implementation reference: `apps/web/e2e/fixtures.ts`.

## CI-Equivalent Verification Path

The canonical CI workflow is defined in `.github/workflows/ci.yml`:

- **checks job**: install, lint, typecheck, security gates, Convex tests, web build, dependency audit gate
- **e2e job**: Playwright suite with reliability report + reliability gate

To mirror CI locally where practical:

```bash
pnpm lint
pnpm typecheck
pnpm security:convex-auth-guard
pnpm security:convex-any-args-gate
pnpm security:secret-scan
pnpm security:headers-check
pnpm --filter @opencom/convex test
pnpm --filter @opencom/web build
pnpm web:test:e2e
```

## Reliability/Debug Utilities

- `pnpm test:summary` — summarize recent E2E run failures from `test-run-log.jsonl`
- `pnpm test:clear` — clear run-history log
- `pnpm test:e2e:prod` — run E2E against production build path

## Contributor Verification Checklist

- [ ] Run targeted package checks for touched area
- [ ] Run relevant tests for modified behavior

For release readiness integration, see [`./security-and-operations.md`](./security-and-operations.md).
