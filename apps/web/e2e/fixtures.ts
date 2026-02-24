/**
 * Playwright test fixtures for E2E tests.
 *
 * Provides worker-scoped authenticated contexts and test state.
 * Each parallel worker gets one dedicated account/workspace and reuses
 * that auth state for all tests running on the worker.
 */

import { test as base, type Browser, type BrowserContext, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { resolveE2EBackendUrl } from "./helpers/e2e-env";
import { readTestStateFromPath, type E2ETestState } from "./helpers/test-state";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const BACKEND_URL = resolveE2EBackendUrl();
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || "TestPassword123!";
const PASSWORD_SIGNUP_RE = /sign up with password|^password$/i;
const AUTH_ROUTE_RE = /\/(login|signup)(\/|$|\?)/;
const AUTHENTICATED_LANDING_RE = /^\/($|onboarding(?:\/|$)|inbox(?:\/|$)|dashboard(?:\/|$))/;

type WorkerFixtures = {
  workerStorageState: string;
  workerTestState: E2ETestState;
};

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isAuthUrl(url: string): boolean {
  try {
    return AUTH_ROUTE_RE.test(new URL(url, BASE_URL).pathname);
  } catch {
    return AUTH_ROUTE_RE.test(url);
  }
}

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

async function seedBackendStorage(context: BrowserContext): Promise<void> {
  await context.addInitScript((backendUrl: string) => {
    const payload = {
      backends: [
        {
          url: backendUrl,
          name: "Opencom Hosted",
          convexUrl: backendUrl,
          lastUsed: new Date().toISOString(),
          signupMode: "open",
          authMethods: ["password", "otp"],
        },
      ],
      activeBackend: backendUrl,
    };
    window.localStorage.setItem("opencom_backends", JSON.stringify(payload));
  }, BACKEND_URL);
}

async function connectBackendIfRequired(page: Page): Promise<void> {
  const backendInput = page.getByLabel(/backend url/i).first();
  if (!(await backendInput.isVisible({ timeout: 2000 }).catch(() => false))) {
    return;
  }

  await backendInput.fill(BACKEND_URL);
  await page
    .getByRole("button", { name: /connect/i })
    .first()
    .click({ timeout: 10000 });
  await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});
}

async function switchToPasswordSignupIfNeeded(page: Page): Promise<void> {
  const passwordField = page.getByLabel("Password", { exact: true });
  if (await passwordField.isVisible({ timeout: 1000 }).catch(() => false)) {
    return;
  }

  const candidateButtons = [
    page.getByRole("button", { name: PASSWORD_SIGNUP_RE }).first(),
    page.getByRole("button", { name: /password/i }).first(),
  ];

  for (const candidate of candidateButtons) {
    if (!(await candidate.isVisible({ timeout: 2000 }).catch(() => false))) {
      continue;
    }

    await candidate.click({ timeout: 10000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});

    if (await passwordField.isVisible({ timeout: 3000 }).catch(() => false)) {
      return;
    }
  }
}

async function gotoWithRetries(
  page: Page,
  targetPath: string,
  options?: {
    attempts?: number;
    timeoutMs?: number;
  }
): Promise<void> {
  const attempts = options?.attempts ?? 3;
  const timeoutMs = options?.timeoutMs ?? 60000;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await page.goto(`${BASE_URL}${targetPath}`, {
        waitUntil: attempt === 0 ? "domcontentloaded" : "commit",
        timeout: timeoutMs + attempt * 10000,
      });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await page.waitForTimeout(500 * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`[fixtures] Could not open ${targetPath}`);
}

async function waitForAuthenticatedLanding(page: Page, timeout = 60000): Promise<void> {
  await page.waitForURL((url) => AUTHENTICATED_LANDING_RE.test(url.pathname), {
    timeout,
    waitUntil: "domcontentloaded",
  });
}

async function ensureSignupFormVisible(page: Page): Promise<boolean> {
  const timeoutMs = 90000;
  const deadline = Date.now() + timeoutMs;
  const nameInput = page.getByLabel("Name", { exact: true });

  while (Date.now() < deadline) {
    if (await nameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      return true;
    }

    const signupLink = page.getByRole("link", { name: /^sign up$/i }).first();
    if (await signupLink.isVisible({ timeout: 1000 }).catch(() => false)) {
      await signupLink.click({ timeout: 10000 }).catch(() => {});
      await page.waitForURL(/\/signup(\/|$|\?)/, { timeout: 15000 }).catch(() => {});
    }

    await page.waitForTimeout(1000);
  }

  return false;
}

async function readWorkspaceId(page: Page): Promise<string | undefined> {
  const workspaceId = await page.evaluate(() => {
    const stored = localStorage.getItem("opencom_active_workspace");
    if (!stored) {
      return null;
    }

    try {
      const parsed = JSON.parse(stored) as { _id?: string };
      return parsed._id ?? null;
    } catch {
      return null;
    }
  });

  return workspaceId ?? undefined;
}

async function resolveWorkspaceIdOrThrow(page: Page): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const workspaceId = await readWorkspaceId(page);
    if (workspaceId) {
      return workspaceId;
    }

    await page
      .goto(`${BASE_URL}/inbox`, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      })
      .catch(() => {});
    await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => {});

    if (AUTH_ROUTE_RE.test(page.url())) {
      break;
    }

    await page.waitForTimeout(500);
  }

  throw new Error(
    "[fixtures] Worker auth bootstrap could not resolve workspaceId in localStorage. " +
      "Check signup/onboarding flow and backend connectivity."
  );
}

async function provisionWorkerState(
  browser: Browser,
  workerIndex: number,
  authStoragePath: string,
  stateFilePath: string
): Promise<E2ETestState> {
  const testRunId = Date.now();
  const email = `e2e_worker_${workerIndex}_${testRunId}_${randomSuffix()}@test.opencom.dev`;
  const workspaceName = `E2E Worker ${workerIndex} Workspace ${testRunId}`;

  const context = await browser.newContext({ storageState: undefined });
  await seedBackendStorage(context);
  const page = await context.newPage();

  try {
    await gotoWithRetries(page, "/signup", { attempts: 3, timeoutMs: 60000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => {});

    await connectBackendIfRequired(page);

    const signupFormVisible = await ensureSignupFormVisible(page);
    if (!signupFormVisible) {
      const debugScreenshot = stateFilePath.replace(/\.e2e-state\.json$/, ".signup-debug.png");
      await page.screenshot({ path: debugScreenshot, fullPage: true }).catch(() => {});
      console.warn(`[fixtures] Signup form missing at URL: ${page.url()}`);
      console.warn(`[fixtures] Signup debug screenshot: ${debugScreenshot}`);
      throw new Error("[fixtures] Signup form did not become visible during worker provisioning.");
    }

    await switchToPasswordSignupIfNeeded(page);
    const passwordInput = page.getByLabel("Password", { exact: true });
    if (!(await passwordInput.isVisible({ timeout: 5000 }).catch(() => false))) {
      const debugScreenshot = stateFilePath.replace(
        /\.e2e-state\.json$/,
        ".signup-password-debug.png"
      );
      await page.screenshot({ path: debugScreenshot, fullPage: true }).catch(() => {});
      throw new Error(
        "[fixtures] Password signup mode was not available during worker provisioning."
      );
    }

    const nameInput = page.getByLabel("Name", { exact: true });
    await nameInput.fill("E2E Worker User");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await passwordInput.fill(TEST_PASSWORD);

    const workspaceNameField = page.getByLabel(/workspace name/i).first();
    if (await workspaceNameField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await workspaceNameField.fill(workspaceName);
    }

    await page.getByRole("button", { name: /create account|sign up/i }).click({ timeout: 10000 });
    await waitForAuthenticatedLanding(page, 90000);
    const pathAfterSignup = new URL(page.url()).pathname;
    if (pathAfterSignup === "/") {
      await gotoWithRetries(page, "/inbox", { attempts: 2, timeoutMs: 45000 });
    }
    await page.waitForTimeout(1000);

    const workspaceId = await resolveWorkspaceIdOrThrow(page);
    if (AUTH_ROUTE_RE.test(page.url())) {
      throw new Error("[fixtures] Worker auth bootstrap ended on an auth route unexpectedly.");
    }

    await context.storageState({ path: authStoragePath });

    const state: E2ETestState = {
      testRunId,
      workerIndex,
      email,
      workspaceName,
      workspaceId,
      authStoragePath,
      stateFilePath,
    };

    fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2), { mode: 0o600 });
    return state;
  } finally {
    await context.close();
  }
}

function setWorkerStateEnv(state: E2ETestState): void {
  if (state.stateFilePath) {
    process.env.E2E_WORKER_STATE_PATH = state.stateFilePath;
  }
  if (state.authStoragePath) {
    process.env.E2E_WORKER_AUTH_STATE_PATH = state.authStoragePath;
  }
}

function getReusableWorkerState(
  stateFilePath: string,
  authStoragePath: string
): E2ETestState | null {
  const state = readTestStateFromPath(stateFilePath);
  if (!state) {
    return null;
  }

  if (!state.email || !state.workspaceName || !state.workspaceId) {
    console.warn(
      `[fixtures] Worker state at ${stateFilePath} is missing required fields; reprovisioning worker state.`
    );
    return null;
  }

  const resolvedAuthPath = state.authStoragePath || authStoragePath;
  if (!fs.existsSync(resolvedAuthPath)) {
    return null;
  }

  return {
    ...state,
    authStoragePath: resolvedAuthPath,
    stateFilePath,
  };
}

// Extended test type with fixtures
export const test = base.extend<
  {
    testState: E2ETestState;
  },
  WorkerFixtures
>({
  storageState: ({ workerStorageState }, use) => use(workerStorageState),

  page: async ({ page, workerTestState }, use) => {
    await use(page);

    if (page.isClosed()) {
      return;
    }

    // Keep the worker auth state fresh between tests to avoid refresh-token drift.
    if (isAuthUrl(page.url())) {
      return;
    }

    await page
      .context()
      .storageState({ path: workerTestState.authStoragePath })
      .catch((error) => {
        console.warn(`[fixtures] Failed to persist worker auth state: ${formatError(error)}`);
      });
  },

  workerStorageState: [
    async ({ workerTestState }, use) => {
      await use(workerTestState.authStoragePath);
    },
    { scope: "worker" },
  ],

  workerTestState: [
    async ({ browser }, use, workerInfo) => {
      const workerIndex = workerInfo.parallelIndex;
      const workerStateDir = path.resolve(workerInfo.project.outputDir, ".auth");
      ensureDir(workerStateDir);

      const filePrefix = `${workerInfo.project.name}-worker-${workerIndex}`
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-");
      const authStoragePath = path.join(workerStateDir, `${filePrefix}.auth-state.json`);
      const stateFilePath = path.join(workerStateDir, `${filePrefix}.e2e-state.json`);

      let state = getReusableWorkerState(stateFilePath, authStoragePath);
      if (!state) {
        state = await provisionWorkerState(browser, workerIndex, authStoragePath, stateFilePath);
      }

      setWorkerStateEnv(state);
      await use(state);
    },
    { scope: "worker", auto: true, timeout: 180000 },
  ],

  testState: async ({ workerTestState }, use) => {
    setWorkerStateEnv(workerTestState);
    await use(workerTestState);
  },
});

export { expect } from "@playwright/test";
