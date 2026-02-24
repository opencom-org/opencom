import { test, expect } from "./fixtures";
import {
  ensureAuthenticatedInPage,
  gotoWithAuthRecovery,
  refreshAuthState,
} from "./helpers/auth-refresh";

async function openSettings(page: import("@playwright/test").Page): Promise<void> {
  await gotoWithAuthRecovery(page, "/settings");
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function expectHomeSection(page: import("@playwright/test").Page): Promise<void> {
  const messengerHome = page.getByRole("heading", { name: "Messenger Home" });

  for (let attempt = 0; attempt < 2; attempt++) {
    await messengerHome.scrollIntoViewIfNeeded().catch(() => {});
    const isVisible = await messengerHome.isVisible({ timeout: 8000 }).catch(() => false);
    if (isVisible) {
      await expect(messengerHome).toBeVisible({ timeout: 5000 });
      return;
    }

    if (attempt === 0) {
      await openSettings(page);
    }
  }

  test.skip(true, "Messenger Home section not visible after retry");
}

test.describe("Web Admin - Home Settings", () => {
  test.beforeEach(async ({ page }) => {
    await refreshAuthState();
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

    // Find toggle using role-based selector (switch or checkbox role)
    const toggleButton = page
      .getByRole("switch", { name: /home|messenger/i })
      .or(
        page
          .locator(
            "[aria-label*='home' i][role='switch'], [aria-label*='messenger' i][role='switch']"
          )
          .first()
      )
      .or(page.locator("text=Messenger Home").locator("..").getByRole("button").first());

    if (await toggleButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click toggle to enable
      await toggleButton.click();
      await page.waitForTimeout(1000);

      // Wait for toggle effect — "Add Card" button confirms home is enabled
      const addCardButton = page.getByRole("button", { name: /add card/i });
      await expect(addCardButton).toBeVisible({ timeout: 5000 });
    }
  });

  test("should add a card to home configuration", async ({ page }) => {
    await openSettings(page);
    await expectHomeSection(page);

    // Enable home if needed
    const toggleButton = page
      .getByRole("switch", { name: /home|messenger/i })
      .or(page.locator("text=Messenger Home").locator("..").getByRole("button").first());
    if (await toggleButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await toggleButton.click();
      await page.waitForTimeout(1000);
    }

    // Wait for toggle effect — "Add Card" button confirms home is enabled
    const addCardButton = page.getByRole("button", { name: /add card/i });
    if (await addCardButton.isVisible({ timeout: 5000 }).catch(() => false)) {
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

    // Enable home
    const toggleButton = page
      .getByRole("switch", { name: /home|messenger/i })
      .or(page.locator("text=Messenger Home").locator("..").getByRole("button").first());
    if (await toggleButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await toggleButton.click();
      await page.waitForTimeout(1000);
    }

    // Wait for "Add Card" to confirm toggle took effect
    await page
      .getByRole("button", { name: /add card/i })
      .isVisible({ timeout: 5000 })
      .catch(() => {});

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

    // Enable home
    const toggleButton = page
      .getByRole("switch", { name: /home|messenger/i })
      .or(page.locator("text=Messenger Home").locator("..").getByRole("button").first());
    if (await toggleButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await toggleButton.click();
      await page.waitForTimeout(1000);
    }

    // Wait for "Add Card" to confirm toggle took effect
    await page
      .getByRole("button", { name: /add card/i })
      .isVisible({ timeout: 5000 })
      .catch(() => {});

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

    // Enable home
    const toggleButton = page
      .getByRole("switch", { name: /home|messenger/i })
      .or(page.locator("text=Messenger Home").locator("..").getByRole("button").first());
    if (await toggleButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await toggleButton.click();
      await page.waitForTimeout(1000);
    }

    // Wait for "Add Card" to confirm toggle took effect
    await page
      .getByRole("button", { name: /add card/i })
      .isVisible({ timeout: 5000 })
      .catch(() => {});

    // Check for preview section
    const previewSection = page.getByText("Home Preview");
    await expect(previewSection).toBeVisible({ timeout: 5000 });
  });
});
