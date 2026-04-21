## 1. Setup Bootstrap Architecture

- [x] 1.1 Replace the current Bash-only orchestration with a standalone Node bootstrap while preserving `./scripts/setup.sh` as the public entrypoint.
- [x] 1.2 Define a shared setup manifest for required core values, optional feature values, env defaults, and per-file local env mappings.
- [x] 1.3 Refactor `scripts/update-env.sh` to reuse the shared env propagation logic instead of duplicating key/file handling.

## 2. Convex Configuration And Auth Bootstrap

- [x] 2.1 Implement first-run and rerun handling around the current Convex CLI contract, including safe reuse or `--configure` reconfiguration of the dev deployment.
- [x] 2.2 Replace the stale auth bootstrap path with the repo's actual Convex Auth password signup/sign-in flow and workspace resolution logic.
- [x] 2.3 Validate and set the required backend auth env keys needed for local password-auth bootstrap, with actionable errors when values are missing or invalid.

## 3. Local Env Safety And User Guidance

- [x] 3.1 Add non-destructive managed env updates for all supported local env files, preserving unrelated manual keys/comments.
- [x] 3.2 Write and verify the required backend URL/workspace mappings across web, widget, mobile, landing, RN example, and local Convex shell/test env files.
- [x] 3.3 Improve setup output so each failure states what went wrong, why it matters, and the exact self-correction path.

## 4. Verification And Documentation

- [x] 4.1 Add deterministic automated tests for clean-environment, rerun/reuse, invalid-value, and env-merge scenarios using isolated temp homes plus stubbed Convex/auth dependencies.
- [x] 4.2 Document an opt-in disposable-container smoke path for exercising the real setup flow against a fresh local environment and real Convex login/project selection.
- [x] 4.3 Update `docs/open-source/setup-self-host-and-deploy.md`, relevant env examples, and any setup references that currently describe stale commands or env requirements.
- [x] 4.4 Run focused verification for the new setup tooling and `openspec validate foolproof-local-convex-setup --strict --no-interactive`.
