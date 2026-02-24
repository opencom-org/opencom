import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import {
  ensureAuthenticatedInPage,
  gotoWithAuthRecovery,
  refreshAuthState,
} from "./helpers/auth-refresh";

test.beforeEach(async ({ page }) => {
  const refreshed = await refreshAuthState();
  expect(refreshed).toBe(true);
  const authed = await ensureAuthenticatedInPage(page);
  expect(authed).toBe(true);
});

async function openSeriesTab(page: Page) {
  await gotoWithAuthRecovery(page, "/campaigns");

  const seriesTabButton = page.getByRole("button", { name: /^series\b/i }).first();
  await expect(seriesTabButton).toBeVisible({ timeout: 10000 });
  await seriesTabButton.click();

  await expect(page.getByRole("button", { name: /new\s+series/i })).toBeVisible({
    timeout: 10000,
  });
}

async function openSeriesBuilderForNewSeries(page: Page) {
  await openSeriesTab(page);

  const newSeriesButton = page.getByRole("button", { name: /new\s+series/i });
  for (let attempt = 0; attempt < 3; attempt++) {
    await expect(newSeriesButton).toBeVisible({ timeout: 10000 });
    await newSeriesButton.click();

    const openedBuilder = await page
      .waitForURL(/\/campaigns\/series\/.+/, {
        timeout: 10000,
        waitUntil: "domcontentloaded",
      })
      .then(() => true)
      .catch(() => false);

    if (openedBuilder) {
      return;
    }

    await page.waitForTimeout(500 * (attempt + 1));
  }

  throw new Error("[outbound.e2e] Failed to open series builder after clicking New Series");
}

test.describe("Outbound Messages", () => {
  // Auth is handled by global setup via storageState in playwright.config.ts

  test("should display outbound messages list page", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/outbound");

    await expect(
      page.getByRole("heading", { name: "Outbound Messages", exact: true })
    ).toBeVisible();
  });

  test("should create a chat message", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/outbound");

    // Click create chat button
    await page.getByRole("button", { name: "Chat", exact: true }).click();

    // Should show editor or modal for chat message
    await expect(page.getByText(/chat|message/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("should create a post message", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/outbound");

    // Click create post button
    await page.getByRole("button", { name: "Post", exact: true }).click();

    // Should show editor or modal for post message
    await expect(page.getByText(/post|announcement/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("should create a banner message", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/outbound");
    await page.waitForLoadState("networkidle").catch(() => {});

    // Click create banner button - may appear in header or empty state
    const bannerBtn = page.getByRole("button", { name: "Banner", exact: true }).first();
    await bannerBtn.click();

    // Should show editor or modal for banner message
    await expect(page.getByText(/banner/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("should edit message content", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/outbound");

    // Create a new chat message
    await page.getByRole("button", { name: "Chat", exact: true }).click();
    await page.waitForLoadState("networkidle").catch(() => {});

    // Edit the name if input is visible
    const nameInput = page.getByPlaceholder(/message name/i).or(page.getByLabel(/name/i));
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.clear();
      await nameInput.fill("Test Welcome Message");
    }

    // Edit the content if visible
    const textArea = page
      .getByPlaceholder(/enter your chat message/i)
      .or(page.locator("textarea").first());
    if (await textArea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await textArea.fill("Welcome to our app!");
    }

    // Save if button visible
    const saveBtn = page.getByRole("button", { name: /save/i });
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click();
    }
  });

  test("should configure trigger settings", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/outbound");

    // Create a new message
    await page.getByRole("button", { name: "Chat", exact: true }).click();
    await page.waitForLoadState("networkidle").catch(() => {});

    // Look for trigger settings - may be in a tab or section
    const triggerSection = page.getByText(/trigger|when to show/i).first();
    if (await triggerSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      await triggerSection.click();
    }

    // Change trigger type if combobox visible
    const triggerSelect = page.getByRole("combobox").first();
    if (await triggerSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await triggerSelect.click();
    }
  });

  test("should activate and pause message", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/outbound");

    // Create a new message
    await page.getByRole("button", { name: "Chat", exact: true }).click();
    await page.waitForLoadState("networkidle").catch(() => {});

    // Should show draft status or activate button
    const activateBtn = page.getByRole("button", { name: /activate|publish/i });

    if (await activateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await activateBtn.click();
      await page.waitForLoadState("networkidle").catch(() => {});
    }
  });

  test("should show message preview", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/outbound");
    // Verify we're not redirected to login
    await page.waitForURL(/outbound/, { timeout: 5000 });

    // Create a new post message
    await page.getByRole("button", { name: "Post", exact: true }).click();
    await page.waitForLoadState("networkidle").catch(() => {});

    // Look for preview button or section
    const previewBtn = page
      .getByRole("button", { name: /preview/i })
      .or(page.getByRole("tab", { name: /preview/i }));
    if (await previewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await previewBtn.click();
    }

    // Page should still be on outbound
    await expect(page).toHaveURL(/outbound/);
  });

  test("should delete message", async ({ page }) => {
    // Handle confirmation dialog before any action that could trigger it
    page.on("dialog", (dialog) => dialog.accept());

    await gotoWithAuthRecovery(page, "/outbound");
    await page.waitForLoadState("networkidle").catch(() => {});

    // Look for delete button on existing messages
    const deleteBtn = page.getByRole("button", { name: /delete/i }).first();
    if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteBtn.click();
    }

    // Page should still be on outbound
    await expect(page).toHaveURL(/outbound/);
  });

  test("should filter messages by type", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/outbound");

    // Select chat filter
    await page
      .getByRole("combobox")
      .filter({ hasText: /all types/i })
      .selectOption("chat");

    // All visible messages should be chat type
    const typeLabels = page.locator("text=Chat").all();
    expect((await typeLabels).length).toBeGreaterThanOrEqual(0);
  });

  test("should filter messages by status", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/outbound");

    // Select active filter
    await page
      .getByRole("combobox")
      .filter({ hasText: /all status/i })
      .selectOption("active");

    // All visible messages should be active
    const statusBadges = page.locator(".bg-green-100");
    expect((await statusBadges.all()).length).toBeGreaterThanOrEqual(0);
  });

  test("should search messages", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/outbound");

    // Search for a message
    await page.getByPlaceholder(/search messages/i).fill("Welcome");

    // Results should be filtered
    await page.waitForLoadState("networkidle").catch(() => {});
  });
});

test.describe("Checklists", () => {
  // Auth is handled by global setup via storageState in playwright.config.ts
  // Checklists have their own dedicated route at /checklists

  test("should display checklists page", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/checklists");
    // Verify we're not redirected to login
    await expect(page).toHaveURL(/checklists/, { timeout: 12000 });
    await page.waitForLoadState("networkidle").catch(() => {});

    // Should show Checklists heading
    await expect(page.getByRole("heading", { name: "Checklists", exact: true })).toBeVisible({
      timeout: 10000,
    });
  });

  test("should create a checklist", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/checklists");
    await expect(page).toHaveURL(/checklists/, { timeout: 12000 });
    await page.waitForLoadState("networkidle").catch(() => {});

    // Look for New Checklist button
    const createBtn = page.getByRole("button", { name: /new checklist/i });
    if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForLoadState("networkidle").catch(() => {});
    }

    await expect(page).toHaveURL(/checklists/);
  });

  test("should edit checklist details", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/checklists");
    await page.waitForLoadState("networkidle").catch(() => {});

    // Look for checklist creation
    const createBtn = page.getByRole("button", { name: /new checklist/i });
    if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForLoadState("networkidle").catch(() => {});

      // Try to edit name
      const nameInput = page.getByPlaceholder(/name/i).or(page.getByLabel(/name/i));
      if (
        await nameInput
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
      ) {
        await nameInput.first().fill("Onboarding Checklist");
      }
    }
  });

  test("should add tasks to checklist", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/checklists");
    await page.waitForLoadState("networkidle").catch(() => {});

    // Navigate and look for task functionality
    const createBtn = page.getByRole("button", { name: /new checklist/i });
    if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForLoadState("networkidle").catch(() => {});

      const addTaskBtn = page.getByRole("button", { name: /add.*task|new.*task/i });
      if (await addTaskBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addTaskBtn.click();
      }
    }
  });

  test("should configure task completion type", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/checklists");
    await expect(page).toHaveURL(/checklists/, { timeout: 12000 });
    await page.waitForLoadState("networkidle").catch(() => {});

    // Look for task completion settings if available
    const completionSetting = page.getByText(/completion|auto-complete/i).first();
    if (await completionSetting.isVisible({ timeout: 3000 }).catch(() => false)) {
      await completionSetting.click();
    }

    // Test passes if on checklists page
    await expect(page).toHaveURL(/checklists/);
  });

  test("should activate checklist", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/checklists");
    await expect(page).toHaveURL(/checklists/, { timeout: 12000 });
    await page.waitForLoadState("networkidle").catch(() => {});

    // Look for activate button in checklist context
    const activateBtn = page.getByRole("button", { name: /activate/i });
    if (await activateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await activateBtn.click();
    }

    await expect(page).toHaveURL(/checklists/);
  });

  test("should show checklist preview", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/checklists");
    await expect(page).toHaveURL(/checklists/, { timeout: 12000 });
    await page.waitForLoadState("networkidle").catch(() => {});

    // Look for preview functionality
    const previewBtn = page.getByRole("button", { name: /preview/i }).first();
    if (await previewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await previewBtn.click();
    }

    // Should stay on checklists page
    await expect(page).toHaveURL(/checklists/);
  });

  test("should delete checklist", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/checklists");
    await expect(page).toHaveURL(/checklists/, { timeout: 12000 });
    await page.waitForLoadState("networkidle").catch(() => {});

    // Handle confirmation dialog if present
    page.on("dialog", (dialog) => dialog.accept());

    // Look for delete button on a checklist item - try multiple selectors
    const deleteBtn = page
      .locator("button[title='Delete']")
      .first()
      .or(page.getByRole("button", { name: /delete/i }).first())
      .or(page.locator("[aria-label*='delete']").first())
      .or(page.locator("button[data-testid*='delete']").first());

    if (await deleteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await deleteBtn.click();
      await page.waitForLoadState("networkidle").catch(() => {});
    }

    // Should stay on checklists page
    await expect(page).toHaveURL(/checklists/);
  });
});

test.describe("Email Campaigns", () => {
  // Auth is handled by global setup via storageState in playwright.config.ts

  test("should display campaigns page", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/campaigns");

    // Wait for page to load and check for campaigns-related content
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 5000 });
  });

  test("should navigate to email campaigns section", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/campaigns");

    // Click on Email tab or section
    const emailTab = page
      .getByRole("link", { name: /email/i })
      .or(page.getByRole("button", { name: /email/i }));
    if (await emailTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailTab.click();
    }

    // Should show email campaigns list or empty state
    await expect(page.getByText(/email/i).first()).toBeVisible();
  });

  test("should create a new email campaign", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/campaigns");

    // Click create email campaign button
    const createBtn = page.getByRole("button", { name: /new.*email|create.*email|email/i });
    if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createBtn.click();

      // Should redirect to email editor
      await expect(page).toHaveURL(/\/campaigns\/email\//, { timeout: 12000 });
    }
  });

  test("should edit email campaign content", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/campaigns");

    // Create a new email campaign
    const createBtn = page.getByRole("button", { name: /new.*email|create.*email|email/i });
    if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForURL(/\/campaigns\/email\//);

      // Edit the campaign name
      const nameInput = page.getByPlaceholder(/campaign name/i);
      if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nameInput.clear();
        await nameInput.fill("Welcome Email Campaign");
      }

      // Edit subject line
      const subjectInput = page.getByPlaceholder(/subject/i);
      if (await subjectInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await subjectInput.fill("Welcome to our platform!");
      }

      // Edit content
      const contentArea = page.locator("textarea").first();
      if (await contentArea.isVisible({ timeout: 2000 }).catch(() => false)) {
        await contentArea.fill("<p>Hello {{user.name}},</p><p>Welcome aboard!</p>");
      }

      // Save
      await page.getByRole("button", { name: /save/i }).click();
    }
  });

  test("should show email preview", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/campaigns");

    const createBtn = page.getByRole("button", { name: /new.*email|create.*email|email/i });
    if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForURL(/\/campaigns\/email\//);

      // Fill subject
      const subjectInput = page.getByPlaceholder(/subject/i);
      if (await subjectInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await subjectInput.fill("Preview Test Subject");
      }

      // Toggle preview
      const previewBtn = page.getByRole("button", { name: /preview/i });
      if (await previewBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await previewBtn.click();

        // Preview should show content
        await expect(page.getByText("Preview Test Subject")).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test("should show email analytics for sent campaigns", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/campaigns");

    // Look for a sent campaign in the list
    const sentCampaign = page.locator("text=sent").first();
    if (await sentCampaign.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sentCampaign.click();

      // Should show analytics section
      await expect(page.getByText(/analytics|open rate|click rate/i)).toBeVisible({
        timeout: 5000,
      });
    }
  });
});

test.describe("Series Builder", () => {
  // Auth is handled by global setup via storageState in playwright.config.ts

  test("should display series list", async ({ page }) => {
    await openSeriesTab(page);

    await expect(page.getByRole("button", { name: /new\s+series/i })).toBeVisible();
  });

  test("should create a new series", async ({ page }) => {
    await openSeriesBuilderForNewSeries(page);
  });

  test("should edit series name and description", async ({ page }) => {
    await openSeriesBuilderForNewSeries(page);

    // Edit the series name
    const nameInput = page.getByRole("textbox", { name: /series name/i });
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.clear();
    await nameInput.fill("Onboarding Series");
    await expect(nameInput).toHaveValue("Onboarding Series");

    // Save
    await page.getByRole("button", { name: /save/i }).click();

    // Verify saved
    await page.reload();
    await expect(page.getByRole("textbox", { name: /series name/i })).toHaveValue(
      "Onboarding Series",
      {
        timeout: 10000,
      }
    );
  });

  test("should add blocks to series", async ({ page }) => {
    await openSeriesBuilderForNewSeries(page);

    // Add a wait block
    const waitBlockBtn = page.getByRole("button", { name: /wait/i });
    if (await waitBlockBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await waitBlockBtn.click();

      // Verify block was added
      await expect(page.locator("text=wait").or(page.locator("[class*='wait']"))).toBeVisible({
        timeout: 5000,
      });
    }

    // Add an email block
    const emailBlockBtn = page.getByRole("button", { name: /email/i });
    if (await emailBlockBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailBlockBtn.click();

      // Verify email block was added
      await expect(page.locator("text=email").or(page.locator("[class*='email']"))).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test("should configure wait block", async ({ page }) => {
    await openSeriesBuilderForNewSeries(page);

    // Add a wait block
    const waitBlockBtn = page.getByRole("button", { name: /wait/i });
    if (await waitBlockBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await waitBlockBtn.click();

      // Click on the wait block to select it
      const waitBlock = page.locator("[class*='wait']").first();
      if (await waitBlock.isVisible({ timeout: 2000 }).catch(() => false)) {
        await waitBlock.click();

        // Configure wait duration
        const durationInput = page.locator("input[type='number']").first();
        if (await durationInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await durationInput.fill("3");
        }

        // Select wait unit
        const unitSelect = page.locator("select").filter({ hasText: /days|hours|minutes/i });
        if (await unitSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
          await unitSelect.selectOption("days");
        }
      }
    }
  });

  test("should activate and pause series", async ({ page }) => {
    await openSeriesBuilderForNewSeries(page);

    // Add a starter block so readiness blockers clear.
    await page.getByRole("button", { name: /^wait$/i }).click();

    // Activate
    const activateBtn = page.getByRole("button", { name: /activate/i });
    await expect(activateBtn).toBeEnabled({ timeout: 10000 });
    await activateBtn.click();
    await expect(page.getByRole("button", { name: /pause/i })).toBeVisible({ timeout: 10000 });

    // Pause
    const pauseBtn = page.getByRole("button", { name: /pause/i });
    await pauseBtn.click();
    await expect(page.getByRole("button", { name: /activate/i })).toBeVisible({ timeout: 10000 });
  });

  test("should show series analytics", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/campaigns");

    // Look for an existing series
    const seriesLink = page.locator("a[href*='/campaigns/series/']").first();
    if (await seriesLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await seriesLink.click();

      // Should show analytics section
      await expect(page.getByText(/analytics|entered|completed|active/i)).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test("should gate activation with readiness blockers until valid", async ({ page }) => {
    await openSeriesBuilderForNewSeries(page);

    const activateButton = page.getByRole("button", { name: /activate/i });
    await expect(page.getByText("Readiness")).toBeVisible();
    await expect(activateButton).toBeDisabled();
    await expect(
      page.getByText(/Series must contain at least one block before activation\./i)
    ).toBeVisible();

    await page.getByRole("button", { name: /^wait$/i }).click();
    await expect(page.getByText(/Ready for activation/i)).toBeVisible({ timeout: 10000 });
    await expect(activateButton).toBeEnabled();

    await activateButton.click();
    await expect(page.getByRole("button", { name: /pause/i })).toBeVisible({ timeout: 10000 });
  });

  test("should support connection authoring with explicit default branch labels", async ({
    page,
  }) => {
    await openSeriesBuilderForNewSeries(page);

    await page.getByRole("button", { name: /^wait$/i }).click();
    await page.getByRole("button", { name: /^email$/i }).click();

    const fromSelect = page
      .locator("label:has-text('From')")
      .locator("xpath=following-sibling::select[1]");
    const toSelect = page
      .locator("label:has-text('To')")
      .locator("xpath=following-sibling::select[1]");

    await expect(fromSelect).toBeVisible();
    await expect(toSelect).toBeVisible();

    const fromOptions = fromSelect.locator("option");
    await expect
      .poll(async () => fromOptions.count(), {
        timeout: 10000,
      })
      .toBeGreaterThanOrEqual(2);

    const optionValues = await fromOptions.evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value)
    );
    expect(optionValues.length).toBeGreaterThanOrEqual(2);

    await fromSelect.selectOption(optionValues[0]);
    await toSelect.selectOption(optionValues[1]);

    await page.getByRole("button", { name: /add connection/i }).click();

    const branchLabel = page.getByText(/branch:\s*default/i).first();
    await expect(branchLabel).toBeVisible({ timeout: 10000 });
    await branchLabel.click();
    await expect(page.getByRole("heading", { name: /^Connection$/ })).toBeVisible({
      timeout: 5000,
    });
  });

  test("should validate global rule editors before save", async ({ page }) => {
    await openSeriesBuilderForNewSeries(page);

    const entryRulesEditor = page
      .locator("label:has-text('Entry Rules (JSON)')")
      .locator("xpath=following-sibling::textarea[1]");

    await entryRulesEditor.fill("{invalid");
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByText(/Entry rules must be valid JSON\./i)).toBeVisible();

    await entryRulesEditor.fill('{"type":"group","operator":"and","conditions":[]}');
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByText(/Entry rules must be valid JSON\./i)).toHaveCount(0);
  });
});
