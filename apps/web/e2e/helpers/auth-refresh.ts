/**
 * Auth Refresh Helper
 * Re-authenticates using saved credentials from .e2e-state.json
 * when the Convex auth JWT has expired mid-suite.
 */

import { chromium, type Page } from "@playwright/test";
import * as fs from "fs";
import {
  getAuthStatePath,
  getTestStatePath,
  readTestStateFromPath,
  type E2ETestState,
} from "./test-state";
import { resolveE2EBackendUrl } from "./e2e-env";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const BACKEND_URL = resolveE2EBackendUrl();
const AUTH_ROUTE_RE = /\/(login|signup)(\/|$|\?)/;
const AUTH_EXPIRY_BUFFER_SECONDS = readEnvNumber("E2E_AUTH_EXPIRY_BUFFER_SECONDS", 120);
const AUTH_REDIRECT_TIMEOUT_MS = readEnvNumber("E2E_AUTH_REDIRECT_TIMEOUT_MS", 1500);
const NAV_TIMEOUT_MS = readEnvNumber("E2E_NAV_TIMEOUT_MS", 20000);
const LOGIN_NAV_TIMEOUT_MS = readEnvNumber("E2E_LOGIN_NAV_TIMEOUT_MS", 35000);
const AUTH_PROBE_TIMEOUT_MS = readEnvNumber("E2E_AUTH_PROBE_TIMEOUT_MS", 8000);
const NAV_BACKOFF_MS = readEnvNumber("E2E_NAV_BACKOFF_MS", 500);
const PROTECTED_LANDING_RE = /\/(inbox|dashboard)(\/|$|\?)/;
const LATE_AUTH_REDIRECT_TIMEOUT_MS = readEnvNumber("E2E_LATE_AUTH_REDIRECT_TIMEOUT_MS", 5000);
const PASSWORD_LOGIN_RE =
  /log in with password|sign in with password|sign in with password instead|log in with password instead/i;
const ROUTE_RECOVERY_TIMEOUT_MS = readEnvNumber("E2E_ROUTE_RECOVERY_TIMEOUT_MS", 12000);

function readEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatError(error: unknown): string {
  if (!error) return "unknown error";
  if (error instanceof Error) return error.message;
  return String(error);
}

function getTestPassword(): string {
  return process.env.E2E_TEST_PASSWORD || "TestPassword123!";
}

function toAbsoluteUrl(target: string): string {
  if (/^https?:\/\//i.test(target)) {
    return target;
  }
  if (target.startsWith("/")) {
    return `${BASE_URL}${target}`;
  }
  return `${BASE_URL}/${target}`;
}

function isExpectedNavigationTarget(currentUrl: string, expectedUrl: string): boolean {
  try {
    const current = new URL(currentUrl, BASE_URL);
    const expected = new URL(expectedUrl, BASE_URL);
    return current.origin === expected.origin && current.pathname === expected.pathname;
  } catch {
    return currentUrl === expectedUrl || currentUrl.endsWith(expectedUrl);
  }
}

/**
 * Extracts the Convex auth JWT from Playwright storage state.
 */
function readStoredJwt(): string | null {
  const authStatePath = getAuthStatePath();
  try {
    if (!fs.existsSync(authStatePath)) {
      return null;
    }

    const raw = JSON.parse(fs.readFileSync(authStatePath, "utf-8")) as {
      origins?: Array<{
        localStorage?: Array<{ name: string; value: string }>;
      }>;
    };

    for (const origin of raw.origins ?? []) {
      for (const entry of origin.localStorage ?? []) {
        if (entry.name.startsWith("__convexAuthJWT_")) {
          return entry.value;
        }
      }
    }
  } catch {
    // Fall through to stale=true
  }
  return null;
}

function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8")) as {
      exp?: number;
    };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function isAuthRoute(url: string): boolean {
  return AUTH_ROUTE_RE.test(url);
}

function isInitialPageUrl(url: string): boolean {
  return (
    !url ||
    url === "about:blank" ||
    url === "about:srcdoc" ||
    url === "data:," ||
    url.startsWith("about:blank#")
  );
}

async function isSuspiciousBlankPage(page: Page): Promise<boolean> {
  if (page.isClosed()) {
    return false;
  }

  return page
    .evaluate(() => {
      const body = document.body;
      if (!body) {
        return true;
      }

      if (body.innerText.trim().length > 0) {
        return false;
      }

      const hasMainContent = Boolean(
        body.querySelector(
          "[data-testid], main, nav, aside, section, form, input, textarea, h1, h2, h3, [role='heading']"
        )
      );
      if (hasMainContent) {
        return false;
      }

      const hasRouteAnnouncer = Boolean(body.querySelector("next-route-announcer"));
      return hasRouteAnnouncer;
    })
    .catch(() => false);
}

async function isAuthUiVisible(page: Page): Promise<boolean> {
  if (page.isClosed()) {
    return false;
  }

  const signInHeading = page.getByRole("heading", { name: /sign in to your account/i }).first();
  if (await signInHeading.isVisible({ timeout: 1200 }).catch(() => false)) {
    return true;
  }

  const sendCodeButton = page.getByRole("button", { name: /send verification code/i }).first();
  if (await sendCodeButton.isVisible({ timeout: 1200 }).catch(() => false)) {
    return true;
  }

  const passwordButton = page.getByRole("button", { name: /sign in with password/i }).first();
  return passwordButton.isVisible({ timeout: 1200 }).catch(() => false);
}

async function safeGoto(
  page: Page,
  target: string,
  options?: {
    timeoutMs?: number;
    attempts?: number;
    label?: string;
  }
): Promise<boolean> {
  if (page.isClosed()) {
    return false;
  }

  const attempts = options?.attempts ?? 2;
  const timeoutMs = options?.timeoutMs ?? NAV_TIMEOUT_MS;
  const label = options?.label ?? target;
  const url = toAbsoluteUrl(target);
  const waitStates: Array<"domcontentloaded" | "commit"> = ["domcontentloaded", "commit"];

  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (page.isClosed()) {
      return false;
    }

    const waitUntil = waitStates[Math.min(attempt, waitStates.length - 1)];
    const timeout = timeoutMs + attempt * 2500;

    try {
      await page.goto(url, { waitUntil, timeout });
      return true;
    } catch (error) {
      lastError = error;

      if (isExpectedNavigationTarget(page.url(), url)) {
        return true;
      }

      const message = formatError(error).toLowerCase();
      const recoverableAbort =
        message.includes("err_aborted") ||
        message.includes("frame was detached") ||
        message.includes("navigation interrupted");

      if (recoverableAbort && !page.isClosed()) {
        const reachedTarget = await page
          .waitForURL((nextUrl) => isExpectedNavigationTarget(nextUrl.toString(), url), {
            timeout: Math.min(3000, timeoutMs),
            waitUntil: "commit",
          })
          .then(() => true)
          .catch(() => false);

        if (reachedTarget) {
          return true;
        }
      }

      if (attempt < attempts - 1) {
        await page.waitForTimeout(NAV_BACKOFF_MS * (attempt + 1)).catch(() => {});
      }
    }
  }

  console.warn(`[auth-refresh] Navigation failed for ${label}: ${formatError(lastError)}`);
  return false;
}

async function connectBackendIfRequired(page: Page): Promise<boolean> {
  const backendInput = page.getByLabel(/backend url/i).first();
  if (!(await backendInput.isVisible({ timeout: 2000 }).catch(() => false))) {
    return true;
  }

  try {
    await backendInput.fill(BACKEND_URL);
    const connectButton = page.getByRole("button", { name: /connect/i }).first();
    await connectButton.click({ timeout: 10000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});
    return true;
  } catch (error) {
    console.warn(`[auth-refresh] Failed to connect backend in auth flow: ${formatError(error)}`);
    return false;
  }
}

async function switchToPasswordLoginIfNeeded(page: Page): Promise<void> {
  const passwordLoginButton = page
    .getByRole("button", {
      name: PASSWORD_LOGIN_RE,
    })
    .first();
  if (await passwordLoginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await passwordLoginButton.click({ timeout: 10000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});
  }
}

async function waitForAuthenticatedLanding(page: Page, timeout = 30000): Promise<boolean> {
  try {
    await page.waitForURL((url) => !AUTH_ROUTE_RE.test(url.pathname), {
      timeout,
      waitUntil: "domcontentloaded",
    });
  } catch {
    // Fall through to URL checks below.
  }

  if (isAuthRoute(page.url())) {
    return false;
  }

  if (PROTECTED_LANDING_RE.test(page.url())) {
    return true;
  }

  // Non-auth route means we have a session, even if not on inbox/dashboard.
  return true;
}

async function waitForRouteSettled(page: Page, timeout = 10000): Promise<boolean> {
  if (page.isClosed()) {
    return false;
  }

  await page
    .waitForLoadState("domcontentloaded", { timeout: Math.min(timeout, 5000) })
    .catch(() => {});

  const loadingText = page.getByText("Loading...", { exact: true }).first();
  const probeDeadline = Date.now() + Math.min(timeout, 2000);
  let loadingVisible = false;

  while (!page.isClosed() && Date.now() < probeDeadline) {
    loadingVisible = await loadingText.isVisible({ timeout: 250 }).catch(() => false);
    if (loadingVisible) {
      break;
    }
    await page.waitForTimeout(150).catch(() => {});
  }

  if (!loadingVisible) {
    return true;
  }

  const hidden = await loadingText
    .waitFor({
      state: "hidden",
      timeout: Math.max(1000, timeout - Math.min(timeout, 2000)),
    })
    .then(() => true)
    .catch(() => false);
  if (!hidden) {
    return false;
  }

  await page.waitForTimeout(250).catch(() => {});
  return !(await loadingText.isVisible({ timeout: 250 }).catch(() => false));
}

async function isRouteErrorBoundaryVisible(page: Page): Promise<boolean> {
  return page
    .getByRole("heading", { name: /something went wrong/i })
    .first()
    .isVisible({ timeout: 1500 })
    .catch(() => false);
}

async function attemptInPageRouteRecovery(page: Page, path: string): Promise<boolean> {
  if (page.isClosed()) {
    return false;
  }

  if (await isRouteErrorBoundaryVisible(page)) {
    const tryAgainButton = page.getByRole("button", { name: /try again/i }).first();
    if (await tryAgainButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await tryAgainButton.click({ timeout: 5000 }).catch(() => {});
      if (
        (await waitForRouteSettled(page, ROUTE_RECOVERY_TIMEOUT_MS)) &&
        !isAuthRoute(page.url()) &&
        !(await isAuthUiVisible(page)) &&
        !(await isRouteErrorBoundaryVisible(page))
      ) {
        return true;
      }
    }
  }

  // Last in-page recovery attempt: hard refresh current route and re-check readiness.
  await page
    .reload({
      waitUntil: "domcontentloaded",
      timeout: Math.min(ROUTE_RECOVERY_TIMEOUT_MS, NAV_TIMEOUT_MS),
    })
    .catch(() => {});
  if (
    (await waitForRouteSettled(page, ROUTE_RECOVERY_TIMEOUT_MS)) &&
    !isAuthRoute(page.url()) &&
    !(await isAuthUiVisible(page)) &&
    !(await isRouteErrorBoundaryVisible(page))
  ) {
    return true;
  }

  const reopened = await safeGoto(page, path, {
    attempts: 1,
    timeoutMs: Math.min(ROUTE_RECOVERY_TIMEOUT_MS, NAV_TIMEOUT_MS),
    label: `${path} (recovery)`,
  });
  if (!reopened) {
    return false;
  }
  return (
    (await waitForRouteSettled(page, ROUTE_RECOVERY_TIMEOUT_MS)) &&
    !isAuthRoute(page.url()) &&
    !(await isAuthUiVisible(page)) &&
    !(await isRouteErrorBoundaryVisible(page))
  );
}

async function performPasswordLogin(page: Page, state: E2ETestState): Promise<boolean> {
  if (!(await connectBackendIfRequired(page))) {
    return false;
  }

  await switchToPasswordLoginIfNeeded(page);

  const emailInput = page.getByLabel("Email", { exact: true });
  if (!(await emailInput.isVisible({ timeout: 12000 }).catch(() => false))) {
    // When an existing session auto-redirects from /login, login inputs might never render.
    return waitForAuthenticatedLanding(page, 8000);
  }

  await emailInput.fill(state.email);
  await page.getByLabel("Password", { exact: true }).fill(getTestPassword());
  await page.getByRole("button", { name: /^(log in|sign in)$/i }).click();

  return waitForAuthenticatedLanding(page, 35000);
}

async function waitForAuthRedirect(
  page: Page,
  timeout = AUTH_REDIRECT_TIMEOUT_MS
): Promise<boolean> {
  if (isAuthRoute(page.url())) {
    return true;
  }

  const initialUrl = page.url();
  try {
    await page.waitForURL((url) => AUTH_ROUTE_RE.test(url.pathname), {
      timeout,
      waitUntil: "commit",
    });
    return true;
  } catch {
    if (page.url() === initialUrl && !isAuthRoute(page.url())) {
      return false;
    }
    return isAuthRoute(page.url());
  }
}

/**
 * Checks whether the current auth state is stale by validating JWT expiry
 * and confirming that an authenticated route does not redirect to login.
 */
function isAuthStale(): boolean {
  const jwt = readStoredJwt();
  if (!jwt) {
    return true;
  }

  const exp = decodeJwtExp(jwt);
  if (!exp) {
    return true;
  }

  const now = Math.floor(Date.now() / 1000);
  // Refresh slightly before expiry to avoid race conditions during a test.
  if (exp - now < AUTH_EXPIRY_BUFFER_SECONDS) {
    return true;
  }

  return false;
}

/**
 * Gets the test state saved by global setup.
 */
function getState(): E2ETestState | null {
  return readTestStateFromPath(getTestStatePath());
}

/**
 * Re-authenticates using the saved test credentials and writes a fresh
 * storageState to the active auth-state file.
 *
 * Returns true if re-auth succeeded, false otherwise.
 */
export async function refreshAuthState(): Promise<boolean> {
  const state = getState();
  if (!state) {
    console.warn("[auth-refresh] No test state found - cannot re-authenticate");
    return false;
  }

  // Quick check: skip re-auth if token is still valid
  const stale = isAuthStale();
  if (!stale) {
    console.log("[auth-refresh] Auth token still valid - skipping refresh");
    return true;
  }

  console.log("[auth-refresh] Auth token expired - re-authenticating");

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    const openedLogin = await safeGoto(page, "/login", {
      timeoutMs: LOGIN_NAV_TIMEOUT_MS,
      attempts: 4,
      label: "/login refresh",
    });
    if (!openedLogin) {
      console.warn("[auth-refresh] Could not open /login during refresh");
      await context.close();
      return false;
    }

    // Already authenticated in this context.
    if (!isAuthRoute(page.url())) {
      await context.storageState({ path: getAuthStatePath() });
      await context.close();
      return true;
    }

    const loggedIn = await performPasswordLogin(page, state);
    if (!loggedIn) {
      console.warn("[auth-refresh] Login did not reach an authenticated route");
      await context.close();
      return false;
    }

    // Save fresh auth state
    await context.storageState({ path: getAuthStatePath() });
    console.log("[auth-refresh] Auth state refreshed successfully");

    await context.close();
    return true;
  } catch (error) {
    console.error("[auth-refresh] Re-authentication failed:", error);
    return false;
  } finally {
    await browser.close();
  }
}

/**
 * Ensures the current Playwright page context is authenticated.
 * If redirected to login, performs an in-context password login.
 */
export async function ensureAuthenticatedInPage(page: Page): Promise<boolean> {
  if (page.isClosed()) {
    return false;
  }

  const currentUrl = page.url();
  const authUiVisible = await isAuthUiVisible(page);

  // Fast path: worker-auth contexts with fresh tokens do not need auth-route probing
  // on every test hook. This keeps beforeEach hooks short and avoids unnecessary login UI churn.
  if (
    !isInitialPageUrl(currentUrl) &&
    !isAuthRoute(currentUrl) &&
    !authUiVisible &&
    !isAuthStale()
  ) {
    const settled = await waitForRouteSettled(page, 3000);
    if (settled) {
      return true;
    }
  }

  const openedLogin = await safeGoto(page, "/login", {
    attempts: 1,
    timeoutMs: AUTH_PROBE_TIMEOUT_MS,
    label: "/login auth probe",
  });
  if (!openedLogin) {
    // If probe navigation itself fails, only treat as authenticated when current page is clearly ready.
    if (!isAuthRoute(page.url())) {
      const settled = await waitForRouteSettled(page, Math.min(AUTH_PROBE_TIMEOUT_MS, 6000));
      if (settled) {
        return true;
      }
    }
    console.warn("[auth-refresh] Could not open /login during in-page authentication probe");
    return false;
  }

  // Existing authenticated sessions may redirect away from /login shortly after navigation.
  const autoRecovered = await waitForAuthenticatedLanding(
    page,
    Math.min(AUTH_PROBE_TIMEOUT_MS, 6000)
  );
  if (autoRecovered && !isAuthRoute(page.url())) {
    const settled = await waitForRouteSettled(page, Math.min(NAV_TIMEOUT_MS, 12000));
    if (settled) {
      return true;
    }
  }

  const state = getState();
  if (!state) {
    console.warn("[auth-refresh] No test state found - cannot login in current page");
    return false;
  }

  try {
    const loggedIn = await performPasswordLogin(page, state);
    if (!loggedIn) {
      console.warn("[auth-refresh] In-page login stayed on auth route");
      return false;
    }
    await page.context().storageState({ path: getAuthStatePath() });
    return true;
  } catch (error) {
    console.error("[auth-refresh] In-page authentication failed:", error);
    return false;
  }
}

/**
 * Navigates to a path and recovers auth in the current page context if needed.
 */
export async function gotoWithAuthRecovery(page: Page, path: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const navigated = await safeGoto(page, path, {
      attempts: 2,
      timeoutMs: NAV_TIMEOUT_MS,
      label: path,
    });
    if (!navigated) {
      continue;
    }

    const redirectedToAuth = await waitForAuthRedirect(page);
    const authUiVisible = await isAuthUiVisible(page);
    if (!redirectedToAuth && !isAuthRoute(page.url()) && !authUiVisible) {
      const settled = await waitForRouteSettled(page, Math.min(NAV_TIMEOUT_MS, 12000));
      if (settled) {
        const lateAuthRedirect = await waitForAuthRedirect(page, LATE_AUTH_REDIRECT_TIMEOUT_MS);
        const suspiciousBlank = await isSuspiciousBlankPage(page);
        if (
          !lateAuthRedirect &&
          !suspiciousBlank &&
          !(await isRouteErrorBoundaryVisible(page)) &&
          !(await isAuthUiVisible(page))
        ) {
          return;
        }
        if (suspiciousBlank) {
          console.warn(`[auth-refresh] Route ${path} rendered a blank shell; attempting recovery`);
        }
        console.warn(`[auth-refresh] Route ${path} hit app error boundary; attempting recovery`);
      } else {
        console.warn(
          `[auth-refresh] Route ${path} stayed in loading state; retrying with auth recovery`
        );
      }

      const recovered = await attemptInPageRouteRecovery(page, path);
      if (recovered) {
        return;
      }
    }

    const ok = await ensureAuthenticatedInPage(page);
    if (!ok) {
      throw new Error(
        `[auth-refresh] Could not authenticate current page for ${path} (attempt ${attempt + 1}/3)`
      );
    }
  }

  const finalNavigated = await safeGoto(page, path, {
    attempts: 3,
    timeoutMs: NAV_TIMEOUT_MS,
    label: `${path} (final)`,
  });
  if (!finalNavigated) {
    throw new Error(`[auth-refresh] Route ${path} could not be opened after recovery`);
  }
  if ((await waitForAuthRedirect(page)) || (await isAuthUiVisible(page))) {
    throw new Error(`[auth-refresh] Route ${path} redirected to auth after recovery`);
  }
  const settled = await waitForRouteSettled(page, Math.min(NAV_TIMEOUT_MS, 15000));
  const lateAuthRedirect = await waitForAuthRedirect(page, LATE_AUTH_REDIRECT_TIMEOUT_MS);
  const suspiciousBlank = await isSuspiciousBlankPage(page);
  if (
    settled &&
    !lateAuthRedirect &&
    !suspiciousBlank &&
    !(await isRouteErrorBoundaryVisible(page)) &&
    !(await isAuthUiVisible(page))
  ) {
    return;
  }
  const recovered = await attemptInPageRouteRecovery(page, path);
  if (recovered) {
    return;
  }
  if (!settled) {
    throw new Error(`[auth-refresh] Route ${path} did not leave loading state after recovery`);
  }
  throw new Error(`[auth-refresh] Route ${path} hit an unrecovered app error boundary`);
}
