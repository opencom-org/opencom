import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import {
  ensureAuthenticatedInPage,
  gotoWithAuthRecovery,
  refreshAuthState,
} from "./helpers/auth-refresh";

async function openArticles(page: Page, path = "/articles"): Promise<void> {
  await gotoWithAuthRecovery(page, path);
  await expect(page).toHaveURL(/\/articles(?:\/|$|\?)/, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: /^articles$/i })).toBeVisible({
    timeout: 10000,
  });
}

test.describe("Articles Admin", () => {
  test.describe.configure({ timeout: 90000 });

  test.beforeEach(async ({ page }) => {
    await refreshAuthState();
    const ok = await ensureAuthenticatedInPage(page);
    if (!ok) {
      test.skip(true, "[knowledge.spec] Could not authenticate test page");
    }
  });

  test("redirects legacy knowledge route to articles", async ({ page }) => {
    await openArticles(page, "/knowledge");
  });

  test("shows the current article management surface", async ({ page }) => {
    await openArticles(page);

    await expect(page.getByText(/manage public and internal knowledge articles/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("link", { name: /manage collections/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("button", { name: /^new internal article$/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("button", { name: /^new article$/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByPlaceholder(/search articles/i)).toBeVisible({ timeout: 10000 });
  });

  test("creates and lists an internal article", async ({ page }) => {
    await openArticles(page);

    await page.getByRole("button", { name: /^new internal article$/i }).click();
    await page.waitForURL(/\/articles\/[a-z0-9]+(?:\?.*)?$/i, { timeout: 15000 });

    const articleTitle = `E2E Internal Article ${Date.now()}`;
    await page.getByPlaceholder("Article title").fill(articleTitle);
    await page.getByPlaceholder("billing, enterprise, refunds").fill("e2e, internal");
    await page
      .getByPlaceholder("Write your article content here...")
      .fill("Internal-only content for the unified knowledge flow.");

    const saveButton = page.getByRole("button", { name: /^save$/i });
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    await saveButton.click();
    await expect(saveButton).toBeDisabled({ timeout: 10000 });

    await expect(page.getByText(/internal articles are available only inside agent-facing/i))
      .toBeVisible({ timeout: 10000 });

    await openArticles(page);
    await page.getByPlaceholder(/search articles/i).fill(articleTitle);

    const articleRow = page.locator("tr").filter({
      has: page.getByRole("link", { name: articleTitle }),
    });
    await expect(articleRow).toBeVisible({ timeout: 10000 });
    await expect(articleRow.getByText(/^internal$/i)).toBeVisible({ timeout: 10000 });
  });
});
