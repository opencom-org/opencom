import * as path from "node:path";
import { test, expect } from "./fixtures";
import {
  ensureAuthenticatedInPage,
  gotoWithAuthRecovery,
  refreshAuthState,
} from "./helpers/auth-refresh";

test.describe("Help Center Markdown Import", () => {
  test.describe.configure({ timeout: 120000 });

  test.beforeEach(async ({ page }) => {
    await refreshAuthState();
    const ok = await ensureAuthenticatedInPage(page);
    if (!ok) {
      test.skip(true, "[help-center-import.spec] Could not authenticate test page");
    }
  });

  test("imports docs folder and shows articles in help center", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/articles");
    await expect(page.getByRole("heading", { name: /^articles$/i })).toBeVisible({
      timeout: 10000,
    });

    const docsFolderPath = path.resolve(process.cwd(), "docs");
    await page.getByTestId("markdown-import-folder-input").setInputFiles(docsFolderPath);
    await expect(page.getByTestId("markdown-import-selection-count")).toBeVisible({
      timeout: 10000,
    });

    await page.getByTestId("markdown-import-preview-button").click();
    await expect(page.getByText(/Preview ready\./i)).toBeVisible({ timeout: 45000 });

    await page.getByTestId("markdown-import-sync-button").click();
    await expect(page.getByText(/Synced \d+ markdown files\./i)).toBeVisible({ timeout: 45000 });

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("markdown-export-button").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/help-center-markdown.*\.zip/i);

    await gotoWithAuthRecovery(page, "/help");
    await expect(page.getByRole("heading", { name: /help center/i })).toBeVisible({
      timeout: 10000,
    });

    const importedArticleLink = page.getByRole("link", { name: /Architecture Overview/i }).first();
    await expect(importedArticleLink).toBeVisible({ timeout: 20000 });
    const articleHref = await importedArticleLink.getAttribute("href");
    expect(articleHref).toBeTruthy();
    await gotoWithAuthRecovery(page, articleHref!);
    await expect(page.getByRole("heading", { name: /Architecture Overview/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/high-level architecture/i)).toBeVisible({ timeout: 10000 });
  });
});
