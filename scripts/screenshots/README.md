# Screenshot Automation

Repeatable scripts that seed demo data and capture comprehensive screenshots across the web app, widget, RN SDK example, and mobile admin app.

## Output

All screenshots are written to `artifacts/screenshots/<app>/` with a `manifest.json` in each subdirectory.

## Seeding Demo Data

By default, screenshots capture an empty workspace. Set `SEED_DATA=true` to populate the org with realistic demo data (visitors, conversations, tickets, articles, tours, surveys, checklists, tooltips, segments, snippets, outbound messages, email campaigns) before capturing.

```bash
# Screenshots with a full workspace
SEED_DATA=true npx tsx scripts/screenshots/capture-web.ts

# Screenshots with an empty workspace (default)
npx tsx scripts/screenshots/capture-web.ts
```

The seeded data uses the `e2e_test_` prefix and can be cleaned up via the `testData:cleanupTestData` internal mutation.

**Requirements:**

- `ALLOW_TEST_DATA=true` must be set on the Convex server environment
- `TEST_ADMIN_SECRET` must be set (matching the env var on the Convex deployment)

## Scripts

### Web App (`capture-web.ts`)

Captures screenshots of every major web app surface after signing up a demo user.

```bash
# Ensure dev server is running
pnpm dev:web

# Run
npx tsx scripts/screenshots/capture-web.ts
```

**Environment variables:**

- `BASE_URL` – web app URL (default `http://localhost:3000`)
- `E2E_BACKEND_URL` / `NEXT_PUBLIC_CONVEX_URL` – Convex backend (default `https://xxx.eu-west-1.convex.cloud`)
- `SEED_DATA` – set to `true` to populate demo data before capture

### Widget (`capture-widget.ts`)

Opens the widget-demo page and captures the widget launcher, home, and each tab.

```bash
# Ensure dev server + widget are running
bash scripts/build-widget-for-tests.sh
pnpm dev:web

# Run
npx tsx scripts/screenshots/capture-widget.ts
```

**Environment variables:**

- `BASE_URL` – web app URL (default `http://localhost:3000`)
- `DEMO_WORKSPACE_ID` – workspace to load in the widget (optional; falls back to page default)
- `SEED_DATA` – set to `true` to populate demo data before capture

### RN SDK Example (`capture-rn-sdk.ts`)

Launches the React Native SDK example on the iOS simulator and captures home, messenger, help center, and tickets screens.

```bash
# Boot simulator and build the example app first
# cd packages/react-native-sdk/example && npx expo run:ios

npx tsx scripts/screenshots/capture-rn-sdk.ts
```

**Environment variables:**

- `SIMULATOR_UDID` – specific simulator to use (optional; uses booted sim)

### Mobile Admin App (`capture-mobile.ts`)

Launches the mobile admin app on the iOS simulator and captures inbox, settings, and conversation screens.

```bash
# Boot simulator and build the mobile app first
# cd apps/mobile && npx expo run:ios

npx tsx scripts/screenshots/capture-mobile.ts
```

**Environment variables:**

- `SIMULATOR_UDID` – specific simulator to use (optional; uses booted sim)

## Manifest Format

Each `manifest.json` follows this schema:

```json
{
  "generatedAt": "2025-02-09T12:00:00.000Z",
  "screenshots": [
    {
      "app": "web",
      "screen": "inbox",
      "filePath": "/absolute/path/to/web-inbox.png",
      "timestamp": "2025-02-09T12:00:01.000Z"
    }
  ]
}
```
