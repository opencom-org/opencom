import { test, expect } from "./fixtures";
import {
  ensureAuthenticatedInPage,
  gotoWithAuthRecovery,
  refreshAuthState,
} from "./helpers/auth-refresh";

async function openSettingsReady(page: import("@playwright/test").Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await gotoWithAuthRecovery(page, "/settings");

    const automationHeading = page.getByRole("heading", { name: /automation/i });
    const ready = await automationHeading.isVisible({ timeout: 6000 }).catch(() => false);
    if (ready) {
      return;
    }

    const authed = await ensureAuthenticatedInPage(page);
    if (!authed) {
      await page.waitForTimeout(500);
    }
  }

  await expect(page.getByRole("heading", { name: /automation/i })).toBeVisible({ timeout: 15000 });
}

test.describe("Web Admin - Automation Settings", () => {
  test.describe.configure({ timeout: 120000 });

  // Auth is handled by global setup via storageState in playwright.config.ts
  // Automation is an inline Card section on /settings ("Automation & Self-Serve")
  test.beforeAll(async () => {
    await refreshAuthState();
  });

  test.beforeEach(async ({ page }) => {
    const refreshed = await refreshAuthState();
    expect(refreshed).toBe(true);
    const authed = await ensureAuthenticatedInPage(page);
    expect(authed).toBe(true);
  });

  test("should display Automation section on settings page", async ({ page }) => {
    await openSettingsReady(page);

    // The Automation section is a Card with h2 heading
    await expect(page.getByRole("heading", { name: /automation/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test("should display Suggest Articles toggle", async ({ page }) => {
    await openSettingsReady(page);

    await expect(page.getByText("Suggest Articles")).toBeVisible({ timeout: 15000 });
  });

  test("should display Show Reply Time toggle", async ({ page }) => {
    await openSettingsReady(page);

    await expect(page.getByText("Show Reply Time")).toBeVisible({ timeout: 15000 });
  });

  test("should display Collect Email toggle", async ({ page }) => {
    await openSettingsReady(page);

    await expect(page.getByText("Collect Email")).toBeVisible({ timeout: 15000 });
  });

  test("should save automation settings", async ({ page }) => {
    await openSettingsReady(page);

    const saveButton = page.getByRole("button", { name: /save automation settings/i });
    await expect(saveButton).toBeVisible({ timeout: 15000 });
    await saveButton.click();

    await page.waitForLoadState("networkidle").catch(() => {});
  });
});
