# AGENTS

## Non-negotiables

- Use **PNPM** commands in this repo (workspace uses `pnpm-workspace.yaml`).
- Always run new/updated tests after creating or changing them.
- Prefer focused verification first (targeted package/spec), then broader checks when needed.

## Quick Repo Orientation

- Monorepo root: `opencom`
- Main apps: `apps/web`, `apps/landing`, `apps/mobile`, `apps/widget`
- Backend: `packages/convex`
- OpenSpec source of truth: `openspec/changes/<change-name>/`

## High-Value Commands (copy/paste)

### Typecheck

- Convex only:
  - `pnpm --filter @opencom/convex typecheck`
- Web only:
  - `pnpm --filter @opencom/web typecheck`
- Whole workspace:
  - `pnpm typecheck`

### Convex TypeScript deep-instantiation workaround

- Canonical guide: `docs/convex-type-safety-playbook.md`
- If Convex typecheck hits `TS2589` (`Type instantiation is excessively deep and possibly infinite`) at generated refs like `api.foo.bar` or `internal.foo.bar`, prefer a **local escape hatch** instead of broad weakening.
- First keep call signatures shallow at the hot spot:
  - cast `ctx.scheduler.runAfter`, `ctx.runQuery`, or `ctx.runMutation` to a local shallow function type.
- If merely referencing `api...` / `internal...` still triggers `TS2589`, use `makeFunctionReference("module:function")` from `convex/server` at that call site instead of property access on generated refs.
- Keep this workaround **localized only to pathological sites**. Continue using generated `api` / `internal` refs normally elsewhere.
- Expect hidden follow-on errors: rerun `pnpm --filter @opencom/convex typecheck` after each small batch of fixes, because resolving one deep-instantiation site can reveal additional ones.

## Convex Type Safety Standards

- Read `docs/convex-type-safety-playbook.md` before adding new Convex boundaries.
- Frontend runtime/UI modules must not import `convex/react` directly. Use local adapters and wrapper hooks instead.
- Keep Convex refs at module scope. Never create `makeFunctionReference(...)` values inside React components or hooks.
- Do not add new `getQueryRef(name: string)`, `getMutationRef(name: string)`, or `getActionRef(name: string)` factories.
- Backend cross-function calls should use generated `api` / `internal` refs by default. Only move to fixed `makeFunctionReference("module:function")` refs after a real `TS2589` hotspot is confirmed.
- Keep unavoidable casts localized to adapters or named backend hotspot helpers. Do not spread `as unknown as`, `unsafeApi`, or `unsafeInternal` through runtime code.
- After changing a boundary, update the relevant hardening guard:
  - `packages/convex/tests/runtimeTypeHardeningGuard.test.ts`
  - `apps/web/src/app/typeHardeningGuard.test.ts`
  - `apps/widget/src/test/refHardeningGuard.test.ts`
  - `packages/react-native-sdk/tests/hookBoundaryGuard.test.ts`

### Tests

- Convex targeted file:
  - `pnpm --filter @opencom/convex test -- --run tests/<file>.test.ts`
- Convex full package tests:
  - `pnpm --filter @opencom/convex test`
- Web unit tests:
  - `pnpm --filter @opencom/web test`
- Web E2E (single file):
  - `pnpm playwright test apps/web/e2e/<spec>.ts --project=chromium`

### E2E prep that is often required

- Build/distribute widget before web E2E runs:
  - `bash scripts/build-widget-for-tests.sh`
- If Convex-backed tests need env values loaded in shell:
  - `bash -lc 'set -a; source packages/convex/.env.local; set +a; <your command>'`

## OpenSpec Workflow Cheatsheet

### Check change status

- `openspec status --change "<change-name>" --json`

### Get apply context + progress

- `openspec instructions apply --change "<change-name>" --json`

### Validate before marking done

- `openspec validate <change-name> --strict --no-interactive`

### Important artifact dependency rule (spec-driven schema)

- `tasks.md` can stay **blocked** until both `design.md` and `specs/**/*.md` are ready.
- If status shows:
  - `tasks: blocked`
  - `missingDeps: ["design", "specs"]`
    this is expected; finish design/spec artifacts first.

## Recommended Finish Checklist for Changes

1. Implement scoped code changes.
2. Run package-level typecheck(s).
3. Run targeted tests for touched area.
4. Run strict OpenSpec validation.
5. Update `openspec/changes/<change>/tasks.md` checkboxes.
6. Sync tracker in `openspec/proposal-execution-plan.md` when proposal status changes.

## Skills / Slash Commands to Prefer

- `/opsx-apply` — implement tasks for a change
- `/opsx-continue` — advance artifact workflow
- `/opsx-verify` — verify implementation vs artifacts
- `/opsx-archive` — archive completed change

Use these when working within OpenSpec-driven requests to reduce setup time in fresh chats.

Warning: Running scripts inline causes the terminal to hang and crash. Create files and run them that way. Avoid running commmands like `... node - <<"NODE ..."` or `python3 - <<'PY' ...`
