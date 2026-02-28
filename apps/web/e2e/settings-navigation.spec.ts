import { test, expect } from "./fixtures";
import {
  ensureAuthenticatedInPage,
  gotoWithAuthRecovery,
  refreshAuthState,
} from "./helpers/auth-refresh";

async function openSettings(page: import("@playwright/test").Page): Promise<void> {
  await gotoWithAuthRecovery(page, "/settings");
  await expect(page.getByRole("heading", { name: /^settings$/i })).toBeVisible({ timeout: 15000 });
}

test.describe("Settings Navigation UX", () => {
  test.describe.configure({ timeout: 120000 });

  test.beforeAll(async () => {
    await refreshAuthState();
  });

  test.beforeEach(async ({ page }) => {
    const refreshed = await refreshAuthState();
    expect(refreshed).toBe(true);
    const authed = await ensureAuthenticatedInPage(page);
    expect(authed).toBe(true);
  });

  test("desktop uses section toggles instead of page navigation rail", async ({ page }) => {
    await openSettings(page);

    await expect(page.getByTestId("settings-nav-desktop")).toHaveCount(0);
    await expect(page.getByTestId("settings-section-toggle-allowed-origins")).toBeVisible();

    await expect(page.locator("#allowed-origins-content")).toHaveCount(0);
    await page.getByTestId("settings-section-toggle-allowed-origins").click();
    await expect(page.locator("#allowed-origins-content")).toBeVisible();
    await expect(page.getByRole("button", { name: /add origin/i })).toBeVisible();

    await page.getByTestId("settings-section-toggle-ai-agent").click();
    await expect(page.locator("#ai-agent-content")).toBeVisible();
    await expect(page.locator("#allowed-origins-content")).toHaveCount(0);

    await page.getByTestId("settings-section-toggle-ai-agent").click();
    await expect(page.locator("#ai-agent-content")).toHaveCount(0);
    await expect(page.locator("#workspace-content")).toHaveCount(0);
  });

  test("mobile uses the same section toggles and no extra page nav", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSettings(page);

    await expect(page.getByTestId("settings-nav-mobile")).toHaveCount(0);

    await expect(page.locator("#security-content")).toHaveCount(0);
    await page.getByTestId("settings-section-toggle-security").click();
    await expect(page.locator("#security-content")).toBeVisible();
  });

  test("deep links open target section", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/settings?section=allowed-origins");

    await expect(page).toHaveURL(/section=allowed-origins/);
    await expect(page.locator("#allowed-origins-content")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /add origin/i })).toBeVisible();
  });

  test("relocated sections are linked from settings and available elsewhere", async ({ page }) => {
    await openSettings(page);

    if (!(await page.locator("#security-content").isVisible().catch(() => false))) {
      await page.getByTestId("settings-section-toggle-security").click();
    }
    await expect(page.getByRole("link", { name: /view full audit logs/i })).toBeVisible();
    await expect(page.getByText("Event details")).toHaveCount(0);

    await page.getByTestId("settings-section-toggle-installations").click();
    await expect(page.getByRole("link", { name: /open onboarding setup/i })).toBeVisible();
    await expect(page.getByText("pnpm add @opencom/react-native-sdk")).toHaveCount(0);

    await gotoWithAuthRecovery(page, "/onboarding");
    await expect(page.getByRole("heading", { name: /install widget/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("heading", { name: /install mobile sdk/i })).toBeVisible();
  });
});
