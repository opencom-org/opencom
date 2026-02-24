#!/usr/bin/env tsx
/**
 * Widget Screenshot Capture
 *
 * Navigates to the widget-demo page (which embeds the Opencom widget for a
 * seeded demo workspace) and captures screenshots of the widget in various
 * states using Playwright — including outbound messages (banner, post, chat),
 * product tours, and every widget tab.
 *
 * Prerequisites:
 *   - pnpm dev:web running on http://localhost:3000  (or set BASE_URL)
 *   - Widget built for tests (bash scripts/build-widget-for-tests.sh)
 *   - A workspace ID with seeded data (set DEMO_WORKSPACE_ID or run capture-web first)
 *
 * Usage:
 *   npx tsx scripts/screenshots/capture-widget.ts
 */

import { chromium, type Page } from "@playwright/test";
import * as path from "path";
import { ensureOutputDir, writeManifest, entry, type ScreenshotEntry } from "./manifest";
import { callMutation } from "./seed";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const BACKEND_URL = process.env.E2E_BACKEND_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
let WORKSPACE_ID = process.env.DEMO_WORKSPACE_ID || "";
const SEED_DATA = process.env.SEED_DATA === "true";

const DEMO_EMAIL = `demo-widget-${Date.now()}@example.com`;
const DEMO_PASSWORD = "DemoPassword123!";
const DEMO_NAME = "Widget Demo User";
const DEMO_WORKSPACE = "Widget Demo Org";

/** Helper: take a screenshot and push to entries array. */
async function snap(page: Page, outDir: string, entries: ScreenshotEntry[], name: string) {
  const fileName = `widget-${name}.png`;
  const filePath = path.join(outDir, fileName);
  await page.screenshot({ path: filePath });
  entries.push(entry("widget", name, filePath));
  console.log(`   📷 ${name}`);
}

/** Helper: dismiss any visible overlays (outbound, tour, survey) using force clicks. */
async function dismissAllOverlays(page: Page) {
  const dismissSelectors = [
    ".opencom-outbound-banner-close",
    ".opencom-outbound-post-close",
    ".opencom-outbound-chat-close",
    ".opencom-tour-close",
    ".opencom-survey-dismiss",
  ];
  for (const sel of dismissSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
      await btn.click({ force: true });
      await page.waitForTimeout(500);
    }
  }
}

/**
 * Wait for the widget to be fully initialised:
 * - .opencom-widget div exists
 * - .opencom-launcher is visible (means visitor created & Convex connected)
 * Then give extra time for Convex subscriptions (tours, outbound) to resolve.
 */
async function waitForWidgetReady(page: Page) {
  try {
    await page.locator(".opencom-widget").first().waitFor({ state: "attached", timeout: 15000 });
    await page.locator(".opencom-launcher").first().waitFor({ state: "visible", timeout: 15000 });
    // Extra time for Convex queries (tours, outbound, surveys) to resolve
    await page.waitForTimeout(5000);
  } catch {
    console.log("   ⚠️  Widget did not fully initialise within timeout");
  }
}

async function run() {
  const outDir = ensureOutputDir("widget");
  const entries: ScreenshotEntry[] = [];

  console.log("📸 Widget Screenshot Capture");
  console.log(`   Base URL     : ${BASE_URL}`);
  console.log(`   Output       : ${outDir}\n`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  const page = await context.newPage();

  try {
    // ── Sign up to get a valid workspace ID ─────────────────────────
    if (!WORKSPACE_ID) {
      console.log("0️⃣  Signing up to obtain workspace ID...");
      await page.goto(`${BASE_URL}/signup`, { timeout: 60000 });
      await page.waitForLoadState("load");
      await page.waitForTimeout(3000);

      const backendInput = page.getByLabel(/backend url/i);
      if (await backendInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await backendInput.fill(BACKEND_URL);
        await page.getByRole("button", { name: /connect/i }).click();
        await page.waitForTimeout(3000);
      }

      const pwBtn = page.getByRole("button", { name: /sign up with password/i });
      if (await pwBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await pwBtn.click();
        await page.waitForTimeout(1500);
      }

      await page.waitForTimeout(1000);
      await page.getByLabel("Name", { exact: true }).fill(DEMO_NAME);
      await page.getByLabel("Email", { exact: true }).fill(DEMO_EMAIL);
      await page.getByLabel("Password", { exact: true }).fill(DEMO_PASSWORD);
      const wsField = page.getByLabel(/workspace name/i);
      if (await wsField.isVisible({ timeout: 1000 }).catch(() => false)) {
        await wsField.fill(DEMO_WORKSPACE);
      }
      await page.getByRole("button", { name: /create account|sign up/i }).click();
      await page.waitForURL(/inbox|dashboard/, { timeout: 30000 });
      await page.waitForTimeout(1000);

      WORKSPACE_ID =
        (await page.evaluate(() => {
          const stored = localStorage.getItem("opencom_active_workspace");
          if (stored) {
            try {
              return JSON.parse(stored)._id || "";
            } catch {
              return "";
            }
          }
          return "";
        })) || "";

      if (WORKSPACE_ID) {
        console.log(`   ✅ Got workspace ID: ${WORKSPACE_ID}`);
      } else {
        console.log("   ⚠️  Could not extract workspace ID – widget may not initialise");
      }
    }

    // ── Seed demo data ──────────────────────────────────────────────
    if (SEED_DATA && WORKSPACE_ID) {
      console.log(`   Seeding demo data (workspace: ${WORKSPACE_ID})...`);
      try {
        const result = await callMutation(BACKEND_URL, "testData:seedDemoData", {
          workspaceId: WORKSPACE_ID,
        });
        console.log("   ✅ Seeded:", result);
        await page.waitForTimeout(3000);
      } catch (err) {
        console.warn("   ⚠️  Seed failed (continuing without data):", err);
      }
    } else if (SEED_DATA) {
      console.log("   ⚠️  SEED_DATA=true but no workspace ID – skipping seed");
    }

    const demoUrl = WORKSPACE_ID
      ? `${BASE_URL}/widget-demo?workspaceId=${WORKSPACE_ID}`
      : `${BASE_URL}/widget-demo`;

    // ═════════════════════════════════════════════════════════════════
    // 1. Page with launcher
    // ═════════════════════════════════════════════════════════════════
    console.log("1️⃣  Loading widget demo page...");
    await page.goto(demoUrl, { timeout: 60000 });
    await page.waitForLoadState("load");
    await page.waitForTimeout(3000);
    await waitForWidgetReady(page);
    await snap(page, outDir, entries, "page-with-launcher");

    // ═════════════════════════════════════════════════════════════════
    // 2. Open widget → capture outbound overlays, tour, then tabs
    //    The visitor is created on widget open; outbound messages and
    //    tours auto-trigger once the visitor + data loads from Convex.
    //    Outbound messages have frequency:"once" so we must capture
    //    them on the first appearance before dismissing.
    // ═════════════════════════════════════════════════════════════════
    console.log("2️⃣  Opening widget...");

    const launcher = page.locator(".opencom-launcher").first();
    if (await launcher.isVisible({ timeout: 5000 }).catch(() => false)) {
      await launcher.click();
      // Wait for visitor creation + Convex subscriptions
      await page.waitForTimeout(6000);

      // ── 2a. Capture tour steps (auto-fires on page match) ────────
      console.log("   Capturing tour...");
      const tourOverlay = page.locator(".opencom-tour-overlay").first();
      if (await tourOverlay.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Post step (modal)
        const tourModal = page.locator(".opencom-tour-modal").first();
        if (await tourModal.isVisible({ timeout: 2000 }).catch(() => false)) {
          await snap(page, outDir, entries, "tour-post-step");
          const nextBtn = page.locator(".opencom-tour-btn-primary").first();
          if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await nextBtn.click();
            await page.waitForTimeout(1500);
          }
        }

        // Pointer steps
        const tourTooltip = page.locator(".opencom-tour-tooltip").first();
        if (await tourTooltip.isVisible({ timeout: 3000 }).catch(() => false)) {
          await snap(page, outDir, entries, "tour-pointer-step");
          const nextBtn = page.locator(".opencom-tour-btn-primary").first();
          if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await nextBtn.click();
            await page.waitForTimeout(1500);
            if (await tourTooltip.isVisible({ timeout: 2000 }).catch(() => false)) {
              await snap(page, outDir, entries, "tour-pointer-step-2");
            }
          }
        }

        // Dismiss tour
        const tourClose = page.locator(".opencom-tour-close").first();
        if (await tourClose.isVisible({ timeout: 2000 }).catch(() => false)) {
          await tourClose.click({ force: true });
          await page.waitForTimeout(1000);
        }
      } else {
        console.log("   ⚠️  No tour overlay visible – skipping");
      }

      // ── 2b. Capture outbound overlays (now clean, no tour) ────────
      // Outbound messages fire alongside tour; now that tour is dismissed
      // we can capture them cleanly. Each type captured only once.
      console.log("3️⃣  Capturing outbound overlays...");
      await page.waitForTimeout(1000);

      const capturedOutbound = new Set<string>();
      const outboundTypes = [
        {
          sel: ".opencom-outbound-chat",
          close: ".opencom-outbound-chat-close",
          name: "outbound-chat",
        },
        {
          sel: ".opencom-outbound-post-overlay",
          close: ".opencom-outbound-post-close",
          name: "outbound-post",
        },
        {
          sel: ".opencom-outbound-banner",
          close: ".opencom-outbound-banner-close",
          name: "outbound-banner",
        },
      ];

      for (let attempt = 0; attempt < 6; attempt++) {
        const anyOverlay = page
          .locator(
            ".opencom-outbound-chat, .opencom-outbound-post-overlay, .opencom-outbound-banner"
          )
          .first();
        if (!(await anyOverlay.isVisible({ timeout: 3000 }).catch(() => false))) break;

        let matched = false;
        for (const ot of outboundTypes) {
          const el = page.locator(ot.sel).first();
          if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
            if (!capturedOutbound.has(ot.name)) {
              capturedOutbound.add(ot.name);
              await snap(page, outDir, entries, ot.name);
            }
            const closeBtn = page.locator(ot.close).first();
            if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
              await closeBtn.click({ force: true });
              await page.waitForTimeout(2000);
            }
            matched = true;
            break;
          }
        }
        if (!matched) break;
        if (capturedOutbound.size >= 3) break;
      }
      if (capturedOutbound.size === 0) {
        console.log("   ⚠️  No outbound overlays visible – skipping");
      }

      // ── 4. Dismiss all overlays, then screenshot all tabs cleanly ──
      console.log("4️⃣  Capturing widget tabs...");
      // Aggressively dismiss any remaining overlays
      for (let i = 0; i < 3; i++) {
        await dismissAllOverlays(page);
        await page.waitForTimeout(500);
      }

      // Ensure the widget header background is visible (purple)
      // The seed sets backgroundColor but Convex subscription may lag
      await page.evaluate(() => {
        document.documentElement.style.setProperty("--opencom-background-color", "#792cd4");
      });
      await page.waitForTimeout(500);

      // Make sure we're in the main shell on the Home tab
      const homeTab = page.locator(".opencom-nav-item").filter({ hasText: "Home" }).first();
      if (await homeTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await homeTab.click({ force: true });
        await page.waitForTimeout(1000);
        await dismissAllOverlays(page);
      }

      await snap(page, outDir, entries, "tab-home");

      const tabs: { label: string; slug: string }[] = [
        { label: "Messages", slug: "messages" },
        { label: "Help", slug: "help" },
        { label: "Tours", slug: "tours" },
        { label: "Tasks", slug: "tasks" },
        { label: "Tickets", slug: "tickets" },
      ];

      for (const tab of tabs) {
        await dismissAllOverlays(page);
        const tabBtn = page.locator(".opencom-nav-item").filter({ hasText: tab.label }).first();
        if (await tabBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await tabBtn.click({ force: true });
          await page.waitForTimeout(1500);
          await dismissAllOverlays(page);
          await snap(page, outDir, entries, `tab-${tab.slug}`);
        } else {
          console.log(`   ⚠️  Tab "${tab.label}" not visible – skipping`);
        }
      }

      // Close widget
      await dismissAllOverlays(page);
      const closeBtn = page.locator(".opencom-close, [data-testid='widget-close']").first();
      if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeBtn.click({ force: true });
        await page.waitForTimeout(1000);
      }
    } else {
      console.log("   ⚠️  Widget launcher not visible – skipping widget interaction shots");
    }

    // ═════════════════════════════════════════════════════════════════
    // 5. Survey overlay (if one fires)
    // ═════════════════════════════════════════════════════════════════
    console.log("5️⃣  Checking for survey overlay...");
    const survey = page.locator(".opencom-survey, .opencom-survey-overlay").first();
    if (await survey.isVisible({ timeout: 3000 }).catch(() => false)) {
      await snap(page, outDir, entries, "survey-overlay");
      const surveyDismiss = page
        .locator(".opencom-survey-dismiss, .opencom-survey button:has-text('×')")
        .first();
      if (await surveyDismiss.isVisible({ timeout: 1000 }).catch(() => false)) {
        await surveyDismiss.click();
        await page.waitForTimeout(1000);
      }
    } else {
      console.log("   ⚠️  No survey visible – skipping");
    }

    // ── Write manifest ──────────────────────────────────────────────
    const manifestPath = writeManifest(outDir, entries);
    console.log(`\n✅ Done – ${entries.length} screenshots captured`);
    console.log(`   Manifest: ${manifestPath}`);
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
