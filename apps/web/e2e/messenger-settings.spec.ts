import { test, expect } from "./fixtures";
import {
  ensureAuthenticatedInPage,
  gotoWithAuthRecovery,
  refreshAuthState,
} from "./helpers/auth-refresh";

async function openSettingsReady(page: import("@playwright/test").Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    await gotoWithAuthRecovery(page, "/settings");

    const headingVisible = await page
      .getByRole("heading", { name: /messenger customization/i })
      .isVisible({ timeout: 6000 })
      .catch(() => false);
    if (headingVisible) {
      return;
    }

    const authed = await ensureAuthenticatedInPage(page);
    if (!authed) {
      await page.waitForTimeout(500);
    }
  }

  await expect(page.getByRole("heading", { name: /messenger customization/i })).toBeVisible({
    timeout: 15000,
  });
}

test.describe("Web Admin - Messenger Settings", () => {
  test.describe.configure({ timeout: 120000 });

  // Auth is handled by global setup via storageState in playwright.config.ts
  // Messenger Customization is an inline Card section on /settings
  test.beforeAll(async () => {
    await refreshAuthState();
  });

  test.beforeEach(async ({ page }) => {
    const refreshed = await refreshAuthState();
    expect(refreshed).toBe(true);
    const authed = await ensureAuthenticatedInPage(page);
    expect(authed).toBe(true);
  });

  test("should display Messenger Customization section", async ({ page }) => {
    await openSettingsReady(page);

    await expect(page.getByRole("heading", { name: /messenger customization/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test("should display color picker inputs", async ({ page }) => {
    await openSettingsReady(page);

    await expect(page.getByRole("heading", { name: /messenger customization/i })).toBeVisible({
      timeout: 15000,
    });

    // Primary Color and Header Color input[type='color'] elements exist
    const colorInputs = page.locator("input[type='color']");
    await expect(colorInputs.first()).toBeVisible({ timeout: 5000 });
  });

  test("should display welcome message textarea", async ({ page }) => {
    await openSettingsReady(page);

    await expect(page.getByRole("heading", { name: /messenger customization/i })).toBeVisible({
      timeout: 15000,
    });

    // Welcome Message textarea
    const welcomeTextarea = page
      .locator("textarea")
      .filter({ hasText: /./i })
      .first()
      .or(page.getByPlaceholder(/how can we help/i));
    await expect(welcomeTextarea.first()).toBeVisible({ timeout: 5000 });
  });

  test("should save messenger settings", async ({ page }) => {
    await openSettingsReady(page);

    const saveButton = page.getByRole("button", { name: /save messenger settings/i });
    await expect(saveButton).toBeVisible({ timeout: 15000 });
    await saveButton.click();

    await page.waitForLoadState("networkidle").catch(() => {});
  });
});
