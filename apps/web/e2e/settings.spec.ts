import { test, expect } from "./fixtures";
import type { Id } from "@opencom/convex/dataModel";
import {
  ensureAuthenticatedInPage,
  gotoWithAuthRecovery,
  refreshAuthState,
} from "./helpers/auth-refresh";
import { updateWorkspaceMemberPermissions } from "./helpers/test-data";
const hasAdminSecret = Boolean(process.env.TEST_ADMIN_SECRET);

// Auth is handled by global setup via storageState in playwright.config.ts

async function openSettings(page: import("@playwright/test").Page): Promise<void> {
  await gotoWithAuthRecovery(page, "/settings");
  await expect(page.getByRole("heading", { name: /^settings$/i })).toBeVisible({
    timeout: 15000,
  });
}

function getInviteEmailInput(page: import("@playwright/test").Page) {
  return page.locator("input[type='email']").first();
}

async function openTeamMembersSection(page: import("@playwright/test").Page): Promise<void> {
  const sectionContent = page.locator("#team-members-content");
  if (!(await sectionContent.isVisible().catch(() => false))) {
    await page.getByTestId("settings-section-toggle-team-members").click();
  }
  await expect(sectionContent).toBeVisible({ timeout: 15000 });
}

async function openSignupSection(page: import("@playwright/test").Page): Promise<void> {
  const sectionContent = page.locator("#signup-auth-content");
  if (!(await sectionContent.isVisible().catch(() => false))) {
    await page.getByTestId("settings-section-toggle-signup-auth").click();
  }
  await expect(sectionContent).toBeVisible({ timeout: 15000 });
}

async function openSecuritySection(page: import("@playwright/test").Page): Promise<void> {
  const sectionContent = page.locator("#security-content");
  if (!(await sectionContent.isVisible().catch(() => false))) {
    await page.getByTestId("settings-section-toggle-security").click();
  }
  await expect(sectionContent).toBeVisible({ timeout: 15000 });
}

test.describe("Settings & Team Management", () => {
  test.beforeEach(async ({ page }) => {
    await refreshAuthState();
    const ok = await ensureAuthenticatedInPage(page);
    if (!ok) {
      test.skip(true, "[settings.spec] Could not authenticate test page");
    }
  });

  test("should navigate to settings page", async ({ page }) => {
    await openSettings(page);
  });

  test("should display team members section", async ({ page }) => {
    await openSettings(page);
    await openTeamMembersSection(page);
    await expect(page.locator("#team-members").getByText("Invite Team Member")).toBeVisible();
  });

  test("should show current user in team list", async ({ page, testState }) => {
    await openSettings(page);
    await openTeamMembersSection(page);
    const userEmail = page.getByText(testState.email, { exact: false }).first();
    await expect(userEmail).toBeVisible({ timeout: 15000 });
  });

  test("should show invite team member form", async ({ page }) => {
    await openSettings(page);
    await openTeamMembersSection(page);
    // Invite form is always visible inline (not behind a button click)
    // It has "Invite Team Member" text and an email input
    await expect(page.getByText("Invite Team Member")).toBeVisible({ timeout: 15000 });
    // Email input is an input[type=email]
    const emailInput = getInviteEmailInput(page);
    await expect(emailInput).toBeVisible({ timeout: 5000 });
  });

  test("should validate email format for invitation", async ({ page }) => {
    await openSettings(page);
    await openTeamMembersSection(page);
    // The invite email input uses HTML type="email" validation
    const emailInput = getInviteEmailInput(page);
    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await emailInput.fill("invalid-email");

    // Validate browser-side email validity for the invitation field
    const isValid = await emailInput.evaluate((el) => (el as HTMLInputElement).checkValidity());
    expect(isValid).toBe(false);
  });

  test("should show role selector for invitations", async ({ page }) => {
    await openSettings(page);
    await openTeamMembersSection(page);
    // The role selector is a <select> with options Viewer, Agent, Admin
    const roleSelector = page.locator("select").filter({ hasText: /viewer/i });
    await expect(roleSelector.first()).toBeVisible({ timeout: 15000 });
  });

  test("should show authentication settings", async ({ page }) => {
    await openSettings(page);
    await openSignupSection(page);
    // Auth settings are under "Signup Settings" > "Authentication Methods"
    await expect(
      page.locator("#signup-auth label").filter({ hasText: /^Authentication Methods$/ })
    ).toBeVisible({ timeout: 15000 });
  });

  test("should show security permission denied state when settings.security is missing", async ({
    page,
    testState,
  }) => {
    test.skip(!hasAdminSecret, "TEST_ADMIN_SECRET is required for permission mutation checks.");
    const workspaceId = testState.workspaceId as Id<"workspaces">;

    try {
      await updateWorkspaceMemberPermissions(workspaceId, testState.email, [
        "settings.workspace",
        "users.read",
      ]);
      await openSettings(page);
      await openSecuritySection(page);

      await expect(page.getByTestId("security-settings-denied")).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId("security-settings-denied")).toContainText(
        /permission denied/i
      );
    } finally {
      await updateWorkspaceMemberPermissions(workspaceId, testState.email, []);
    }
  });
});
