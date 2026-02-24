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
