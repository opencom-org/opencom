# Setup, Self-Host, and Deployment Guide

This guide is the canonical OSS setup and deployment reference for Opencom.

## Prerequisites

- Node.js 18+
- PNPM 9+
- Convex account

## Fastest Setup Path

Use the repo bootstrap script. This is the preferred path for new users:

```bash
./scripts/setup.sh
```

The script now:

- runs `pnpm install`
- configures or reuses the local Convex dev deployment with the current `convex dev --once` flow
- validates the local password-auth bootstrap env contract and generates `JWT_PRIVATE_KEY`/`JWKS` when needed
- signs up or signs in through the repo's real `auth:signIn` password flow
- resolves an existing workspace by default, with explicit opt-in workspace creation on reruns
- updates the supported local `.env.local` files non-destructively
- optionally offers to start the web/widget dev servers at the end

Update generated env files later with:

```bash
./scripts/update-env.sh --url https://<your-deployment>.convex.cloud --workspace <workspace-id>
```

Helpful rerun flags:

```bash
./scripts/setup.sh --reconfigure
./scripts/setup.sh --create-workspace --workspace "My New Workspace"
./scripts/setup.sh --non-interactive --email admin@example.com --password 'Opencom!123' --skip-dev
```

## Manual Setup (step-by-step)

Use this only when debugging or when you need to control each step yourself.
The one-command setup above also handles admin/workspace bootstrap; this manual path requires you to resolve a real workspace ID before running `update-env.sh`.

```bash
pnpm install
pnpm --filter @opencom/convex exec convex dev --once
pnpm --filter @opencom/convex exec convex auth add
./scripts/update-env.sh --url https://<your-deployment>.convex.cloud --workspace <workspace-id>
pnpm dev:web
pnpm dev:widget
```

Recommended optional app entrypoints:

```bash
pnpm dev:landing
pnpm dev:mobile
```

## Deployment Profiles

### 1) Hosted apps + custom Convex backend

- Deploy Convex backend (`packages/convex`) to your own project.
- Configure web/mobile to connect via backend URL selection.

### 2) Self-hosted web + custom Convex backend

- Build web app:

```bash
pnpm build:web
pnpm --filter @opencom/web start
```

- Set `NEXT_PUBLIC_OPENCOM_DEFAULT_BACKEND_URL` in the deployment environment.

### 3) Full self-host (apps + backend)

- Backend: deploy `packages/convex`
- Web/landing/widget/mobile: deploy each app according to your platform requirements
- For widget local distribution into web/landing public assets:

```bash
bash scripts/build-widget-for-tests.sh
```

### 4) Widget CDN publishing (optional)

For a Cloudflare R2-backed widget distribution flow:

```bash
DRY_RUN=1 bash scripts/deploy-widget-cdn.sh
pnpm deploy:widget:cdn
```

`pnpm deploy:widget:cdn` reads `.env.local` at repo root and runs `scripts/deploy-widget-cdn.sh`.
By default, each deploy publishes a unique immutable runtime key (`v/<packageVersion>-<sha>[-<run_id>]/widget.js`), and release tags `widget-v*` publish clean semver keys.

## Environment Variables

### Convex backend (`packages/convex`)

| Variable                                            | Required                                    | Purpose                                                                                                                   |
| --------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `JWT_PRIVATE_KEY`                                   | Yes for local password-auth bootstrap       | Private key used by Convex Auth to sign session JWTs; setup generates this with the matching `JWKS` when needed           |
| `JWKS`                                              | Yes for local password-auth bootstrap       | Public key set matching `JWT_PRIVATE_KEY`, exposed by Convex Auth for JWT verification                                    |
| `SITE_URL`                                          | Recommended local default                   | Convex dashboard env key used for callback/link generation; bootstrap defaults it to `http://localhost:3000` when missing |
| `CONVEX_SITE_URL`                                   | Convex-managed                              | Convex site URL used as the auth issuer and JWKS endpoint                                                                 |
| `AUTH_RESEND_KEY`                                   | Optional                                    | OTP provider API key override (falls back to `RESEND_API_KEY`)                                                            |
| `RESEND_API_KEY`                                    | Optional (required for email features)      | Transactional/campaign email sending                                                                                      |
| `EMAIL_FROM`                                        | Optional                                    | Sender identity for auth and email channel flows                                                                          |
| `RESEND_WEBHOOK_SECRET`                             | Recommended                                 | Verifies inbound Resend webhook signatures                                                                                |
| `EMAIL_WEBHOOK_INTERNAL_SECRET`                     | Recommended                                 | Internal webhook gateway secret for email handlers                                                                        |
| `ENFORCE_WEBHOOK_SIGNATURES`                        | Optional (`true` default)                   | Fail-closed webhook enforcement toggle                                                                                    |
| `WEBHOOK_MAX_AGE_SECONDS`                           | Optional                                    | Replay-window bound for webhook signatures                                                                                |
| `OPENCOM_PUBLIC_CORS_ORIGINS`                       | Required for production web origins         | Allowlist for `/.well-known/opencom.json` CORS                                                                            |
| `AI_GATEWAY_API_KEY`                                | Optional (required for AI agent generation) | AI provider credential                                                                                                    |
| `AI_GATEWAY_BASE_URL`                               | Optional                                    | AI provider base URL override                                                                                             |
| `OPENCOM_ENABLE_SERIES_ORCHESTRATION`               | Optional (`true` default)                   | Runtime guard for series orchestration                                                                                    |
| `OPENCOM_DEMO_BLOCKED_EMAIL_CAMPAIGN_WORKSPACE_IDS` | Optional                                    | Comma-separated workspace IDs where outbound campaign sends are blocked                                                   |
| `ALLOW_TEST_DATA`                                   | Test-only                                   | Enables internal test-data mutations                                                                                      |
| `TEST_ADMIN_SECRET`                                 | Test-only                                   | Secret for `testAdmin:runTestMutation` gateway                                                                            |

### Web app (`apps/web`)

| Variable                                  | Required | Purpose                                           |
| ----------------------------------------- | -------- | ------------------------------------------------- |
| `NEXT_PUBLIC_OPENCOM_DEFAULT_BACKEND_URL` | Optional | Default backend shown/auto-selected for app users |
| `NEXT_PUBLIC_CONVEX_URL`                  | Optional | Used by widget-demo/e2e helper flows              |
| `NEXT_PUBLIC_TEST_WORKSPACE_ID`           | Optional | Default workspace for the local widget demo page  |
| `E2E_BACKEND_URL`                         | Optional | Backend override used by Playwright helper flows  |
| `NEXT_PUBLIC_WIDGET_URL`                  | Optional | Widget bundle URL override for demo flows         |

### Mobile app (`apps/mobile`)

| Variable                                  | Required | Purpose                                         |
| ----------------------------------------- | -------- | ----------------------------------------------- |
| `EXPO_PUBLIC_OPENCOM_DEFAULT_BACKEND_URL` | Optional | Default backend URL for mobile admin app        |
| `EXPO_PUBLIC_CONVEX_URL`                  | Optional | Direct Convex URL used by local admin flows     |
| `EXPO_PUBLIC_WORKSPACE_ID`                | Optional | Default workspace for local mobile auth/testing |

### Landing app (`apps/landing`)

| Variable                          | Required | Purpose                                                                                                                            |
| --------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_WIDGET_URL`          | Optional | Widget loader URL override (landing defaults: local dev `/opencom-widget.iife.js`, production `https://cdn.opencom.dev/widget.js`) |
| `NEXT_PUBLIC_OPENCOM_WEB_APP_URL` | Optional | Hosted app URL used in CTA links                                                                                                   |
| `NEXT_PUBLIC_CONVEX_URL`          | Optional | Convex URL for widget demo initialization                                                                                          |
| `NEXT_PUBLIC_WORKSPACE_ID`        | Optional | Workspace for landing demo widget init                                                                                             |

### Widget app (`apps/widget`)

| Variable            | Required                           | Purpose                          |
| ------------------- | ---------------------------------- | -------------------------------- |
| `VITE_CONVEX_URL`   | Required for local widget dev mode | Convex URL used by dev bootstrap |
| `VITE_WORKSPACE_ID` | Required for local widget dev mode | Workspace for dev bootstrap      |

### React Native SDK example (`packages/react-native-sdk/example`)

| Variable                   | Required              | Purpose            |
| -------------------------- | --------------------- | ------------------ |
| `EXPO_PUBLIC_CONVEX_URL`   | Yes (for example app) | Convex backend URL |
| `EXPO_PUBLIC_WORKSPACE_ID` | Yes (for example app) | Workspace ID       |

### Local bootstrap-managed files

`./scripts/setup.sh` and `./scripts/update-env.sh` manage only the Opencom-owned keys in:

- `apps/web/.env.local`
- `apps/widget/.env.local`
- `apps/mobile/.env.local`
- `apps/landing/.env.local`
- `packages/react-native-sdk/example/.env.local`
- `packages/convex/.env.local`

Unrelated keys and comments outside those managed keys are preserved on rerun.

## CI/E2E-specific Variables

| Variable            | Purpose                                                |
| ------------------- | ------------------------------------------------------ |
| `E2E_BACKEND_URL`   | Backend target for Playwright E2E helper layer         |
| `E2E_TEST_PASSWORD` | Password used by E2E auth bootstrap                    |
| `TEST_ADMIN_SECRET` | Required for E2E test data seeding and cleanup helpers |

## Common Setup Failures

1. **CORS fails for `/.well-known/opencom.json` in hosted environments**
   - Set `OPENCOM_PUBLIC_CORS_ORIGINS` on Convex to include production web origins.
2. **E2E seeding fails with unauthorized errors**
   - Ensure Convex deployment has matching `TEST_ADMIN_SECRET` and `ALLOW_TEST_DATA=true` in test environments.
3. **OTP email flow unavailable**
   - Configure `AUTH_RESEND_KEY` or `RESEND_API_KEY` plus `EMAIL_FROM`.

## Disposable Container Smoke Path

When you want to sanity-check the real setup flow against a clean machine state, run it in a disposable container and use a throwaway Convex dev deployment:

```bash
docker run --rm -it \
  -v "$PWD":/workspace \
  -w /workspace \
  node:20-bookworm bash
```

Inside the container:

```bash
corepack enable
corepack prepare pnpm@9 --activate
./scripts/setup.sh --skip-dev
```

Notes:

- The Convex login/project-selection flow is still interactive inside the container.
- Use a temporary or disposable Convex project when smoke testing this path.
- When you exit the container, the machine-local login/session state is discarded.

## Related Docs

- Testing + validation: [`./testing-and-verification.md`](./testing-and-verification.md)
- Security + release gate operations: [`./security-and-operations.md`](./security-and-operations.md)
- Source-of-truth ownership: [`./source-of-truth.md`](./source-of-truth.md)
