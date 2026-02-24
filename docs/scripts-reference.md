# Scripts Reference

All scripts live in the `scripts/` directory. Root-level `pnpm` commands are defined in the root `package.json`.

## Setup & Environment

### `setup.sh`

Interactive setup script for first-time Opencom installation.

```bash
./scripts/setup.sh
```

**What it does:**

1. Checks prerequisites (Node.js 18+, PNPM 9+)
2. Installs dependencies (`pnpm install`)
3. Creates a Convex project and deploys the backend
4. Prompts for admin email/password (or accepts via flags)
5. Creates workspace and admin account
6. Generates `.env.local` files for all apps
7. Optionally starts the dev server

**Flags:**

| Flag                    | Description                                           |
| ----------------------- | ----------------------------------------------------- |
| `--email <email>`       | Admin email address                                   |
| `--password <password>` | Admin password                                        |
| `--name <name>`         | Admin display name                                    |
| `--workspace <name>`    | Workspace name                                        |
| `--skip-dev`            | Skip starting dev server                              |
| `--non-interactive`     | Run without prompts (requires --email and --password) |

**Non-interactive example (CI):**

```bash
./scripts/setup.sh --email admin@example.com --password yourpassword --non-interactive --skip-dev
```

### `update-env.sh`

Regenerates `.env.local` files after setup or configuration changes.

```bash
./scripts/update-env.sh --url https://your-project.convex.cloud --workspace your_workspace_id
```

| Flag               | Description           |
| ------------------ | --------------------- |
| `--url <url>`      | Convex deployment URL |
| `--workspace <id>` | Workspace ID          |

## Build & Deploy

### `build-widget-for-tests.sh`

Builds the widget IIFE bundle and copies it to consuming apps' `public/` directories.

```bash
bash scripts/build-widget-for-tests.sh
```

**What it does:**

1. Runs `pnpm build` in `apps/widget/`
2. Copies `apps/widget/dist/opencom-widget.iife.js` to:
   - `apps/web/public/opencom-widget.iife.js`
   - `apps/landing/public/opencom-widget.iife.js`

**Required before:** Web E2E tests, local landing page widget demos.

**PNPM alias:** `pnpm build:widget`

### `deploy-widget-cdn.sh`

Deploys the widget bundle to Cloudflare R2 CDN with versioning and cache purge.

```bash
DRY_RUN=1 bash scripts/deploy-widget-cdn.sh   # Dry run
bash scripts/deploy-widget-cdn.sh              # Production deploy
```

**What it does:**

1. Resolves widget deploy version (`WIDGET_DEPLOY_VERSION` override, `widget-v*` tag, otherwise `packageVersion-<sha>` with CI `run_id` suffix)
2. Builds the widget IIFE bundle
3. Generates a `widget.js` loader from `scripts/widget-loader.js`
4. Creates a `manifest.json` with the latest deploy version
5. Uploads versioned bundle, loader, and manifest to R2
6. Purges Cloudflare CDN cache for updated URLs

**Environment variables:**

| Variable                | Default                   | Description                                               |
| ----------------------- | ------------------------- | --------------------------------------------------------- |
| `WIDGET_CDN_BUCKET`     | `opencom-static`          | R2 bucket name                                            |
| `WIDGET_CDN_BASE_URL`   | `https://cdn.opencom.dev` | CDN base URL                                              |
| `WIDGET_DEPLOY_VERSION` | (auto)                    | Optional explicit version key for `v/<version>/widget.js` |
| `DRY_RUN`               | `0`                       | Set to `1` to skip upload                                 |
| `CLOUDFLARE_ACCOUNT_ID` | (required)                | Cloudflare account ID                                     |
| `CLOUDFLARE_API_TOKEN`  | (required)                | Cloudflare API token (R2 Write + Cache Purge)             |
| `CLOUDFLARE_ZONE_ID`    | (required)                | Zone ID for cache purge                                   |

**PNPM alias:** `pnpm deploy:widget:cdn` (sources `.env.local` automatically)

**CI workflow:** `.github/workflows/deploy-widget.yml` — runs on push to `master` or `widget-v*` tags, supports manual `workflow_dispatch` with dry-run option.

### `widget-loader.js`

Loader script template embedded into the CDN `widget.js`. Implements a fallback mechanism:

1. Queues API calls (`init`, `identify`, `trackEvent`, etc.) while script loads
2. Captures auto-init config from `data-opencom-*` attributes or `window.opencomSettings`
3. Fetches `manifest.json` to resolve current widget version
4. Falls back to a hardcoded version if manifest fetch fails (3s timeout)
5. Loads the versioned IIFE bundle asynchronously

## Security Gates

These scripts run as CI checks and can be run locally. All exit with non-zero status on failure.

### `ci-convex-auth-guard.js`

Scans Convex backend files for raw query/mutation handlers that bypass the auth wrapper system.

```bash
pnpm security:convex-auth-guard
```

Validates that exported queries and mutations use the proper authentication wrappers. Known exceptions are tracked in `security/convex-raw-handler-registry.json`.

### `ci-convex-any-args-gate.js`

Detects `v.any()` usage in Convex function arguments (a potential injection surface).

```bash
pnpm security:convex-any-args-gate
```

Known exceptions are tracked in `security/convex-v-any-arg-exceptions.json` with expiry dates.

### `ci-secret-scan.js`

Scans the codebase for accidentally committed secrets, API keys, and credentials.

```bash
pnpm security:secret-scan
```

Reviewed false-positive exceptions are tracked in
`security/secret-scan-exceptions.json` with owner, reason, and expiry metadata.

### `ci-security-headers-check.js`

Validates security header configuration across HTTP endpoints.

```bash
pnpm security:headers-check
```

### `ci-audit-gate.js`

Runs `pnpm audit` and fails if vulnerabilities exceed the allowlist.

```bash
node scripts/ci-audit-gate.js
```

Known vulnerabilities are allowlisted in `security/dependency-audit-allowlist.json` with expiry dates.

## Testing & Reliability

### `test-summary.js`

Summarizes recent E2E test run results from `test-run-log.jsonl`.

```bash
pnpm test:summary       # Show summary
pnpm test:clear          # Clear run history
```

### `e2e-reliability-report.js`

Generates an E2E test reliability report from Playwright results.

```bash
node scripts/e2e-reliability-report.js
```

### `e2e-reliability-gate.js`

CI gate that fails if E2E flakiness or failures exceed the budget.

```bash
node scripts/e2e-reliability-gate.js
```

Budgets are defined in `security/e2e-reliability-budget.json`:

| Metric                | Budget |
| --------------------- | ------ |
| Unexpected (failures) | 0      |
| Flaky                 | 5      |
| Skipped               | 70     |

### `test-e2e-prod.js`

Runs E2E tests against a production build.

```bash
pnpm test:e2e:prod
```

## Data Seeding

### `seed-landing-demo.ts`

Seeds demo data for the landing page widget demonstration.

```bash
pnpm seed:landing          # Seed demo data
pnpm seed:landing:cleanup  # Clean up demo data
```

## Security Configuration Files

Files in `security/` configure CI gate behavior:

| File                                | Purpose                                      |
| ----------------------------------- | -------------------------------------------- |
| `convex-raw-handler-registry.json`  | Governance-reviewed raw handler audit trail  |
| `convex-raw-handler-inventory.json` | Sensitive authorization surface inventory    |
| `convex-v-any-arg-exceptions.json`  | Allowed `v.any()` usage with expiry dates    |
| `convex-v-any-arg-inventory.json`   | Migration progress for `v.any()` elimination |
| `dependency-audit-allowlist.json`   | Known acceptable dependency vulnerabilities  |
| `e2e-reliability-budget.json`       | Flakiness/failure thresholds for E2E gate    |
| `e2e-reliability-allowlist.json`    | Known flaky test exceptions                  |

## Root Package.json Script Aliases

### Development

| Command            | Description                |
| ------------------ | -------------------------- |
| `pnpm dev`         | Start all apps in parallel |
| `pnpm dev:web`     | Start web dashboard        |
| `pnpm dev:widget`  | Start widget dev server    |
| `pnpm dev:convex`  | Start Convex backend       |
| `pnpm dev:mobile`  | Start Expo mobile app      |
| `pnpm dev:landing` | Start landing page         |

### Build

| Command               | Description                 |
| --------------------- | --------------------------- |
| `pnpm build`          | Build all apps              |
| `pnpm build:web`      | Build web dashboard         |
| `pnpm build:widget`   | Build widget and distribute |
| `pnpm build:landing`  | Build landing page          |
| `pnpm build:sdk-core` | Build SDK core package      |
| `pnpm build:rn-sdk`   | Build React Native SDK      |

### Quality

| Command             | Description            |
| ------------------- | ---------------------- |
| `pnpm lint`         | Lint all packages      |
| `pnpm format`       | Format all files       |
| `pnpm format:check` | Check formatting       |
| `pnpm typecheck`    | Typecheck all packages |

### Testing

| Command              | Description                      |
| -------------------- | -------------------------------- |
| `pnpm test`          | Run unit + E2E tests             |
| `pnpm test:unit`     | Run unit tests (Vitest)          |
| `pnpm test:e2e`      | Run E2E tests (Playwright)       |
| `pnpm test:ci`       | Run tests with coverage          |
| `pnpm test:convex`   | Run Convex integration tests     |
| `pnpm test:summary`  | Show E2E run summary             |
| `pnpm test:clear`    | Clear E2E run history            |
| `pnpm test:e2e:prod` | Run E2E against production build |

### Security

| Command                              | Description                 |
| ------------------------------------ | --------------------------- |
| `pnpm security:convex-auth-guard`    | Scan for unguarded handlers |
| `pnpm security:convex-any-args-gate` | Scan for `v.any()` usage    |
| `pnpm security:secret-scan`          | Scan for committed secrets  |
| `pnpm security:headers-check`        | Validate security headers   |

### Deploy

| Command                     | Description                |
| --------------------------- | -------------------------- |
| `pnpm deploy:widget:cdn`    | Deploy widget to CDN       |
| `pnpm seed:landing`         | Seed landing demo data     |
| `pnpm seed:landing:cleanup` | Clean up landing demo data |
