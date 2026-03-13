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

## General Workflow Guardrails

- Start every non-trivial task by grounding in current repo state before changing files:
  1. identify the active scope
  2. read the relevant files/specs/tests
  3. verify whether the work is already partly done
  4. choose a narrow verification plan
- If working from an existing OpenSpec change, always read:
  - `openspec status --change "<change-name>" --json`
  - `openspec instructions apply --change "<change-name>" --json`
  - the current `proposal.md`, `design.md`, `specs/**/*.md`, and `tasks.md`
- Never assume unchecked boxes in `tasks.md` mean the code is still missing. Verify the current implementation first, then update artifacts or tasks to match reality.
- Before creating a new OpenSpec change, quickly check for overlapping active changes or existing specs so you do not create duplicates or split ownership accidentally.
- For multi-step work, keep an explicit plan/todo and update it as tasks complete. Prefer one active task at a time.
- When changing course mid-task, record the new scope and the reason in the active change artifacts if they are affected.
- Before marking work complete, verify both code and artifacts:
  - code/tests/typechecks reflect the final state
  - `tasks.md` checkboxes match what is actually done
  - any follow-up work is written down explicitly instead of left implicit

## Existing Proposal Discipline

- If you did not create the current proposal/change, treat the artifacts as hypotheses until verified against the codebase.
- Separate findings into three buckets before editing artifacts:
  - already implemented
  - still unfinished
  - intentionally out of scope or accepted exception
- Only put unfinished work into active proposal/spec/task artifacts.
- If code and artifacts disagree, prefer fixing the artifact first unless the user explicitly asked for implementation.
- When leaving partial progress, record exact remaining file clusters, blockers, and verification still needed so a later pass can continue without re-auditing the whole repo.

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

## Convex Hardening Audit Triage

- Before treating an audit item as open work, verify whether it is already implemented and only the guard/proposal text is stale.
- Default classification for current repo state:
  - `packages/sdk-core/src/api/*.ts` manual fixed refs are generally **approved TS2589 hotspots**, not automatic cleanup targets.
  - `packages/sdk-core/src/api/aiAgent.ts` already routes `getRelevantKnowledge` through `client.action(...)`; do not reopen the old query-path migration unless you find a current regression.
  - `packages/convex/convex/embeddings.ts` batching/backfill concurrency work is already in place; do not create new perf tasks for `generateBatch`, `backfillExisting`, or `generateBatchInternal` unless the current code regressed.
  - `packages/convex/convex/testAdmin.ts` is an explicit dynamic exception because it intentionally dispatches caller-selected internal test mutations.
- Treat these patterns differently:
  - **Remaining cleanup target:** generic `name: string` ref helpers such as `makeInternalQueryRef(name)` / `getQueryRef(name)` in covered runtime files.
  - **Usually acceptable hotspot:** fixed module-scope `makeFunctionReference("module:function")` constants with a narrow comment or guard-railed `TS2589` justification.
  - **Accepted exception:** intentionally dynamic dispatch that is security-constrained and documented (currently `testAdmin.ts`).
- When cleaning backend Convex boundaries, prefer this order:
  1. Generated `api` / `internal` refs
  2. Named shallow runner helper at the hot spot
  3. Fixed `makeFunctionReference("module:function")` constant
  4. Only if intentionally dynamic and documented, a narrow exception
- Do not add new generic helper factories to shared ref modules. If a module exists to share refs, export fixed named refs from it.

## Testing Best Practices

### Do

- Create isolated test data using helpers
- Clean up after tests
- Use descriptive test names
- Test both success and error cases
- Use `data-testid` attributes for E2E selectors
- Keep tests focused and independent

### Don't

- Share state between tests
- Rely on specific database IDs
- Skip cleanup in afterAll
- Hard-code timeouts (use Playwright's auto-wait)


## Code Style and Comments

### Comment Tags

Use these tags to highlight important information in code comments:

- `IMPORTANT:` - Critical information that must not be overlooked
- `NOTE:` - Helpful context or clarification
- `WARNING:` - Potential pitfalls or dangerous operations
- `TODO:` - Future work that should be done
- `FIXME:` - Known issues that need fixing

### Code Patterns

- Use `MUST` / `MUST NOT` for hard requirements
- Use `NEVER` / `ALWAYS` for absolute rules
- Use `AVOID` for anti-patterns to stay away from
- Use `DO NOT` for explicit prohibitions

### Example

```typescript
// IMPORTANT: This function must be called before any Convex operations
// NOTE: The widget uses Shadow DOM, so overlays must portal into the shadow root
// WARNING: Never fall back to wildcard "*" for CORS
// TODO: Add rate limiting to this endpoint
// FIXME: This cast should be removed after TS2589 is resolved
```

## Modularity Patterns

### Module Organization

- Separate orchestration from rendering
- Extract helper logic from page components
- Use explicit domain modules instead of co-locating all logic
- Preserve existing behavior when refactoring

### Key Principles

1. **Single Responsibility**: Each module should have one clear purpose
2. **Explicit Contracts**: Modules must expose typed internal contracts
3. **Preserve Semantics**: Refactoring must preserve existing behavior
4. **Shared Utilities**: Common logic should be extracted to shared modules

### Common Patterns

- **Controller/View Separation**: Separate orchestration from rendering
- **Domain Modules**: Group related functionality by domain
- **Adapter Pattern**: Use adapters for external dependencies
- **Wrapper Hooks**: Wrap external hooks with local adapters

## Error Handling Patterns

### Standard Error Functions

Use the standardized error functions from `packages/convex/convex/utils/errors.ts`:

- `throwNotFound(resourceType)` - Resource not found
- `throwNotAuthenticated()` - Authentication required
- `throwPermissionDenied(permission?)` - Permission denied

### Error Feedback

- Use standardized non-blocking error feedback for frontend paths
- Provide actionable user messaging
- Centralize unknown error mapping for covered paths

## Documentation Standards

### Source of Truth

- OpenSpec specs are the source of truth for requirements
- `docs/` contains reference documentation
- `AGENTS.md` contains AI agent guardrails
- Code comments provide inline guidance

### When to Update Docs

- When adding new features or changing behavior
- When fixing bugs that affect user-facing behavior
- When refactoring that changes module boundaries
- When adding new patterns or conventions

## Agent Handoff Notes

- When converting a repo audit into OpenSpec artifacts, put **only unfinished work** into `proposal.md`, spec deltas, and `tasks.md`.
- Explicitly call out already-finished adjacent work so a follow-up agent does not reopen it by mistake.
- For the current Convex hardening area, the default out-of-scope items are:
  - sdk-core `getRelevantKnowledge` action routing
  - embedding batching/backfill concurrency in `packages/convex/convex/embeddings.ts`
- If you change the covered hardening inventory or accepted exceptions, update the matching guard in the same change. Common files:
  - `packages/convex/tests/runtimeTypeHardeningGuard.test.ts`
  - `packages/sdk-core/tests/refHardeningGuard.test.ts`
- When leaving work half-finished, record the remaining file clusters explicitly in `openspec/changes/<change>/tasks.md` so the next agent can resume without re-auditing the repo.

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
