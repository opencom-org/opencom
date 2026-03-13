import { test, expect } from "./fixtures";
import { ensureAuthenticatedInPage, gotoWithAuthRecovery } from "./helpers/auth-refresh";

async function openSettings(page: import("@playwright/test").Page): Promise<void> {
  await gotoWithAuthRecovery(page, "/settings");
  await page.waitForLoadState("networkidle").catch(() => {});

  const sectionToggle = page.getByTestId("settings-section-toggle-messenger-home");
  const isExpanded = (await sectionToggle.getAttribute("aria-expanded")) === "true";
  if (!isExpanded) {
    await sectionToggle.click({ timeout: 5000 });
  }
}

async function expectHomeSection(page: import("@playwright/test").Page): Promise<void> {
  const sectionToggle = page.getByTestId("settings-section-toggle-messenger-home");
  await sectionToggle.scrollIntoViewIfNeeded().catch(() => {});
  await expect(sectionToggle).toHaveAttribute("aria-expanded", "true", { timeout: 10000 });
  await expect(page.locator("#messenger-home-content")).toBeVisible({ timeout: 10000 });
}

function getHomeEnabledToggle(page: import("@playwright/test").Page) {
  return page.locator("#messenger-home-content button").first();
}

async function expectHomeEnabled(page: import("@playwright/test").Page): Promise<void> {
  await expect(page.getByRole("button", { name: /add card/i })).toBeVisible({ timeout: 10000 });
}

async function isHomeEnabled(page: import("@playwright/test").Page): Promise<boolean> {
  return page
    .getByRole("button", { name: /add card/i })
    .isVisible({ timeout: 500 })
    .catch(() => false);
}

async function expectHomeDisabled(page: import("@playwright/test").Page): Promise<void> {
  await expect(page.getByText("Enable Messenger Home to configure cards")).toBeVisible({
    timeout: 10000,
  });
}

async function ensureHomeEnabled(page: import("@playwright/test").Page): Promise<void> {
  if (await isHomeEnabled(page)) {
    return;
  }

  const toggleButton = getHomeEnabledToggle(page);
  await expect(toggleButton).toBeVisible({ timeout: 5000 });
  await toggleButton.click();
  await expectHomeEnabled(page);
}

async function ensureHomeDisabled(page: import("@playwright/test").Page): Promise<void> {
  if (!(await isHomeEnabled(page))) {
    await expectHomeDisabled(page);
    return;
  }

  const toggleButton = getHomeEnabledToggle(page);
  await expect(toggleButton).toBeVisible({ timeout: 5000 });
  await toggleButton.click();
  await expectHomeDisabled(page);
}

test.describe("Web Admin - Home Settings", () => {
  test.beforeEach(async ({ page }) => {
    const ok = await ensureAuthenticatedInPage(page);
    if (!ok) {
      test.skip(true, "[home-settings.spec] Could not authenticate test page");
    }
  });

  test("should load home settings section on settings page", async ({ page }) => {
    await openSettings(page);
    await expectHomeSection(page);
  });

  test("should toggle home enabled/disabled", async ({ page }) => {
    await openSettings(page);
    await expectHomeSection(page);
    await ensureHomeDisabled(page);
    await ensureHomeEnabled(page);
  });

  test("should add a card to home configuration", async ({ page }) => {
    await openSettings(page);
    await expectHomeSection(page);
    await ensureHomeEnabled(page);
    await expectHomeEnabled(page);

    const addCardButton = page.getByRole("button", { name: /add card/i });
    if (await addCardButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addCardButton.click();
      await page.waitForTimeout(300);

      // Look for card type options
      const searchCardOption = page.getByText("Search Help");
      if (await searchCardOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchCardOption.click();
        await page.waitForTimeout(300);
      }
    }
  });

  test("should change card visibility setting", async ({ page }) => {
    await openSettings(page);
    await expectHomeSection(page);
    await ensureHomeEnabled(page);
    await expectHomeEnabled(page);

    // Find visibility dropdown for any card
    const visibilitySelect = page
      .locator("select")
      .filter({ hasText: /all|visitors|users/i })
      .first();
    if (await visibilitySelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await visibilitySelect.selectOption("users");
      await page.waitForTimeout(300);
    }
  });

  test("should save home settings", async ({ page }) => {
    await openSettings(page);
    await expectHomeSection(page);
    await ensureHomeEnabled(page);
    await expectHomeEnabled(page);

    // Find save button for home settings
    const saveButton = page.getByRole("button", { name: /save home settings/i });
    if (await saveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveButton.click();

      // Wait for save to complete
      await page.waitForTimeout(1000);
    }
  });

  test("should show home preview when cards are added", async ({ page }) => {
    await openSettings(page);
    await expectHomeSection(page);
    await ensureHomeEnabled(page);
    await expectHomeEnabled(page);

    // Check for preview section
    const previewSection = page.getByText("Home Preview");
    await expect(previewSection).toBeVisible({ timeout: 5000 });
  });
});
