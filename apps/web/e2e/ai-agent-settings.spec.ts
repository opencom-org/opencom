import { test, expect } from "./fixtures";
import { ensureAuthenticatedInPage, gotoWithAuthRecovery } from "./helpers/auth-refresh";

const AUTH_ROUTE_RE = /\/(login|signup)(\/|$|\?)/;

function isAuthRoute(page: import("@playwright/test").Page): boolean {
  try {
    return AUTH_ROUTE_RE.test(new URL(page.url()).pathname);
  } catch {
    return AUTH_ROUTE_RE.test(page.url());
  }
}

async function openSettings(page: import("@playwright/test").Page): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await gotoWithAuthRecovery(page, "/settings");
    await page.waitForLoadState("networkidle").catch(() => {});

    if (isAuthRoute(page)) {
      const recovered = await ensureAuthenticatedInPage(page);
      if (!recovered) {
        await page.waitForTimeout(500);
      }
      continue;
    }

    await expect(page.getByRole("heading", { name: /^settings$/i })).toBeVisible({
      timeout: 10000,
    });

    const aiSection = page.locator("#ai-agent");
    await aiSection.scrollIntoViewIfNeeded().catch(() => {});

    const aiSectionToggle = page.getByTestId("settings-section-toggle-ai-agent");
    if (await aiSectionToggle.isVisible({ timeout: 10000 }).catch(() => false)) {
      const isExpanded = (await aiSectionToggle.getAttribute("aria-expanded")) === "true";
      if (!isExpanded) {
        await aiSectionToggle.click({ timeout: 5000 });
      }

      await expect(page.locator("#ai-agent-content")).toBeVisible({ timeout: 10000 });
      return;
    }

    await page.waitForTimeout(500);
  }

  await expect(page.locator("#ai-agent-content")).toBeVisible({ timeout: 15000 });
}

test.describe("Web Admin - AI Agent Settings", () => {
  test.beforeEach(async ({ page }) => {
    const ok = await ensureAuthenticatedInPage(page);
    if (!ok) {
      throw new Error("Failed to authenticate AI settings E2E context");
    }
  });

  test("should display AI Agent section on settings page", async ({ page }) => {
    await openSettings(page);

    await expect(page.locator("#ai-agent-content")).toBeVisible({ timeout: 15000 });
  });

  test("should toggle AI agent enable/disable", async ({ page }) => {
    await openSettings(page);

    // Find the "Enable AI Agent" toggle (custom toggle button near the text)
    const enableText = page.getByText("Enable AI Agent");
    await expect(enableText).toBeVisible({ timeout: 5000 });

    // The toggle is a sibling button with rounded-full class
    const toggleButton = enableText.locator("..").locator("..").locator("button").first();
    await expect(toggleButton).toBeVisible({ timeout: 5000 });
    await toggleButton.click();

    // Toggle state should change (page remains functional)
    await expect(toggleButton).toBeVisible();
  });

  test("should save AI agent settings", async ({ page }) => {
    await openSettings(page);

    // Find and click save button for AI settings
    const saveButton = page.getByRole("button", { name: /save ai settings/i });
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();

    // Save should complete
    await page.waitForLoadState("networkidle").catch(() => {});
  });

  test("should display AI personality settings when enabled", async ({ page }) => {
    await openSettings(page);

    // Enable AI Agent if not already enabled - look for personality field
    const personalityField = page.getByText(/ai personality/i);
    const isEnabled = await personalityField.isVisible({ timeout: 3000 }).catch(() => false);

    if (!isEnabled) {
      // Toggle enable
      const enableText = page.getByText("Enable AI Agent");
      const toggleButton = enableText.locator("..").locator("..").locator("button").first();
      await toggleButton.click();
    }

    // Personality textarea should be visible when enabled
    await expect(page.getByText(/ai personality/i)).toBeVisible({ timeout: 5000 });
  });
});
