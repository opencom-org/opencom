## Context

The current setup flow has four structural problems:

1. It depends on stale Convex CLI behavior.
   - `npx convex whoami` is no longer a valid command in the current CLI.
   - `--team`, `--project`, and `--dev-deployment` only work together with `convex dev --configure`, so the existing `convex dev --once --project ...` flow fails.
2. It uses the wrong auth bootstrap mechanism.
   - This repo exposes auth through Convex Auth HTTP routes.
   - Signup is performed via `auth:signIn` with `{ provider: "password", params: { flow: "signUp", ... } }`, not via `convex run auth:signup`.
3. It treats env files as disposable.
   - `scripts/setup.sh` and `scripts/update-env.sh` overwrite `apps/*/.env.local` and `packages/convex/.env.local` wholesale.
   - That risks deleting unrelated local values and makes reruns unsafe.
4. It does not model the setup contract explicitly.
   - Some backend env keys are essential to bootstrap auth.
   - Others are optional feature-specific values.
   - The current scripts and docs do not clearly separate those two categories or validate them with actionable explanations.

The result is a flow that works only for a narrow happy path and becomes harder to trust the moment a user has an existing project, existing envs, or a typo in one required value.

## Goals / Non-Goals

**Goals:**
- Make first-run local setup succeed for a contributor who starts with only Node, PNPM, and an existing Convex account.
- Let reruns reuse or reconfigure an existing Convex project instead of silently creating duplicates.
- Use the repo's real auth flow to create or reuse a bootstrap admin/workspace and derive a valid workspace ID automatically.
- Update all relevant local env files without deleting unrelated user-managed keys.
- Separate required core setup from optional feature add-ons and validate each with actionable messages.
- Add deterministic automated coverage for the setup orchestration in a clean environment.

**Non-Goals:**
- Automating hosted production deploys for web, landing, widget CDN, or mobile build pipelines.
- Turning local setup into a fully headless CI-only bootstrap for real Convex cloud accounts.
- Enabling every optional third-party integration by default.
- Replacing the manual setup path entirely; manual setup should remain documented, but aligned with the same contract.

## Decisions

### 1) Keep the shell entrypoint, move orchestration into a standalone Node bootstrap

Decision:
- Keep `./scripts/setup.sh` as the user-facing entrypoint for compatibility and simple prerequisite checks.
- Move the actual workflow into a Node script that uses built-in modules only, so it can run before dependency install finishes.
- Keep shared env merge/write logic in reusable setup modules so `setup` and `update-env` stop duplicating behavior.

Rationale:
- Bash is a poor fit for JSON parsing, HTTP auth calls, stateful prompts, env merging, and deterministic tests.
- A standalone Node script can use `fetch`, `crypto`, `child_process`, and `readline/promises` without introducing extra bootstrap dependencies.
- Preserving the shell entrypoint avoids breaking docs and contributor muscle memory.

Alternatives considered:
- Keep expanding the Bash script: rejected because the core failure modes are caused by Bash being hard to evolve safely here.
- Replace the entrypoint with a TypeScript/`tsx` script directly: rejected because it would depend on installed workspace packages before the script can even install them.

### 2) Use `packages/convex/.env.local` plus authenticated workspace lookup as the canonical source of backend state

Decision:
- Treat `packages/convex/.env.local` as the canonical local source for the configured deployment and backend URL after `convex dev --once`.
- Use authenticated backend queries, not manual free-form entry, to resolve the active workspace ID whenever possible.
- Fan out the resolved backend URL and workspace ID to app-specific env files through a shared mapping table.

Rationale:
- The Convex CLI already writes the authoritative deployment metadata to `packages/convex/.env.local`.
- Deriving workspace state from authenticated backend queries is safer than asking users to copy IDs from dashboards.
- A central mapping table prevents web, widget, mobile, landing, and RN example envs from drifting.

Alternatives considered:
- Make each app own its own setup independently: rejected because it repeats the same backend/workspace data in multiple places.
- Keep prompting users to paste workspace IDs manually: rejected because it is error-prone and does not help reruns against existing projects.

### 3) Model setup as profiles: required core setup first, optional feature setup second

Decision:
- Define a required core setup profile that blocks completion until the following are valid:
  - Convex project/deployment configuration is present
  - backend URL can be resolved from the configured deployment
  - required auth bootstrap env keys are set on the deployment
  - a valid workspace is resolved for local consumers
  - the required local env mappings are written successfully
- Treat email, AI, and test/demo conveniences as optional add-on profiles with explicit warnings instead of hard blockers.

Rationale:
- A contributor should be able to get a working local backend and app envs without already having Resend, AI provider keys, or production-origin settings.
- Optional features still need clear validation, but missing them should explain which features remain disabled rather than fail the entire bootstrap.

Implementation note:
- Based on the current repo and the current Convex Auth manual setup docs, the setup flow MUST validate the auth bootstrap keys actually required for this repo's password auth path. At minimum, this includes the JWT key material required by Convex Auth. `SITE_URL` should be treated as conditional: required when enabling OTP/email redirect flows, not when the user is only bootstrapping password auth locally.

Alternatives considered:
- Force every documented env key up front: rejected because it would make "minimal local setup" depend on unrelated integrations.
- Ignore optional features entirely: rejected because silent feature disablement is confusing and hard to debug later.

### 4) Reruns must reuse by default, and create-new only on explicit choice

Decision:
- On rerun, the setup flow should detect whether a Convex project is already configured locally and whether the target deployment already contains users/workspaces.
- The default path should be reuse:
  - keep the current configured deployment unless the user explicitly asks to reconfigure
  - if the deployment already has users, prompt the user to sign in as an existing admin and choose an existing workspace when possible
  - only create a new bootstrap account/workspace if the user explicitly chooses that path

Rationale:
- The current behavior risks duplicate projects and duplicate admin/workspace creation.
- Existing deployments are more common over time than pristine ones, so rerun safety must be a first-class path.

Alternatives considered:
- Always create a new project and user: rejected because it is wasteful and makes local state harder to reason about.
- Never create anything automatically: rejected because a first-time user still needs a path that gets them to a usable workspace without dashboard spelunking.

### 5) Manage env files with explicit Opencom-owned blocks instead of rewriting whole files

Decision:
- Introduce managed env blocks or key-level merge logic for all Opencom-owned local env files.
- Preserve unrelated user-managed keys and comments outside the managed region.
- Never replace `packages/convex/.env.local` wholesale; update only the keys this bootstrap owns and leave existing secrets/config intact.

Rationale:
- The current scripts can destroy user-managed values, which is especially dangerous in `packages/convex/.env.local`.
- Managed blocks make reruns predictable and keep the script idempotent.

Alternatives considered:
- Continue overwriting whole files: rejected because it is unsafe.
- Refuse to touch files that already exist: rejected because reruns still need a reliable update path.

### 6) Test the flow in layers: deterministic stubs first, disposable smoke second

Decision:
- Add deterministic automated tests around the setup state machine using:
  - temporary directories/home paths
  - stubbed Convex CLI responses
  - stubbed auth HTTP responses
  - fixture env files for merge/update assertions
- Add a documented opt-in smoke harness for running the bootstrap in a disposable container or similarly isolated environment with a real Convex account.

Rationale:
- A fully automated real-cloud test is not a good primary verification path because login and project selection are interactive and account-specific.
- The deterministic harness should own the branching logic, validation copy, and env merge behavior.
- A disposable-container/manual smoke pass is still useful to catch integration drift against the real CLI.

Alternatives considered:
- Only test by hand in Docker: rejected because it is too slow and too account-dependent to be the main safety net.
- Only use unit tests with no process-level stubs: rejected because the setup logic is mainly orchestration and file/process behavior.

## Proposed Flow

### Phase 1: Preflight

1. Validate `node` and `pnpm` presence/version.
2. Explain what the setup will do:
   - install dependencies
   - configure or reuse a Convex dev deployment
   - validate required backend auth envs
   - create or reuse a bootstrap admin/workspace
   - write local envs across supported apps
3. Run `pnpm install` from repo root.

### Phase 2: Convex project configuration

1. Inspect `packages/convex/.env.local`.
2. If no usable Convex config exists:
   - run `pnpm exec convex dev --once` in `packages/convex` with inherited stdio
   - let the CLI drive login plus new/existing project selection interactively
3. If config exists:
   - ask whether to keep it or reconfigure
   - on reconfigure, run `pnpm exec convex dev --once --configure`
4. After the command completes, parse `packages/convex/.env.local` and require:
   - `CONVEX_DEPLOYMENT`
   - `CONVEX_URL`
   - any other deployment metadata the downstream flow depends on

### Phase 3: Backend env validation/bootstrap

1. Build a setup manifest describing:
   - required core deployment envs
   - optional feature envs
   - how each value is generated, prompted, defaulted, or skipped
2. Validate core auth bootstrap envs against the actual current repo contract.
3. If required envs are missing:
   - generate values when appropriate, such as JWT key material
   - prompt the user when the value must come from them
   - set values on the Convex deployment via `convex env set`
4. Re-verify that the required envs are present before continuing.

### Phase 4: Workspace resolution

1. Query `setup:checkExistingSetup` on the configured deployment.
2. If the deployment is empty:
   - collect bootstrap admin credentials
   - call the Convex Auth HTTP action path for password signup
   - authenticate with the returned token
   - query the current user/workspace info and capture the workspace ID
3. If the deployment already has users:
   - prompt to sign in with an existing admin account
   - authenticate via the same HTTP auth surface
   - query current user/workspaces
   - let the user choose which existing workspace should populate local envs
4. Only offer "create a new bootstrap account/workspace" as an explicit opt-in when the deployment already has existing data.

### Phase 5: Local env propagation

1. Use a shared mapping table to write the required Opencom-owned keys into:
   - `apps/web/.env.local`
   - `apps/widget/.env.local`
   - `apps/mobile/.env.local`
   - `apps/landing/.env.local`
   - `packages/react-native-sdk/example/.env.local`
   - `packages/convex/.env.local` for the local keys this repo needs in shell scripts/tests
2. Use managed sections or key merge logic so unrelated keys survive reruns.
3. Re-read every file and confirm the expected values landed correctly.

### Phase 6: Post-setup validation and next steps

1. Print a summary of:
   - configured deployment
   - backend URL
   - chosen workspace
   - any optional features still disabled because their envs were skipped
2. Offer explicit next steps, such as:
   - start local web/widget/mobile dev
   - open the hosted app against the configured backend
   - rerun the setup in "reconfigure" mode

## Validation And Error Handling

The bootstrap output should be optimized for self-correction:

- Missing prerequisite:
  - explain the exact command/version issue and how to fix it
- Convex CLI configuration failure:
  - say whether the user needs to finish login, rerun with `--configure`, or inspect `packages/convex/.env.local`
- Missing required backend auth env:
  - name the key, explain why it matters, and say whether the script can generate it automatically
- Auth signup/sign-in failure:
  - preserve the backend error message
  - add repo-specific guidance, e.g. missing JWT setup versus invalid credentials
- Workspace resolution failure:
  - explain whether no workspace exists yet, auth failed, or the chosen workspace is no longer present
- Local env mismatch:
  - show which file/key failed validation and whether the script preserved a conflicting manual value

## Risks / Trade-offs

- [Risk] Introducing a Node bootstrap adds more code than the current shell script.
  - Mitigation: keep the flow modular, data-driven, and covered by deterministic orchestration tests.
- [Risk] The current docs may be materially wrong about required auth env keys.
  - Mitigation: align the setup manifest and docs to the verified current repo/runtime contract during this change.
- [Risk] Real Convex CLI behavior can drift again.
  - Mitigation: add a smoke harness plus targeted doc updates so CLI drift is easier to catch early.
- [Risk] Workspace reuse flows may be more interactive than the current script.
  - Mitigation: prefer safe defaults and clearer prompts over silent duplicate creation.

## Migration Plan

1. Create a shared setup manifest and Node orchestration layer.
2. Convert `scripts/setup.sh` into a thin wrapper around the new bootstrap.
3. Refactor `scripts/update-env.sh` to reuse the shared env propagation logic instead of duplicating it.
4. Align the bootstrap with the real Convex Auth signup/sign-in flow and backend env requirements.
5. Update docs and env examples to match the new contract.
6. Add deterministic setup tests and the opt-in disposable smoke instructions.

Rollback strategy:
- If the new bootstrap proves unstable, keep the shared env mapping/tests and temporarily fall back to a reduced shell entrypoint while retaining the non-destructive env merge behavior.

## Open Questions

- None. The core unknowns from the current flow are implementation details to verify during build-out, not product-level scope blockers.
