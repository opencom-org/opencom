import { test, expect } from "./fixtures";
import {
  ensureAuthenticatedInPage,
  gotoWithAuthRecovery,
  refreshAuthState,
} from "./helpers/auth-refresh";

test.describe("Web Admin - Reports & Analytics", () => {
  // Auth is handled by global setup via storageState in playwright.config.ts
  test.beforeAll(async () => {
    await refreshAuthState();
  });

  test.beforeEach(async ({ page }) => {
    const refreshed = await refreshAuthState();
    expect(refreshed).toBe(true);
    const authed = await ensureAuthenticatedInPage(page);
    expect(authed).toBe(true);
  });

  test("should navigate to reports page", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/reports");
    await expect(page).toHaveURL(/\/reports/, { timeout: 12000 });

    // Reports page has h1 "Reports"
    await expect(page.getByRole("heading", { name: "Reports", level: 1 })).toBeVisible({
      timeout: 15000,
    });
  });

  test("should display summary metric cards", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/reports");

    // Should show metric cards: Total Conversations, Avg Response Time, etc.
    await expect(page.getByText("Total Conversations")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Avg Response Time")).toBeVisible({ timeout: 5000 });
  });

  test("should allow date range selection", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/reports");

    // Date range buttons: "7 Days", "30 Days", "90 Days"
    const sevenDays = page.getByRole("button", { name: "7 Days" });
    await expect(sevenDays).toBeVisible({ timeout: 15000 });

    // Click 7 Days
    await sevenDays.click();

    // Page should still show metrics
    await expect(page.getByText("Total Conversations")).toBeVisible({ timeout: 5000 });
  });

  test("should show quick links to detailed reports", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/reports");

    // Quick link cards to sub-reports
    await expect(page.locator("a[href='/reports/conversations']")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("a[href='/reports/csat']")).toBeVisible({ timeout: 5000 });
  });
});
