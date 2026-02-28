import { test, expect } from "./fixtures";
import {
  ensureAuthenticatedInPage,
  gotoWithAuthRecovery,
  refreshAuthState,
} from "./helpers/auth-refresh";

async function openSettingsReady(page: import("@playwright/test").Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await gotoWithAuthRecovery(page, "/settings");

    const toggle = page.getByTestId("settings-section-toggle-automation");
    const ready = await toggle.isVisible({ timeout: 6000 }).catch(() => false);
    if (ready) {
      const sectionContent = page.locator("#automation-content");
      if (!(await sectionContent.isVisible().catch(() => false))) {
        await toggle.click();
      }
      await expect(sectionContent).toBeVisible({ timeout: 15000 });
      return;
    }

    const authed = await ensureAuthenticatedInPage(page);
    if (!authed) {
      await page.waitForTimeout(500);
    }
  }

  await expect(page.locator("#automation-content")).toBeVisible({ timeout: 15000 });
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
    await expect(page.locator("#automation")).toBeVisible({
      timeout: 15000,
    });
  });

  test("should display Suggest Articles toggle", async ({ page }) => {
    await openSettingsReady(page);

    await expect(page.locator("#automation-content").getByText("Suggest Articles")).toBeVisible({
      timeout: 15000,
    });
  });

  test("should display Show Reply Time toggle", async ({ page }) => {
    await openSettingsReady(page);

    await expect(page.locator("#automation-content").getByText("Show Reply Time")).toBeVisible({
      timeout: 15000,
    });
  });

  test("should display Collect Email toggle", async ({ page }) => {
    await openSettingsReady(page);

    await expect(page.locator("#automation-content").getByText("Collect Email")).toBeVisible({
      timeout: 15000,
    });
  });

  test("should save automation settings", async ({ page }) => {
    await openSettingsReady(page);

    const saveButton = page
      .locator("#automation-content")
      .getByRole("button", { name: /save automation settings/i });
    await expect(saveButton).toBeVisible({ timeout: 15000 });
    await saveButton.click();

    await page.waitForLoadState("networkidle").catch(() => {});
  });
});
