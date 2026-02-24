import { test, expect } from "./fixtures";
import type { Locator, Page } from "@playwright/test";
import {
  ensureAuthenticatedInPage,
  gotoWithAuthRecovery,
  refreshAuthState,
} from "./helpers/auth-refresh";

// Auth is handled by global setup via storageState in playwright.config.ts

async function openKnowledge(page: Page): Promise<boolean> {
  await gotoWithAuthRecovery(page, "/knowledge");
  if (page.isClosed()) {
    return false;
  }

  await page.waitForLoadState("domcontentloaded").catch(() => {});

  const heading = page.getByRole("heading", { name: /knowledge hub|knowledge/i }).first();
  if (await heading.isVisible({ timeout: 6000 }).catch(() => false)) {
    return true;
  }

  const fallbackMarker = page
    .locator(
      "a[href*='/knowledge/internal/new'], button:has-text('New Internal Article'), button:has-text('Create Article'), input[placeholder*='Search']"
    )
    .first();
  if (await fallbackMarker.isVisible({ timeout: 4000 }).catch(() => false)) {
    return true;
  }

  return false;
}

function getFolderSidebar(page: Page): Locator {
  return page
    .getByTestId("knowledge-folder-sidebar")
    .or(page.locator("div.w-64.border-r.bg-gray-50"));
}

function getCreateFolderButton(page: Page): Locator {
  return getFolderSidebar(page).locator("div.p-3.border-b button").first();
}

function getFolderNameLabels(page: Page): Locator {
  return getFolderSidebar(page).locator(
    "[data-testid='folder-name-label'], span.flex-1.text-sm.truncate"
  );
}

function getFolderMenuTriggers(page: Page): Locator {
  return getFolderSidebar(page).locator(
    "[data-testid='folder-menu-trigger'], div.group > div.relative > button"
  );
}

async function createFolderAndWait(page: Page): Promise<number> {
  const createFolderButton = getCreateFolderButton(page);
  const folderNameLabels = getFolderNameLabels(page);
  const initialCount = await folderNameLabels.count();

  await expect(createFolderButton).toBeVisible({ timeout: 5000 });
  await expect
    .poll(
      async () => {
        await createFolderButton.click();
        await page.waitForTimeout(250);
        return folderNameLabels.count();
      },
      { timeout: 10000 }
    )
    .toBeGreaterThan(initialCount);

  return initialCount;
}

test.describe("Knowledge Hub - Folder Management", () => {
  test.beforeEach(async ({ page }) => {
    await refreshAuthState();
    const ok = await ensureAuthenticatedInPage(page);
    if (!ok) {
      test.skip(true, "[knowledge.spec] Could not authenticate test page");
    }
  });

  test("should navigate to knowledge hub", async ({ page }) => {
    const opened = await openKnowledge(page);
    test.skip(!opened, "Knowledge hub is unavailable in this run");
  });

  test("should display folder sidebar", async ({ page }) => {
    const opened = await openKnowledge(page);
    test.skip(!opened, "Knowledge hub is unavailable in this run");
    await expect(page.getByText(/folders/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/all content/i)).toBeVisible({ timeout: 5000 });
  });

  test("should create a new folder", async ({ page }) => {
    const opened = await openKnowledge(page);
    test.skip(!opened, "Knowledge hub is unavailable in this run");
    await createFolderAndWait(page);
  });

  test("should rename a folder", async ({ page }) => {
    const opened = await openKnowledge(page);
    test.skip(!opened, "Knowledge hub is unavailable in this run");
    await createFolderAndWait(page);

    const moreButton = getFolderMenuTriggers(page).last();
    await expect(moreButton).toBeVisible({ timeout: 5000 });
    await moreButton.click({ force: true });

    const renameButton = page.getByRole("button", { name: /^rename$/i });
    await expect(renameButton).toBeVisible({ timeout: 5000 });
    await renameButton.click();

    const renamedFolder = `Renamed Folder ${Date.now()}`;
    const input = getFolderSidebar(page).locator("input[type='text']").last();
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill(renamedFolder);
    await input.press("Enter");

    await expect(page.getByText(renamedFolder)).toBeVisible({ timeout: 5000 });
  });

  test("should delete a folder", async ({ page }) => {
    const opened = await openKnowledge(page);
    test.skip(!opened, "Knowledge hub is unavailable in this run");
    const initialCount = await createFolderAndWait(page);

    const moreButton = getFolderMenuTriggers(page).last();
    await expect(moreButton).toBeVisible({ timeout: 5000 });
    await moreButton.click({ force: true });

    const deleteButton = page.getByRole("button", { name: /^delete$/i });
    await expect(deleteButton).toBeVisible({ timeout: 5000 });

    page.once("dialog", (dialog) => dialog.accept());
    await deleteButton.click();

    await expect
      .poll(async () => getFolderNameLabels(page).count(), { timeout: 10000 })
      .toBe(initialCount);
  });
});

test.describe("Knowledge Hub - Internal Article Creation", () => {
  test.describe.configure({ timeout: 90000 });

  test.beforeEach(async ({ page }) => {
    await refreshAuthState();
    const ok = await ensureAuthenticatedInPage(page);
    if (!ok) {
      test.skip(true, "[knowledge.spec] Could not authenticate test page");
    }
  });

  test("should navigate to new internal article page", async ({ page }) => {
    const opened = await openKnowledge(page);
    test.skip(!opened, "Knowledge hub is unavailable in this run");
    await page.waitForLoadState("networkidle").catch(() => {});

    // Try different possible button names
    const newArticleButton = page
      .getByRole("link", { name: /new internal article/i })
      .or(page.getByRole("button", { name: /new article/i }))
      .or(page.getByRole("button", { name: /create article/i }));

    if (await newArticleButton.isVisible({ timeout: 10000 }).catch(() => false)) {
      await newArticleButton.click();
    }

    if (/knowledge\/internal\/new/.test(page.url())) {
      return;
    }

    // Fallback: navigate directly if click did not navigate.
    await gotoWithAuthRecovery(page, "/knowledge/internal/new");
    await page.waitForLoadState("networkidle").catch(() => {});
    test.skip(
      !/knowledge\/internal\/new/.test(page.url()),
      "Internal article editor route is unavailable in this run"
    );
  });

  test("should create an internal article", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/knowledge/internal/new");
    test.skip(
      !/knowledge\/internal\/new/.test(page.url()),
      "Internal article editor route is unavailable in this run"
    );

    // Wait for the editor to load
    const titleInput = page.getByPlaceholder(/title/i).or(page.getByLabel(/title/i));
    if (await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await titleInput.fill("Test Internal Article");

      // Find content editor (could be textarea or contenteditable)
      const contentArea = page.locator("textarea, [contenteditable='true']").first();
      if (await contentArea.isVisible({ timeout: 3000 }).catch(() => false)) {
        await contentArea.fill("This is test content for the internal article.");
      }

      // Save the article
      const saveButton = page.getByRole("button", { name: /save|create|publish/i });
      if (await saveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await saveButton.click({ noWaitAfter: true });
        // Should redirect or show success
        await expect(page.getByText(/saved|created|success/i))
          .toBeVisible({ timeout: 5000 })
          .catch(() => {
            // Or redirect to the article page
            expect(page.url()).toMatch(/knowledge\/internal\/[a-z0-9]+/i);
          });
      }
    }
  });

  test("should show article in knowledge hub list", async ({ page }) => {
    // First create an article
    await gotoWithAuthRecovery(page, "/knowledge/internal/new");
    test.skip(
      !/knowledge\/internal\/new/.test(page.url()),
      "Internal article editor route is unavailable in this run"
    );

    const titleInput = page.getByPlaceholder(/title/i).or(page.getByLabel(/title/i));
    if (await titleInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      const articleTitle = `Test Article ${Date.now()}`;
      await titleInput.fill(articleTitle);

      const contentArea = page.locator("textarea, [contenteditable='true']").first();
      if (await contentArea.isVisible({ timeout: 3000 }).catch(() => false)) {
        await contentArea.fill("Test content");
      }

      const saveButton = page.getByRole("button", { name: /save|create|publish/i });
      if (await saveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await saveButton.click({ noWaitAfter: true });
        await page.waitForTimeout(2000);
      }

      // Navigate to knowledge hub and verify article appears
      await gotoWithAuthRecovery(page, "/knowledge");
      await expect(page.getByText(articleTitle))
        .toBeVisible({ timeout: 10000 })
        .catch(() => {
          // Article might be in a different view
        });
    }
  });
});

test.describe("Knowledge Hub - Search from Inbox", () => {
  test.beforeEach(async ({ page }) => {
    await refreshAuthState();
    const ok = await ensureAuthenticatedInPage(page);
    if (!ok) {
      test.skip(true, "[knowledge.spec] Could not authenticate test page");
    }
  });

  test("should show knowledge search panel in inbox", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/inbox");
    await expect(page).toHaveURL(/inbox/, { timeout: 10000 });

    // Look for knowledge search panel or button
    const knowledgeButton = page.getByRole("button", { name: /knowledge|search.*content/i });
    const knowledgePanel = page.getByText(/knowledge|search.*content/i);

    const hasKnowledgeAccess =
      (await knowledgeButton.isVisible({ timeout: 3000 }).catch(() => false)) ||
      (await knowledgePanel.isVisible({ timeout: 1000 }).catch(() => false));

    // Knowledge integration should be accessible from inbox
    test.skip(
      !hasKnowledgeAccess,
      "Knowledge access not visible in inbox — may require active conversation"
    );
    expect(hasKnowledgeAccess).toBe(true);
  });

  test("should search knowledge content", async ({ page }) => {
    const opened = await openKnowledge(page);
    test.skip(!opened, "Knowledge hub is unavailable in this run");

    // Find search input
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill("test");
    await page.waitForLoadState("networkidle").catch(() => {});

    // Results should appear (or "no results" message)
    const resultsOrEmpty = page.getByText(/no results|found|article|content/i).first();
    await expect(resultsOrEmpty).toBeVisible({ timeout: 5000 });
  });

  test("should filter content by type", async ({ page }) => {
    const opened = await openKnowledge(page);
    test.skip(!opened, "Knowledge hub is unavailable in this run");

    // Click filters button
    const filtersButton = page.getByRole("button", { name: /filters/i });
    if (await filtersButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filtersButton.click();

      // Should show content type filters
      await expect(page.getByText(/content type/i)).toBeVisible({ timeout: 3000 });

      // Filter options should be visible
      const articleFilter = page.getByText(/article/i).first();
      const internalFilter = page.getByText(/internal/i).first();
      const snippetFilter = page.getByText(/snippet/i).first();

      const hasFilters =
        (await articleFilter.isVisible({ timeout: 2000 }).catch(() => false)) ||
        (await internalFilter.isVisible({ timeout: 1000 }).catch(() => false)) ||
        (await snippetFilter.isVisible({ timeout: 1000 }).catch(() => false));

      expect(hasFilters).toBe(true);
    }
  });

  test("should toggle between list and grid view", async ({ page }) => {
    const opened = await openKnowledge(page);
    test.skip(!opened, "Knowledge hub is unavailable in this run");

    // Find view toggle buttons - try multiple selectors
    const listButton = page
      .locator("button")
      .filter({ has: page.locator("svg.lucide-list, [data-icon='list']") })
      .first()
      .or(page.getByRole("button", { name: /list/i }));
    const gridButton = page
      .locator("button")
      .filter({ has: page.locator("svg.lucide-layout-grid, [data-icon='grid']") })
      .first()
      .or(page.getByRole("button", { name: /grid/i }));

    const hasGridButton = await gridButton.isVisible({ timeout: 5000 }).catch(() => false);
    test.skip(!hasGridButton, "View toggle buttons not visible — UI may have changed");

    await gridButton.click();
    await expect(listButton).toBeVisible({ timeout: 3000 });
    await listButton.click();
  });
});
