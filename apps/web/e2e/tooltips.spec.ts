import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import type { Id } from "@opencom/convex/dataModel";
import {
  cleanupTestData,
  completeTooltipAuthoringSession,
  updateWorkspaceMemberPermissions,
  validateTooltipAuthoringToken,
} from "./helpers/test-data";
import { ensureAuthenticatedInPage } from "./helpers/auth-refresh";
import { getTestState } from "./helpers/test-state";

function requireTestContext(): { workspaceId: Id<"workspaces">; userEmail: string } {
  const state = getTestState();
  if (!state?.workspaceId || !state.email) {
    throw new Error("Missing workspaceId/email in apps/web/e2e/.e2e-state.json");
  }
  return {
    workspaceId: state.workspaceId as Id<"workspaces">,
    userEmail: state.email,
  };
}

async function ensureAuthed(page: Page): Promise<void> {
  const authed = await ensureAuthenticatedInPage(page);
  expect(authed).toBe(true);
}

async function openTooltipsPage(page: Page): Promise<void> {
  await page.goto("/tooltips", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("tooltips-page-heading")).toBeVisible({ timeout: 15000 });
}

async function submitTooltipForm(page: Page): Promise<void> {
  await page
    .getByTestId("tooltip-form")
    .evaluate((form) => (form as HTMLFormElement).requestSubmit());
}

test.describe.serial("Tooltips", () => {
  let workspaceId: Id<"workspaces">;
  let userEmail: string;

  test.beforeAll(() => {
    const context = requireTestContext();
    workspaceId = context.workspaceId;
    userEmail = context.userEmail;
  });

  test.beforeEach(async ({ page }) => {
    await ensureAuthed(page);
    await cleanupTestData(workspaceId);
    await updateWorkspaceMemberPermissions(workspaceId, userEmail, []);
    await openTooltipsPage(page);
  });

  test.afterEach(async () => {
    await updateWorkspaceMemberPermissions(workspaceId, userEmail, []);
  });

  test("covers create/edit/delete, visual picker completion, warnings, and invalid token rejection", async ({
    page,
  }) => {
    // Create + edit + delete tooltip.
    await page.getByTestId("tooltips-new-button").click();
    await expect(page.getByTestId("tooltip-modal")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("tooltip-name-input").fill("Tooltip CRUD Test");
    await page.getByTestId("tooltip-selector-input").fill("#tour-target-1");
    await page.getByTestId("tooltip-content-input").fill("Initial tooltip content");
    await submitTooltipForm(page);
    await openTooltipsPage(page);

    const crudCard = page
      .locator("[data-testid^='tooltip-card-']")
      .filter({ hasText: "Tooltip CRUD Test" });
    await expect(crudCard).toHaveCount(1, { timeout: 10000 });
    await crudCard.locator("[data-testid^='tooltip-edit-']").click();
    await page.getByTestId("tooltip-content-input").fill("Updated tooltip content");
    await submitTooltipForm(page);
    await expect(crudCard).toContainText("Updated tooltip content");
    page.once("dialog", (dialog) => dialog.accept());
    await crudCard.locator("[data-testid^='tooltip-delete-']").click();
    await expect(crudCard).toHaveCount(0, { timeout: 10000 });

    // Visual picker completion (deterministic backend completion).
    await page.getByTestId("tooltips-new-button").click();
    await page.getByTestId("tooltip-name-input").fill("Tooltip Picker Test");
    await page.getByTestId("tooltip-content-input").fill("Selected visually");
    await page.getByTestId("tooltip-pick-element-button").click();
    await expect(page.getByTestId("tooltip-picker-modal")).toBeVisible({ timeout: 5000 });
    await page
      .getByTestId("tooltip-picker-url-input")
      .fill(`http://localhost:3000/widget-demo?workspaceId=${workspaceId}`);

    const [pickerPage] = await Promise.all([
      page.waitForEvent("popup", { timeout: 15000 }),
      page.getByTestId("tooltip-picker-open-button").click(),
    ]);
    await expect(page.getByTestId("tooltip-picker-pending")).toBeVisible({ timeout: 10000 });
    await pickerPage.waitForURL(/opencom_tooltip_authoring=/, { timeout: 15000 });
    const token = new URL(pickerPage.url()).searchParams.get("opencom_tooltip_authoring");
    expect(token).toBeTruthy();
    await completeTooltipAuthoringSession(workspaceId, token!, "#tour-target-2");
    await pickerPage.close();
    await expect(page.getByTestId("tooltip-selector-input")).toHaveValue("#tour-target-2", {
      timeout: 15000,
    });

    // Selector warning UI + invalid token backend rejection.
    await page
      .getByTestId("tooltip-selector-input")
      .fill("main > div:nth-of-type(2) > span:nth-child(1)");
    const warningPanel = page.getByTestId("tooltip-selector-quality-warning");
    await expect(warningPanel).toBeVisible({ timeout: 5000 });
    await expect(warningPanel).toContainText(/positional matching/i);

    const invalid = await validateTooltipAuthoringToken(workspaceId, "invalid-token-12345");
    expect(invalid.valid).toBe(false);
    expect(invalid.reason ?? "").toMatch(/session not found/i);
  });
});
