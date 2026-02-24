import { defineConfig, devices } from "@playwright/test";

// Check if we should use production build for tests
const useProdBuild = process.env.E2E_USE_PROD_BUILD === "true" || process.env.CI;
const requestedWorkers = Number(process.env.E2E_WORKERS || (process.env.CI ? "4" : "2"));
const e2eWorkers =
  Number.isFinite(requestedWorkers) && requestedWorkers > 0 ? Math.floor(requestedWorkers) : 1;

export default defineConfig({
  globalTeardown: "./apps/web/e2e/global-teardown.ts",
  testDir: "./apps/web/e2e",
  // Keep intra-file ordering for stateful suites while parallelizing by worker across files.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: e2eWorkers,
  reporter: [
    ["html", { open: "never" }],
    ["list"],
    ["./apps/web/e2e/helpers/test-run-reporter.js"],
  ],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
      testIgnore: [/auth\.spec\.ts/, /public-pages\.spec\.ts/],
    },
    {
      // No-auth suites validate explicit unauthenticated/public boundaries.
      name: "chromium-no-auth",
      use: {
        ...devices["Desktop Chrome"],
        storageState: undefined,
      },
      testMatch: [/auth\.spec\.ts/, /public-pages\.spec\.ts/],
    },
  ],
  webServer: useProdBuild
    ? {
        // Production build: build first, then start
        command:
          "bash scripts/build-widget-for-tests.sh && pnpm build:web && NEXT_PUBLIC_WIDGET_URL=/opencom-widget.iife.js pnpm --filter @opencom/web start",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 300 * 1000, // 5 minutes for build + start
        env: {
          NEXT_PUBLIC_WIDGET_URL: "/opencom-widget.iife.js",
          ALLOW_TEST_DATA: "true",
        },
      }
    : {
        // Development server (default)
        command:
          "bash scripts/build-widget-for-tests.sh && NEXT_PUBLIC_WIDGET_URL=/opencom-widget.iife.js pnpm dev:web",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000,
        env: {
          NEXT_PUBLIC_WIDGET_URL: "/opencom-widget.iife.js",
          ALLOW_TEST_DATA: "true",
        },
      },
});
