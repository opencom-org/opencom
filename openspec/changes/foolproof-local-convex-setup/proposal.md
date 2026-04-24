## Why

The current OSS setup path is brittle for first-time contributors. It assumes outdated Convex CLI commands, uses an auth bootstrap path that does not match the repo's actual Convex Auth surface, rewrites `.env.local` files destructively, and only configures a narrow subset of the backend and local environment contract. In practice, that means new users can get stuck before they ever reach a usable backend, and rerunning the script can create duplicate projects or wipe unrelated local configuration.

The repo already contains the pieces needed for a smoother bootstrap, but they are disconnected:
- Convex CLI now expects project/team flags to be used with `--configure`, and no longer exposes the `whoami` command the script relies on.
- This repo's auth flow is powered by `auth:signIn` with `flow: "signUp"` over the Convex Auth HTTP surface, not `convex run auth:signup`.
- Local consumers read backend URL and workspace state from multiple app-specific `.env.local` files, but the current scripts overwrite those files instead of managing only the Opencom-owned keys.
- The documented backend env contract has drifted from the runtime reality, especially around Convex Auth bootstrap requirements such as JWT keys.

We need one reliable setup experience that works for:
- a user who has a Convex account but is not logged in locally
- a repo with no local Convex project configured yet
- a rerun against an existing project where the user wants to reuse the deployment instead of creating duplicates
- a contributor who makes a typo or misses a required value and needs actionable, self-correctable output

## What Changes

- Replace the current happy-path-only setup orchestration with a stateful, rerun-safe local bootstrap flow that can guide project configuration, backend env setup, workspace resolution, and local env propagation.
- Preserve the `./scripts/setup.sh` entrypoint, but move the complex orchestration into a Node-based implementation that can parse JSON, call HTTP auth endpoints, merge env files safely, and emit structured validation errors.
- Define a canonical setup manifest for required core values, optional feature flags/secrets, and per-app local env mappings.
- Validate the actual Convex/Auth contract instead of stale assumptions, including required auth bootstrap keys and the current CLI behavior.
- Add automated coverage for fresh-environment and rerun scenarios using isolated temporary homes plus a fake/stubbed Convex CLI harness, and document an opt-in real smoke path for disposable-container/manual verification.
- Update setup docs and env examples so the documented manual path, automated path, and repo scripts all describe the same contract.

## Capabilities

### New Capabilities

- `local-convex-setup-bootstrap`: The repository provides a rerun-safe local bootstrap flow that can configure or reuse a Convex project, validate backend auth requirements, resolve a workspace without duplicate creation by default, and write the required local env keys across supported app surfaces without destructive overwrite.

### Modified Capabilities

- None.

## Impact

- Setup scripts: `scripts/setup.sh`, `scripts/update-env.sh`, and new shared setup/bootstrap modules.
- Docs and templates: `docs/open-source/setup-self-host-and-deploy.md`, relevant `*.env.example` files, and any repo references that currently describe the stale setup contract.
- Verification: new focused tests for the setup flow and any fixtures/stubs needed to simulate Convex CLI/auth behavior in a clean environment.
- Contributor experience: first-run local setup, rerun/reconfigure behavior, and self-service debugging when setup validation fails.
