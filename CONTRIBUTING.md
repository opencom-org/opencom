# Contributing

Thanks for contributing to Opencom. This guide covers everything you need to get productive.

## Quick Links

- [OSS Documentation Hub](docs/open-source/README.md)
- [Architecture & Repo Map](docs/open-source/architecture-and-repo-map.md)
- [Setup & Deploy](docs/open-source/setup-self-host-and-deploy.md)
- [Testing & Verification](docs/open-source/testing-and-verification.md)
- [Security & Operations](docs/open-source/security-and-operations.md)
- [Data Model Reference](docs/data-model.md)
- [Backend API Reference](docs/api-reference.md)
- [Scripts Reference](docs/scripts-reference.md)

## Development Setup

### Prerequisites

- Node.js 18+
- PNPM 9+ (`npm install -g pnpm`)
- Convex account (free at [convex.dev](https://convex.dev))

### Quickstart

```bash
git clone https://github.com/opencom-org/opencom.git
cd opencom
./scripts/setup.sh
```

Or manually:

```bash
pnpm install
cd packages/convex && npx convex dev
```

### Running Apps

```bash
pnpm dev              # All apps in parallel
pnpm dev:web          # Web dashboard (localhost:3000)
pnpm dev:widget       # Widget dev server (localhost:5173)
pnpm dev:convex       # Convex backend
pnpm dev:mobile       # Expo mobile app
pnpm dev:landing      # Landing page (localhost:3001)
```

## Project Structure

```
opencom/
├── apps/
│   ├── web/              # Next.js admin dashboard (agents/admins)
│   ├── mobile/           # Expo admin app (iOS/Android)
│   ├── widget/           # Embeddable chat widget (Vite, IIFE bundle)
│   └── landing/          # Marketing site (Next.js)
├── packages/
│   ├── convex/           # Convex backend (schema, queries, mutations, HTTP routes)
│   ├── types/            # Shared TypeScript types
│   ├── ui/               # Shared React components (Shadcn)
│   ├── sdk-core/         # Shared SDK logic (sessions, events, conversations)
│   ├── react-native-sdk/ # React Native SDK for customer apps
│   ├── ios-sdk/          # Native iOS SDK (Swift)
│   └── android-sdk/      # Native Android SDK (Kotlin)
├── scripts/              # Build, deploy, security, and utility scripts
├── security/             # CI gate configuration (allowlists, budgets)
└── docs/                 # Project documentation
```

## Code Style & Conventions

### General

- **Package manager**: Always use `pnpm`, never `npm` or `yarn`.
- **Formatting**: Prettier handles formatting. Run `pnpm format` before committing.
- **Linting**: ESLint configured per-package. Run `pnpm lint`.
- **TypeScript**: Strict mode. No `any` without documented justification.
- **No comments in code** unless the logic is non-obvious.

### Convex Backend

- All queries and mutations live in `packages/convex/convex/`.
- Use Convex indexes for all high-traffic lookups (avoid table scans).
- Use `requirePermission()` or `hasPermission()` for auth checks.
- Visitor endpoints require `sessionToken` validated via `resolveVisitorFromSession()`.
- System/bot actions use `internalMutation` to bypass external auth.
- Use `v.any()` sparingly and document in `security/convex-v-any-arg-exceptions.json`.

### Frontend (Web / Landing)

- Next.js App Router.
- Tailwind CSS + Shadcn UI components from `@opencom/ui`.
- React context for auth (`AuthContext`) and backend connection (`BackendContext`).
- Convex React hooks for data fetching (real-time subscriptions).

### Widget

- Vite-built IIFE bundle. Target: <50KB gzipped.
- No external dependencies beyond Convex client.
- All visitor calls thread `sessionToken`.

### Mobile

- Expo / React Native.
- Same auth patterns as web (Convex Auth + BackendContext).

## Verification Workflow

Run focused checks first for touched surfaces, then broaden as needed.

### Baseline Checks

```bash
pnpm lint
pnpm typecheck
pnpm test:convex
pnpm test:unit
```

### Targeted Package Checks

```bash
pnpm --filter @opencom/convex typecheck
pnpm --filter @opencom/convex test -- --run tests/<file>.test.ts
pnpm --filter @opencom/web typecheck
pnpm --filter @opencom/web test
pnpm --filter @opencom/widget typecheck
pnpm --filter @opencom/widget test
```

### E2E Tests

Build widget assets first, then run Playwright:

```bash
bash scripts/build-widget-for-tests.sh
pnpm playwright test apps/web/e2e/<spec>.ts --project=chromium
```

### Security Gates (CI-equivalent)

```bash
pnpm security:convex-auth-guard
pnpm security:convex-any-args-gate
pnpm security:secret-scan
pnpm security:headers-check
```

Before pushing any branch, run `pnpm security:secret-scan` locally at minimum.
If you need to allowlist a non-secret false positive, add a narrowly scoped entry in
`security/secret-scan-exceptions.json` with explicit owner, reason, and expiry date.

For workflow changes, pin third-party GitHub Actions to immutable commit SHAs
and update adjacent traceability comments when changing pins.

## Writing Tests

### Convex Integration Tests

Test against a dedicated Convex deployment. Use the test helpers:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("myFeature", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;

  beforeAll(async () => {
    client = new ConvexClient(process.env.CONVEX_URL!);
    const workspace = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    testWorkspaceId = workspace.workspaceId;
  });

  afterAll(async () => {
    if (testWorkspaceId) {
      await client.mutation(api.testing.helpers.cleanupTestData, {
        workspaceId: testWorkspaceId,
      });
    }
    await client.close();
  });

  it("should do something", async () => {
    // test code
  });
});
```

Available helpers: `createTestWorkspace`, `createTestUser`, `createTestVisitor`, `createTestSessionToken`, `createTestConversation`, `createTestMessage`, `cleanupTestData`.

### React Component Tests

```typescript
import { render, screen } from "@testing-library/react";

describe("MyComponent", () => {
  it("renders correctly", () => {
    render(<MyComponent />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
```

### E2E Tests

```typescript
import { test, expect } from "@playwright/test";

test("should work", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading")).toBeVisible();
});
```

## Pull Request Guidelines

- Read and agree to the [Contributor License Agreement](CLA.md) before opening a pull request.
- Add this line to your PR description: `I have read and agree to the CLA.`
- Keep PRs focused and scoped to one logical change.
- Add or update tests for behavioral changes.
- Never commit secrets or environment-specific credentials.
- Update docs when command/env/workflow behavior changes.
- Run `pnpm lint && pnpm typecheck` before pushing.

## Security-Sensitive Changes

For changes affecting auth, origin validation, webhooks, CORS, or data access controls:

- Include explicit negative-path tests (unauthorized, cross-workspace, expired tokens).
- Describe threat model assumptions in PR notes.
- Prefer fail-closed behavior.
- Run all security gates before requesting review.
- Update `docs/security.md` if authorization model changes.
