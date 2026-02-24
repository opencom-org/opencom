#!/usr/bin/env tsx
/**
 * Web App Screenshot Capture
 *
 * Seeds a demo workspace via the signup flow, navigates key surfaces of the
 * web app, and captures screenshots using Playwright.
 *
 * Prerequisites:
 *   - pnpm dev:web running on http://localhost:3000  (or set BASE_URL)
 *   - Convex backend accessible (uses NEXT_PUBLIC_CONVEX_URL or default)
 *   - ALLOW_TEST_DATA=true on the Convex server env
 *
 * Usage:
 *   npx tsx scripts/screenshots/capture-web.ts
 */

import { chromium, type Locator, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { ensureOutputDir, writeManifest, entry, type ScreenshotEntry } from "./manifest";
import { callMutation } from "./seed";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const BACKEND_URL = process.env.E2E_BACKEND_URL || process.env.NEXT_PUBLIC_CONVEX_URL;

const DEMO_EMAIL = process.env.DEMO_EMAIL || `demo_${Date.now()}@opencom.dev`;
const DEMO_PASSWORD = "DemoPassword123!";
const DEMO_NAME = "Demo User";
const DEMO_WORKSPACE = `Demo Org ${Date.now()}`;
const SEED_DATA = process.env.SEED_DATA === "true";
const NAV_TIMEOUT_MS = 60000;

interface RouteConfig {
  name: string;
  path: string;
}

type IssueSeverity = "actionable" | "benign";
type IssueCategory = "pageerror" | "console" | "network" | "navigation_abort";

interface CapturedIssue {
  route: string;
  type: "console:error" | "console:warning" | "pageerror" | "requestfailed";
  message: string;
  url?: string;
  timestamp: string;
  severity: IssueSeverity;
  category: IssueCategory;
}

interface RouteResult {
  name: string;
  path: string;
  screenshotPath?: string;
  status: "ok" | "failed";
  error?: string;
  issueCount: number;
  appErrorVisible: boolean;
  discoveredRoutes: string[];
}

interface RouteReadyConfig {
  pattern: RegExp;
  selectors: string[];
}

// Static route coverage across the app.
const PAGES: RouteConfig[] = [
  { name: "home", path: "/" },
  { name: "login", path: "/login" },
  { name: "signup", path: "/signup" },
  { name: "help", path: "/help" },
  { name: "inbox", path: "/inbox" },
  { name: "tickets", path: "/tickets" },
  { name: "tickets-forms", path: "/tickets/forms" },
  { name: "knowledge", path: "/knowledge" },
  { name: "knowledge-internal-new", path: "/knowledge/internal/new" },
  { name: "articles", path: "/articles" },
  { name: "articles-collections", path: "/articles/collections" },
  { name: "outbound", path: "/outbound" },
  { name: "tours", path: "/tours" },
  { name: "surveys", path: "/surveys" },
  { name: "checklists", path: "/checklists" },
  { name: "tooltips", path: "/tooltips" },
  { name: "campaigns", path: "/campaigns" },
  { name: "reports", path: "/reports" },
  { name: "reports-ai", path: "/reports/ai" },
  { name: "reports-conversations", path: "/reports/conversations" },
  { name: "reports-csat", path: "/reports/csat" },
  { name: "reports-team", path: "/reports/team" },
  { name: "settings", path: "/settings" },
  { name: "snippets", path: "/snippets" },
  { name: "segments", path: "/segments" },
  { name: "visitors", path: "/visitors" },
  { name: "audit-logs", path: "/audit-logs" },
  { name: "widget-demo", path: "/widget-demo" },
];

const DETAIL_ROUTE_PATTERNS: RegExp[] = [
  /^\/visitors\/[a-z0-9]+$/i,
  /^\/campaigns\/(carousels|email|push|series)\/[a-z0-9]+$/i,
  /^\/tickets\/(?!forms$)[a-z0-9]+$/i,
  /^\/surveys\/[a-z0-9]+$/i,
  /^\/tours\/[a-z0-9]+$/i,
  /^\/outbound\/[a-z0-9]+$/i,
  /^\/checklists\/[a-z0-9]+$/i,
  /^\/articles\/(?!collections$|new$)[a-z0-9]+$/i,
  /^\/knowledge\/internal\/(?!new$)[a-z0-9]+$/i,
  /^\/visitors\/[a-z0-9]+$/i,
  /^\/campaigns\/(carousels|email|push|series)\/[a-z0-9]+$/i,
];

const ROUTE_READY_SELECTORS: RouteReadyConfig[] = [
  {
    pattern: /^\/$/,
    selectors: ['h1:has-text("Welcome to Opencom")', 'a:has-text("Get Started")'],
  },
  {
    pattern: /^\/login$/,
    selectors: ['h1:has-text("Log in")', 'button:has-text("Continue with")'],
  },
  {
    pattern: /^\/signup$/,
    selectors: ['button:has-text("Sign Up")', 'label:has-text("Backend URL")'],
  },
  {
    pattern: /^\/articles$/,
    selectors: ['h1:has-text("Articles")'],
  },
  {
    pattern: /^\/articles\/collections$/,
    selectors: ['h1:has-text("Collections")'],
  },
  {
    pattern: /^\/articles\/(?!collections$|new$)[a-z0-9]+$/i,
    selectors: ['label:has-text("Title")', 'button:has-text("Save")'],
  },
  {
    pattern: /^\/knowledge\/internal\/new$/,
    selectors: ['h1:has-text("New Internal Article")', 'button:has-text("Save Draft")'],
  },
  {
    pattern: /^\/knowledge\/internal\/(?!new$)[a-z0-9]+$/i,
    selectors: ['h1:has-text("Edit Internal Article")', 'button:has-text("Save")'],
  },
  {
    pattern: /^\/surveys$/,
    selectors: ['h1:has-text("Surveys")'],
  },
  {
    pattern: /^\/surveys\/[a-z0-9]+$/i,
    selectors: ['button[data-testid="survey-tab-builder"]', 'button:has-text("Save")'],
  },
  {
    pattern: /^\/tours$/,
    selectors: ['h1:has-text("Product Tours")'],
  },
  {
    pattern: /^\/tours\/[a-z0-9]+$/i,
    selectors: ['button:has-text("Add Step")', 'input[placeholder*="Welcome Tour"]'],
  },
  {
    pattern: /^\/checklists$/,
    selectors: ['h1:has-text("Checklists")'],
  },
  {
    pattern: /^\/checklists\/[a-z0-9]+$/i,
    selectors: ['h1:has-text("Edit Checklist")', 'button:has-text("Save")'],
  },
  {
    pattern: /^\/outbound$/,
    selectors: ['h1:has-text("Outbound Messages")'],
  },
  {
    pattern: /^\/outbound\/[a-z0-9]+$/i,
    selectors: ['h1:has-text("Message")', 'button:has-text("Save")'],
  },
  {
    pattern: /^\/tooltips$/,
    selectors: ['[data-testid="tooltips-page-heading"]'],
  },
  {
    pattern: /^\/tickets\/forms$/,
    selectors: ['h2:has-text("Ticket Forms")', 'button:has-text("Create Form")'],
  },
  {
    pattern: /^\/reports\/csat$/,
    selectors: ['[data-testid="csat-report-heading"]', 'h1:has-text("CSAT Report")'],
  },
  {
    pattern: /^\/reports\/team$/,
    selectors: ['h1:has-text("Team Performance")'],
  },
];

const ROUTE_SETTLE_TIMEOUT_MS = 20000;

function sanitizeName(value: string): string {
  return value
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase();
}

function getPathnameFromUrl(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function getReadySelectorsForRoute(routePath: string): string[] {
  const normalizedRoute = routePath.split("?")[0].split("#")[0];
  const matched = ROUTE_READY_SELECTORS.find((candidate) =>
    candidate.pattern.test(normalizedRoute)
  );
  return matched?.selectors ?? [];
}

function isBenignNavigationAbort(message: string, url?: string): boolean {
  if (!url) {
    return false;
  }

  const normalizedMessage = message.toLowerCase();
  const normalizedUrl = url.toLowerCase();
  return normalizedMessage.includes("err_aborted") && normalizedUrl.includes("_rsc=");
}

function isActionableIssue(issue: CapturedIssue): boolean {
  return issue.severity === "actionable";
}

function countActionableIssues(issues: CapturedIssue[], startIndex: number): number {
  return issues.slice(startIndex).filter(isActionableIssue).length;
}

async function waitForAnySelectorVisible(
  page: Page,
  selectors: string[],
  timeoutMs = 9000
): Promise<boolean> {
  if (selectors.length === 0) {
    return false;
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const visible = await page
        .locator(selector)
        .first()
        .isVisible({ timeout: 250 })
        .catch(() => false);
      if (visible) {
        return true;
      }
    }

    await page.waitForTimeout(250);
  }

  return false;
}

async function hasBlockingLoadingState(page: Page): Promise<boolean> {
  return page
    .evaluate(() => {
      const body = document.body;
      if (!body) {
        return false;
      }

      const normalizedBodyText = body.innerText.replace(/\s+/g, " ").trim().toLowerCase();
      if (normalizedBodyText === "loading" || normalizedBodyText === "loading...") {
        return true;
      }

      const loadingTextNodes = Array.from(
        document.querySelectorAll<HTMLElement>("h1, h2, h3, p, div, span")
      );
      const hasLargeLoadingText = loadingTextNodes.some((node) => {
        const text = (node.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        if (text !== "loading" && text !== "loading...") {
          return false;
        }

        const style = window.getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
          return false;
        }

        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          return false;
        }

        const viewportArea = window.innerWidth * window.innerHeight;
        return rect.width * rect.height >= viewportArea * 0.12;
      });

      if (hasLargeLoadingText) {
        return true;
      }

      const loadingSpinners = Array.from(
        document.querySelectorAll<HTMLElement>(".animate-spin, [role='progressbar']")
      );
      return loadingSpinners.some((spinner) => {
        const style = window.getComputedStyle(spinner);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
          return false;
        }
        const rect = spinner.getBoundingClientRect();
        const viewportArea = window.innerWidth * window.innerHeight;
        return rect.width * rect.height >= viewportArea * 0.05;
      });
    })
    .catch(() => false);
}

async function waitForPageSettled(page: Page, routePath: string): Promise<void> {
  const readySelectors = getReadySelectorsForRoute(routePath);

  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});

  if (readySelectors.length > 0) {
    await waitForAnySelectorVisible(page, readySelectors, 11000).catch(() => false);
  }

  const deadline = Date.now() + ROUTE_SETTLE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const stillLoading = await hasBlockingLoadingState(page);
    if (!stillLoading) {
      return;
    }
    await page.waitForTimeout(300);
  }
}

async function gotoRoute(page: Page, routePath: string): Promise<void> {
  await page.goto(`${BASE_URL}${routePath}`, {
    timeout: NAV_TIMEOUT_MS,
    waitUntil: "domcontentloaded",
  });
  await waitForPageSettled(page, routePath);
}

async function gotoRouteWithRetry(page: Page, routePath: string, attempts = 3): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await gotoRoute(page, routePath);
      const appErrorVisible = await hasAppError(page);
      if (!appErrorVisible) {
        return;
      }
      lastError = new Error(`App error/404 visible on ${routePath}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts) {
      await page.waitForTimeout(1200 * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to open ${routePath}`);
}

async function waitForSignupSurface(page: Page): Promise<boolean> {
  const hasNameInput = await page
    .getByLabel("Name", { exact: true })
    .isVisible({ timeout: 1200 })
    .catch(() => false);
  if (hasNameInput) {
    return true;
  }

  const hasBackendSelector = await page
    .getByLabel(/backend url/i)
    .isVisible({ timeout: 1200 })
    .catch(() => false);

  return hasBackendSelector;
}

async function hasAppError(page: Page): Promise<boolean> {
  const appErrorHeading = page
    .getByRole("heading", {
      name: /application error|runtime error|this page could not be found|404/i,
    })
    .first();
  return appErrorHeading.isVisible({ timeout: 1000 }).catch(() => false);
}

async function discoverDynamicRoutes(page: Page): Promise<string[]> {
  const hrefs = await page
    .locator("a[href]")
    .evaluateAll((links) =>
      links.map((link) => (link as HTMLAnchorElement).getAttribute("href") || "").filter(Boolean)
    )
    .catch(() => [] as string[]);

  const routes = new Set<string>();

  for (const href of hrefs) {
    try {
      const url = new URL(href, BASE_URL);
      if (url.origin !== new URL(BASE_URL).origin) {
        continue;
      }
      const routePath = url.pathname;
      if (DETAIL_ROUTE_PATTERNS.some((pattern) => pattern.test(routePath))) {
        routes.add(routePath);
      }
    } catch {
      // ignore invalid hrefs
    }
  }

  return Array.from(routes);
}

async function run() {
  const outDir = ensureOutputDir("web");
  const entries: ScreenshotEntry[] = [];
  const routeResults: RouteResult[] = [];
  const capturedIssues: CapturedIssue[] = [];

  console.log("📸 Web App Screenshot Capture");
  console.log(`   Base URL : ${BASE_URL}`);
  console.log(`   Output   : ${outDir}\n`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  let activeRoute = "startup";

  page.on("pageerror", (error) => {
    capturedIssues.push({
      route: activeRoute,
      type: "pageerror",
      message: error.message,
      timestamp: new Date().toISOString(),
      severity: "actionable",
      category: "pageerror",
    });
  });

  page.on("console", (msg) => {
    if (msg.type() !== "error" && msg.type() !== "warning") {
      return;
    }
    capturedIssues.push({
      route: activeRoute,
      type: msg.type() === "error" ? "console:error" : "console:warning",
      message: msg.text(),
      timestamp: new Date().toISOString(),
      severity: "actionable",
      category: "console",
    });
  });

  page.on("requestfailed", (request) => {
    const message = request.failure()?.errorText || "Request failed";
    const url = request.url();
    const benignNavigationAbort = isBenignNavigationAbort(message, url);

    capturedIssues.push({
      route: activeRoute,
      type: "requestfailed",
      message,
      url,
      timestamp: new Date().toISOString(),
      severity: benignNavigationAbort ? "benign" : "actionable",
      category: benignNavigationAbort ? "navigation_abort" : "network",
    });
  });

  try {
    // ── Sign up / log in ────────────────────────────────────────────
    console.log("1️⃣  Signing up demo user...");
    let signupReady = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      await gotoRoute(page, "/signup");

      // Give dev server/HMR a moment if route just compiled.
      await page.waitForTimeout(800);
      let signupSurfaceVisible = await waitForSignupSurface(page);

      if (!signupSurfaceVisible) {
        await gotoRoute(page, "/signup");
        await page.waitForTimeout(1200);
        signupSurfaceVisible = await waitForSignupSurface(page);
      }

      if (!signupSurfaceVisible) {
        if (attempt < 3) {
          console.warn(`   ⚠️  Signup surface unavailable (attempt ${attempt}/3), retrying...`);
          await page.waitForTimeout(1500 * attempt);
          continue;
        }
        throw new Error("Signup route did not render expected form/backend selector.");
      }

      // Connect backend if needed (dev mode)
      const backendInput = page.getByLabel(/backend url/i);
      if (await backendInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        if (!BACKEND_URL) {
          throw new Error(
            "Backend selector is visible but E2E_BACKEND_URL/NEXT_PUBLIC_CONVEX_URL is not set."
          );
        }
        await backendInput.fill(BACKEND_URL);
        await page.getByRole("button", { name: /connect/i }).click();
        await page.waitForTimeout(2500);
      }

      // Switch to password signup if magic-code is default
      const pwBtn = page.getByRole("button", { name: /sign up with password/i });
      if (await pwBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await pwBtn.click();
        await page.waitForTimeout(1200);
      }

      const nameInputVisible = await page
        .getByLabel("Name", { exact: true })
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (nameInputVisible) {
        signupReady = true;
        break;
      }

      if (attempt < 3) {
        console.warn(`   ⚠️  Signup form not ready (attempt ${attempt}/3), retrying...`);
        await page.waitForTimeout(1500 * attempt);
      }
    }

    if (!signupReady) {
      throw new Error("Signup form did not become available after retries.");
    }

    await page.getByLabel("Name", { exact: true }).fill(DEMO_NAME);
    await page.getByLabel("Email", { exact: true }).fill(DEMO_EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);

    const wsField = page.getByLabel(/workspace name/i);
    if (await wsField.isVisible({ timeout: 1000 }).catch(() => false)) {
      await wsField.fill(DEMO_WORKSPACE);
    }

    await page.getByRole("button", { name: /create account|sign up/i }).click();
    await page.waitForURL(/inbox|dashboard/, { timeout: 30000 });
    console.log("   ✅ Demo workspace created\n");

    // ── Extract workspace ID ─────────────────────────────────────────
    await page.waitForTimeout(2000);
    const workspaceId = await page.evaluate(() => {
      const stored = localStorage.getItem("opencom_active_workspace");
      if (stored) {
        try {
          return JSON.parse(stored)._id || "";
        } catch {
          return "";
        }
      }
      return "";
    });

    // ── Seed demo data ──────────────────────────────────────────────
    if (SEED_DATA && workspaceId) {
      console.log(`2️⃣  Seeding demo data (workspace: ${workspaceId})...`);
      try {
        const result = await callMutation(BACKEND_URL ?? "", "testData:seedDemoData", {
          workspaceId,
        });
        console.log("   ✅ Seeded:", result);
        // Wait for data to propagate
        await page.waitForTimeout(3000);
      } catch (err) {
        console.warn("   ⚠️  Seed failed (continuing without data):", err);
      }
    } else if (SEED_DATA) {
      console.log("2️⃣  ⚠️  SEED_DATA=true but no workspace ID found — skipping seed");
    } else {
      console.log("2️⃣  Skipping data seed (set SEED_DATA=true to populate demo data)");
    }

    // ── Capture screenshots ─────────────────────────────────────────
    console.log("3️⃣  Capturing screenshots...");

    const dynamicQueue = new Set<string>();

    const waitForAnyVisibleLocator = async (
      locators: Locator[],
      timeoutMs = 8000
    ): Promise<Locator | null> => {
      if (locators.length === 0) {
        return null;
      }

      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        for (const locator of locators) {
          const visible = await locator.isVisible({ timeout: 250 }).catch(() => false);
          if (visible) {
            return locator;
          }
        }

        await page.waitForTimeout(250);
      }

      return null;
    };

    const clickFirstVisible = async (locators: Locator[], timeoutMs = 8000): Promise<boolean> => {
      const target = await waitForAnyVisibleLocator(locators, timeoutMs);
      if (!target) {
        return false;
      }

      await target.click();
      return true;
    };

    const fillFirstVisible = async (
      locators: Locator[],
      value: string,
      timeoutMs = 8000
    ): Promise<boolean> => {
      const target = await waitForAnyVisibleLocator(locators, timeoutMs);
      if (!target) {
        return false;
      }

      await target.fill(value);
      return true;
    };

    const captureScenarioShot = async (name: string): Promise<void> => {
      const issueStart = capturedIssues.length;
      const currentPath = getPathnameFromUrl(page.url());
      activeRoute = currentPath;

      await waitForPageSettled(page, currentPath);

      const appErrorVisible = await hasAppError(page);
      const discoveredRoutes = await discoverDynamicRoutes(page);
      for (const discovered of discoveredRoutes) {
        dynamicQueue.add(discovered);
      }

      const fileName = `web-${sanitizeName(name)}.png`;
      const filePath = path.join(outDir, fileName);
      await page.screenshot({ path: filePath, fullPage: false });

      entries.push(entry("web", name, filePath));
      routeResults.push({
        name,
        path: currentPath,
        screenshotPath: filePath,
        status: "ok",
        issueCount: countActionableIssues(capturedIssues, issueStart),
        appErrorVisible,
        discoveredRoutes,
      });
      console.log(`   📷 ${name} (${currentPath})`);
    };

    const runCreationScenario = async (
      scenarioName: string,
      action: () => Promise<void>
    ): Promise<void> => {
      const issueStart = capturedIssues.length;
      activeRoute = `scenario:${scenarioName}`;

      try {
        await action();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        routeResults.push({
          name: `scenario:${scenarioName}`,
          path: `scenario:${scenarioName}`,
          status: "failed",
          error: message,
          issueCount: countActionableIssues(capturedIssues, issueStart),
          appErrorVisible: false,
          discoveredRoutes: [],
        });
        console.warn(`   ⚠️  scenario:${scenarioName} failed: ${message}`);
      }
    };

    const captureRoute = async (route: RouteConfig): Promise<void> => {
      const issueStart = capturedIssues.length;
      activeRoute = route.path;

      try {
        await gotoRoute(page, route.path);

        const appErrorVisible = await hasAppError(page);
        const discoveredRoutes = await discoverDynamicRoutes(page);
        for (const discovered of discoveredRoutes) {
          dynamicQueue.add(discovered);
        }

        const fileName = `web-${sanitizeName(route.name)}.png`;
        const filePath = path.join(outDir, fileName);
        await page.screenshot({ path: filePath, fullPage: false });

        entries.push(entry("web", route.name, filePath));
        routeResults.push({
          name: route.name,
          path: route.path,
          screenshotPath: filePath,
          status: "ok",
          issueCount: countActionableIssues(capturedIssues, issueStart),
          appErrorVisible,
          discoveredRoutes,
        });
        console.log(`   📷 ${route.name} (${route.path})`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        routeResults.push({
          name: route.name,
          path: route.path,
          status: "failed",
          error: message,
          issueCount: countActionableIssues(capturedIssues, issueStart),
          appErrorVisible: false,
          discoveredRoutes: [],
        });
        console.warn(`   ⚠️  ${route.name} failed: ${message}`);
      }
    };

    for (const pg of PAGES) {
      await captureRoute(pg);
    }

    // ── Capture creation/edit flows ─────────────────────────────────
    console.log("4️⃣  Capturing create/edit flows...");

    await runCreationScenario("collections-create", async () => {
      await gotoRouteWithRetry(page, "/articles/collections", 2);

      const openedModal = await clickFirstVisible(
        [page.getByRole("button", { name: /new collection|create collection/i }).first()],
        10000
      );
      if (!openedModal) {
        throw new Error("Could not find New Collection button.");
      }

      const collectionModal = page
        .locator("div.fixed.inset-0")
        .filter({ has: page.getByPlaceholder(/collection name/i).first() })
        .first();
      await collectionModal.waitFor({ state: "visible", timeout: 8000 });

      const collectionName = `Scenario Collection ${Date.now()}`;
      const filledName = await fillFirstVisible(
        [
          collectionModal.getByLabel("Name", { exact: true }).first(),
          collectionModal.getByPlaceholder(/collection name/i).first(),
        ],
        collectionName,
        8000
      );
      if (!filledName) {
        throw new Error("Could not find collection name field.");
      }

      await fillFirstVisible(
        [
          collectionModal.getByPlaceholder(/optional description/i).first(),
          collectionModal.locator("textarea").first(),
        ],
        "Created by screenshot automation scenario.",
        4000
      );

      const saved = await clickFirstVisible(
        [
          collectionModal.getByRole("button", { name: /create collection|save changes/i }).first(),
          collectionModal.getByRole("button", { name: /^create$/i }).first(),
        ],
        8000
      );
      if (!saved) {
        throw new Error("Could not submit collection form.");
      }

      await page.waitForTimeout(1200);
      await captureScenarioShot("scenario-collection-created");
    });

    await runCreationScenario("articles-save-publish", async () => {
      await gotoRouteWithRetry(page, "/articles", 2);

      const openedEditor = await clickFirstVisible(
        [page.getByRole("button", { name: /new article|create article/i }).first()],
        10000
      );
      if (!openedEditor) {
        throw new Error("Could not find New Article button.");
      }

      await page.waitForURL(/\/articles\/[a-z0-9]+$/i, { timeout: 25000 });
      await waitForPageSettled(page, getPathnameFromUrl(page.url()));

      const articleTitle = `Scenario Article ${Date.now()}`;
      const titleFilled = await fillFirstVisible(
        [
          page.getByLabel(/title/i).first(),
          page.getByPlaceholder(/article title/i).first(),
          page.locator("main input[type='text']").first(),
        ],
        articleTitle,
        8000
      );
      if (!titleFilled) {
        throw new Error("Could not find article title input.");
      }

      await fillFirstVisible(
        [page.locator("textarea").first()],
        "Article created by screenshot capture flow.",
        5000
      );

      const saveClicked = await clickFirstVisible(
        [page.getByRole("button", { name: /^save$/i }).first()],
        8000
      );
      if (!saveClicked) {
        throw new Error("Could not find Save button in article editor.");
      }

      await page.waitForTimeout(1200);
      await captureScenarioShot("scenario-article-saved");

      const publishClicked = await clickFirstVisible(
        [page.getByRole("button", { name: /^publish$/i }).first()],
        7000
      );
      if (publishClicked) {
        await waitForAnyVisibleLocator(
          [
            page.getByRole("button", { name: /unpublish/i }).first(),
            page.getByText(/\bpublished\b/i).first(),
          ],
          12000
        );
        await captureScenarioShot("scenario-article-published");
      }
    });

    await runCreationScenario("internal-article-save-publish", async () => {
      await gotoRouteWithRetry(page, "/knowledge/internal/new", 2);

      const titleFilled = await fillFirstVisible(
        [
          page.getByPlaceholder(/article title/i).first(),
          page.locator("input[type='text']").first(),
        ],
        `Internal Scenario Article ${Date.now()}`,
        9000
      );
      if (!titleFilled) {
        throw new Error("Could not find internal article title input.");
      }

      await fillFirstVisible(
        [page.locator("textarea").first()],
        "Internal article content created by screenshot flow.",
        5000
      );

      const saveDraftClicked = await clickFirstVisible(
        [page.getByRole("button", { name: /save draft/i }).first()],
        8000
      );
      if (!saveDraftClicked) {
        throw new Error("Could not find Save Draft button.");
      }

      await page.waitForURL(/\/knowledge\/internal\/[a-z0-9]+$/i, { timeout: 25000 });
      await captureScenarioShot("scenario-internal-article-saved");

      const publishClicked = await clickFirstVisible(
        [page.getByRole("button", { name: /^publish$/i }).first()],
        7000
      );
      if (publishClicked) {
        await waitForAnyVisibleLocator(
          [
            page.getByRole("button", { name: /unpublish/i }).first(),
            page.getByText(/\bpublished\b/i).first(),
          ],
          12000
        );
        await captureScenarioShot("scenario-internal-article-published");
      }
    });

    await runCreationScenario("surveys-create-activate", async () => {
      await gotoRouteWithRetry(page, "/surveys", 2);

      const openedSurvey = await clickFirstVisible(
        [page.getByRole("button", { name: /new survey|create survey/i }).first()],
        10000
      );
      if (!openedSurvey) {
        throw new Error("Could not find New Survey button.");
      }

      await page.waitForURL(/\/surveys\/[a-z0-9]+$/i, { timeout: 25000 });
      await waitForPageSettled(page, getPathnameFromUrl(page.url()));

      await fillFirstVisible(
        [page.getByPlaceholder(/survey name/i).first(), page.locator("header input").first()],
        `Scenario Survey ${Date.now()}`,
        6000
      );

      const questionCountText = await page
        .getByText(/questions\s*\(\d+\/\d+\)/i)
        .first()
        .textContent()
        .catch(() => "");

      if (/questions\s*\(0\/\d+\)/i.test(questionCountText || "")) {
        const addedQuestion = await clickFirstVisible(
          [
            page.getByRole("button", { name: /^nps/i }).first(),
            page.getByRole("button", { name: /numeric scale/i }).first(),
          ],
          7000
        );
        if (!addedQuestion) {
          throw new Error("Could not add an initial survey question before activation.");
        }

        await fillFirstVisible(
          [page.getByPlaceholder(/enter your question/i).first()],
          "How likely are you to recommend Opencom to a friend?",
          6000
        );
      }

      await clickFirstVisible([page.getByRole("button", { name: /^save$/i }).first()], 7000);
      await captureScenarioShot("scenario-survey-saved");

      const activated = await clickFirstVisible(
        [page.getByRole("button", { name: /activate/i }).first()],
        5000
      );
      if (activated) {
        await waitForAnyVisibleLocator(
          [page.getByRole("button", { name: /pause/i }).first()],
          10000
        );
        await captureScenarioShot("scenario-survey-activated");
      }
    });

    await runCreationScenario("tours-create-activate", async () => {
      await gotoRouteWithRetry(page, "/tours", 2);

      const openedTour = await clickFirstVisible(
        [page.getByRole("button", { name: /new tour|create tour/i }).first()],
        10000
      );
      if (!openedTour) {
        throw new Error("Could not find New Tour button.");
      }

      await page.waitForURL(/\/tours\/[a-z0-9]+$/i, { timeout: 25000 });
      await waitForPageSettled(page, getPathnameFromUrl(page.url()));

      await fillFirstVisible(
        [page.getByLabel(/tour name/i).first(), page.getByPlaceholder(/welcome tour/i).first()],
        `Scenario Tour ${Date.now()}`,
        6000
      );

      await clickFirstVisible([page.getByRole("button", { name: /^save$/i }).first()], 7000);
      await captureScenarioShot("scenario-tour-saved");

      const activated = await clickFirstVisible(
        [page.getByRole("button", { name: /activate/i }).first()],
        5000
      );
      if (activated) {
        await waitForAnyVisibleLocator(
          [page.getByRole("button", { name: /deactivate/i }).first()],
          10000
        );
        await captureScenarioShot("scenario-tour-activated");
      }
    });

    await runCreationScenario("checklists-create-activate", async () => {
      await gotoRouteWithRetry(page, "/checklists", 2);

      const openedChecklist = await clickFirstVisible(
        [page.getByRole("button", { name: /new checklist|create checklist/i }).first()],
        10000
      );
      if (!openedChecklist) {
        throw new Error("Could not find New Checklist button.");
      }

      await page.waitForURL(/\/checklists\/[a-z0-9]+$/i, { timeout: 25000 });
      await waitForPageSettled(page, getPathnameFromUrl(page.url()));

      await fillFirstVisible(
        [page.getByPlaceholder(/checklist name/i).first()],
        `Scenario Checklist ${Date.now()}`,
        6000
      );

      await clickFirstVisible([page.getByRole("button", { name: /^save$/i }).first()], 7000);
      await captureScenarioShot("scenario-checklist-saved");

      const activated = await clickFirstVisible(
        [page.getByRole("button", { name: /activate/i }).first()],
        5000
      );
      if (activated) {
        await waitForAnyVisibleLocator(
          [page.getByRole("button", { name: /deactivate/i }).first()],
          10000
        );
        await captureScenarioShot("scenario-checklist-activated");
      }
    });

    await runCreationScenario("outbound-chat-create-activate", async () => {
      await gotoRouteWithRetry(page, "/outbound", 2);

      const openedMessage = await clickFirstVisible(
        [
          page.getByRole("button", { name: /^chat$/i }).first(),
          page.getByRole("button", { name: /chat message/i }).first(),
        ],
        10000
      );
      if (!openedMessage) {
        throw new Error("Could not find Chat message button.");
      }

      await page.waitForURL(/\/outbound\/[a-z0-9]+$/i, { timeout: 25000 });
      await waitForPageSettled(page, getPathnameFromUrl(page.url()));

      await fillFirstVisible(
        [page.getByPlaceholder(/message name/i).first()],
        `Scenario Outbound ${Date.now()}`,
        7000
      );

      await fillFirstVisible(
        [
          page.getByPlaceholder(/enter your chat message/i).first(),
          page.locator("textarea").first(),
        ],
        "Proactive message created by screenshot flow.",
        6000
      );

      await clickFirstVisible([page.getByRole("button", { name: /^save$/i }).first()], 8000);
      await captureScenarioShot("scenario-outbound-saved");

      const activated = await clickFirstVisible(
        [page.getByRole("button", { name: /activate/i }).first()],
        5000
      );
      if (activated) {
        await waitForAnyVisibleLocator(
          [page.getByRole("button", { name: /pause/i }).first()],
          10000
        );
        await captureScenarioShot("scenario-outbound-activated");
      }
    });

    await runCreationScenario("tooltips-create", async () => {
      await gotoRouteWithRetry(page, "/tooltips", 2);

      const openedModal = await clickFirstVisible([page.getByTestId("tooltips-new-button")], 10000);
      if (!openedModal) {
        throw new Error("Could not open tooltip creation modal.");
      }

      await fillFirstVisible(
        [page.getByTestId("tooltip-name-input")],
        `Scenario Tooltip ${Date.now()}`,
        6000
      );
      await fillFirstVisible([page.getByTestId("tooltip-selector-input")], "#tour-target-1", 6000);
      await fillFirstVisible(
        [page.getByTestId("tooltip-content-input")],
        "Tooltip content created by screenshot flow.",
        6000
      );

      const saved = await clickFirstVisible([page.getByTestId("tooltip-save-button")], 8000);
      if (!saved) {
        throw new Error("Could not save tooltip.");
      }

      await waitForAnyVisibleLocator(
        [page.locator("[data-testid^='tooltip-card-']").first()],
        10000
      );
      await captureScenarioShot("scenario-tooltip-created");
    });

    await runCreationScenario("ticket-forms-create-save", async () => {
      await gotoRouteWithRetry(page, "/tickets/forms", 2);

      const openedForm = await clickFirstVisible(
        [
          page.getByRole("button", { name: /create form/i }).first(),
          page.locator(".w-80 button").last(),
        ],
        10000
      );
      if (!openedForm) {
        throw new Error("Could not find Create Form action.");
      }

      const filledName = await fillFirstVisible(
        [page.getByPlaceholder(/form name/i).first()],
        `Scenario Ticket Form ${Date.now()}`,
        8000
      );
      if (!filledName) {
        throw new Error("Could not find ticket form name input.");
      }

      const saved = await clickFirstVisible(
        [page.getByRole("button", { name: /^save$/i }).first()],
        8000
      );
      if (!saved) {
        throw new Error("Could not save ticket form.");
      }

      await page.waitForTimeout(1000);
      await captureScenarioShot("scenario-ticket-form-saved");
    });

    // Capture discovered dynamic detail routes.
    const discoveredRoutes = Array.from(dynamicQueue).sort();
    if (discoveredRoutes.length > 0) {
      console.log(`5️⃣  Capturing discovered detail routes (${discoveredRoutes.length})...`);
    }
    for (const dynamicPath of discoveredRoutes) {
      await captureRoute({
        name: `dynamic${dynamicPath}`,
        path: dynamicPath,
      });
    }

    // ── Write manifest ──────────────────────────────────────────────
    const manifestPath = writeManifest(outDir, entries);
    const reportPath = path.join(outDir, "web-route-report.json");
    const totalCapturedIssues = capturedIssues.length;
    const totalActionableIssues = capturedIssues.filter(isActionableIssue).length;
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          baseUrl: BASE_URL,
          workspaceId,
          screenshotsCaptured: entries.length,
          routesAttempted: routeResults.length,
          routesFailed: routeResults.filter((r) => r.status === "failed").length,
          appErrorRoutes: routeResults.filter((r) => r.appErrorVisible).length,
          totalIssues: totalActionableIssues,
          totalCapturedIssues,
          ignoredIssues: totalCapturedIssues - totalActionableIssues,
          routeResults,
          capturedIssues,
        },
        null,
        2
      )
    );

    console.log(`\n✅ Done – ${entries.length} screenshots captured`);
    console.log(`   Manifest: ${manifestPath}`);
    console.log(`   Report  : ${reportPath}`);
  } catch (err) {
    console.error("❌ Error:", err);

    const failPath = path.join(outDir, "capture-failure.png");
    await page.screenshot({ path: failPath }).catch(() => {});
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
