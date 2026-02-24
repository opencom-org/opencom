import { test, expect } from "./fixtures";
import {
  ensureAuthenticatedInPage,
  gotoWithAuthRecovery,
  refreshAuthState,
} from "./helpers/auth-refresh";

async function openSnippets(page: import("@playwright/test").Page): Promise<void> {
  await gotoWithAuthRecovery(page, "/snippets");
  await expect(page.getByRole("heading", { name: /snippet/i }).first()).toBeVisible({
    timeout: 10000,
  });
}

test.describe("Web Admin - Saved Reply Snippets", () => {
  // Auth is handled by global setup via storageState in playwright.config.ts
  // Snippets is a sidebar route at /snippets (not under settings)
  test.beforeEach(async ({ page }) => {
    await refreshAuthState();
    const ok = await ensureAuthenticatedInPage(page);
    if (!ok) {
      test.skip(true, "[snippets.spec] Could not authenticate test page");
    }
  });

  test("should navigate to snippets page", async ({ page }) => {
    await openSnippets(page);
  });

  test("should create a new snippet", async ({ page }) => {
    await openSnippets(page);

    // Click "New Snippet" button
    const createButton = page.getByRole("button", { name: /new snippet/i });
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();

    // Modal should appear and stay mounted while we fill fields
    const modal = page.locator("div.fixed.inset-0.bg-black\\/50").first();
    await expect(modal.getByRole("heading", { name: /new snippet/i })).toBeVisible({
      timeout: 5000,
    });

    const snippetName = `E2E Test Greeting ${Date.now()}`;
    const nameInput = modal.getByPlaceholder(/e\.g\.,?\s*greeting/i);
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(snippetName);

    // Fill content
    const contentInput = modal.getByPlaceholder(/hi there! how can i help you today\?/i);
    await expect(contentInput).toBeVisible({ timeout: 5000 });
    await contentInput.fill("Hello! How can I help you today?");

    // Create snippet
    const saveButton = modal.getByRole("button", { name: /create snippet/i });
    await expect(saveButton).toBeVisible({ timeout: 3000 });
    await saveButton.click();

    await expect(modal).toBeHidden({ timeout: 10000 });
    await expect(page.getByText(snippetName).first()).toBeVisible({ timeout: 10000 });
  });
});
