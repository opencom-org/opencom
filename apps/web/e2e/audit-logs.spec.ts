import { test, expect } from "./fixtures";
import type { Id } from "@opencom/convex/dataModel";
import {
  ensureAuthenticatedInPage,
  gotoWithAuthRecovery,
  refreshAuthState,
} from "./helpers/auth-refresh";
import { createTestAuditLog } from "./helpers/test-data";

const AUTH_ROUTE_RE = /\/(login|signup)(\/|$|\?)/;

function isAuthRoute(page: import("@playwright/test").Page): boolean {
  try {
    return AUTH_ROUTE_RE.test(new URL(page.url()).pathname);
  } catch {
    return AUTH_ROUTE_RE.test(page.url());
  }
}

async function isAuthUiVisible(page: import("@playwright/test").Page): Promise<boolean> {
  const signInHeading = page.getByRole("heading", { name: /sign in to your account/i }).first();
  if (await signInHeading.isVisible({ timeout: 1000 }).catch(() => false)) {
    return true;
  }

  const sendCodeButton = page.getByRole("button", { name: /send verification code/i }).first();
  if (await sendCodeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    return true;
  }

  const passwordButton = page.getByRole("button", { name: /sign in with password/i }).first();
  return passwordButton.isVisible({ timeout: 1000 }).catch(() => false);
}

async function openAuditLogsTable(page: import("@playwright/test").Page): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await gotoWithAuthRecovery(page, "/audit-logs");
    } catch (error) {
      if (attempt === 4) {
        throw error;
      }
      await page.waitForTimeout(500);
      continue;
    }

    if (isAuthRoute(page) || (await isAuthUiVisible(page))) {
      const recovered = await ensureAuthenticatedInPage(page);
      if (!recovered && attempt === 4) {
        throw new Error("[audit-logs.spec] Could not recover auth before opening logs table");
      }
      await page.waitForTimeout(500);
      continue;
    }

    const viewLogsButton = page.getByRole("button", { name: /view logs/i }).first();
    if (!(await viewLogsButton.isVisible({ timeout: 8000 }).catch(() => false))) {
      await page.waitForTimeout(400);
      continue;
    }
    await viewLogsButton.click();

    if (
      isAuthRoute(page) ||
      (await isAuthUiVisible(page)) ||
      (await page
        .getByTestId("audit-logs-read-unauthenticated")
        .isVisible({ timeout: 2000 })
        .catch(() => false))
    ) {
      const recovered = await ensureAuthenticatedInPage(page);
      if (!recovered && attempt === 4) {
        throw new Error("[audit-logs.spec] Could not recover auth after opening logs view");
      }
      await page.waitForTimeout(500);
      continue;
    }

    const hasRows = await page
      .locator("tbody tr")
      .first()
      .isVisible({ timeout: 12000 })
      .catch(() => false);
    if (hasRows) {
      return;
    }

    await page.waitForTimeout(600);
  }

  await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 25000 });
}

test.describe.serial("Web Admin - Audit Logs", () => {
  test.describe.configure({ timeout: 120000 });

  const SEED_TIMESTAMP_OFFSET_MS = 60_000;

  test.beforeEach(async ({ page }) => {
    await refreshAuthState();
    const ok = await ensureAuthenticatedInPage(page);
    if (!ok) {
      test.skip(true, "[audit-logs.spec] Could not authenticate test page");
    }
  });

  test("should navigate to audit logs page", async ({ page }) => {
    await gotoWithAuthRecovery(page, "/audit-logs");
    await expect(page.getByRole("heading", { level: 1, name: /^audit logs$/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test("should display seeded audit entries and show detail metadata", async ({
    page,
    testState,
  }) => {
    const workspaceId = testState.workspaceId as Id<"workspaces">;
    const marker = `audit-e2e-${Date.now()}`;

    await createTestAuditLog(workspaceId, {
      action: "workspace.security.changed",
      resourceType: "workspace",
      resourceId: marker,
      metadata: {
        setting: "allowedOrigins",
        marker,
      },
      timestamp: Date.now() - SEED_TIMESTAMP_OFFSET_MS,
    });

    await openAuditLogsTable(page);

    const firstDataRow = page.locator("tbody tr").first();
    await expect(firstDataRow).toBeVisible({ timeout: 15000 });
    await firstDataRow.click();

    await expect(page.getByText(/event details/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/allowedOrigins/i)).toBeVisible({ timeout: 5000 });
    await expect(page.locator("pre").filter({ hasText: marker })).toBeVisible({ timeout: 5000 });
  });

  test("should filter audit logs by resource type", async ({ page, testState }) => {
    const workspaceId = testState.workspaceId as Id<"workspaces">;
    const keepAction = "workspace.security.changed";
    const skipAction = "user.role.changed";

    await createTestAuditLog(workspaceId, {
      action: keepAction,
      resourceType: "workspace",
      resourceId: `audit-filter-keep-${Date.now()}`,
      metadata: { marker: "keep" },
      timestamp: Date.now() - SEED_TIMESTAMP_OFFSET_MS,
    });
    await createTestAuditLog(workspaceId, {
      action: skipAction,
      resourceType: "integration",
      resourceId: `audit-filter-skip-${Date.now()}`,
      metadata: { marker: "skip" },
      timestamp: Date.now() - SEED_TIMESTAMP_OFFSET_MS,
    });

    await openAuditLogsTable(page);

    const actionFilter = page.locator("select").first();
    await expect(actionFilter).toBeVisible({ timeout: 5000 });
    await actionFilter.selectOption(keepAction);

    const tableRows = page.locator("tbody tr");
    await expect(
      tableRows.filter({ hasText: /Workspace → Security → Changed/i }).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(tableRows.filter({ hasText: /User → Role → Changed/i })).toHaveCount(0);
  });

  test("should trigger filtered export", async ({ page, testState }) => {
    const workspaceId = testState.workspaceId as Id<"workspaces">;
    const marker = `audit-export-${Date.now()}`;

    await createTestAuditLog(workspaceId, {
      action: "user.role.changed",
      resourceType: "workspaceMember",
      resourceId: marker,
      metadata: { marker },
      timestamp: Date.now() - SEED_TIMESTAMP_OFFSET_MS,
    });

    await openAuditLogsTable(page);

    await page.getByPlaceholder(/resource type/i).fill("workspaceMember");
    await page.getByPlaceholder(/resource id/i).fill(marker);

    await page.getByRole("button", { name: /export json/i }).click();
    await expect(page.getByText(/Exported \d+ matching audit entries\./i)).toBeVisible({
      timeout: 15000,
    });
  });
});
