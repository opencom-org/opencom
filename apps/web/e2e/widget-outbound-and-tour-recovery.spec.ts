import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import type { Id } from "@opencom/convex/dataModel";
import { cleanupTestData, seedOutboundMessage, seedTour } from "./helpers/test-data";
import {
  ensureAuthenticatedInPage,
  gotoWithAuthRecovery,
  refreshAuthState,
} from "./helpers/auth-refresh";
import { getTestState } from "./helpers/test-state";
import { isOutboundMessageVisible, waitForWidgetLoad } from "./helpers/widget-helpers";

function requireWorkspaceId(): Id<"workspaces"> {
  const state = getTestState();
  if (!state?.workspaceId) {
    throw new Error("Missing workspaceId in apps/web/e2e/.e2e-state.json");
  }
  return state.workspaceId as Id<"workspaces">;
}

function widgetDemoUrl(workspaceId: Id<"workspaces">, fixture?: string): string {
  const params = new URLSearchParams({ workspaceId });
  if (fixture) {
    params.set("fixture", fixture);
  }
  return `/widget-demo?${params.toString()}`;
}

async function waitForAndStartTour(page: Page, tourId: string): Promise<void> {
  const timeoutMs = 20000;
  const pollMs = 250;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const readiness = await page.evaluate((id: string) => {
      const widget = window.OpencomWidget;
      const canStart = typeof widget?.startTour === "function";
      const canListTours = typeof widget?.getAvailableTours === "function";
      const availableTours = canListTours ? widget.getAvailableTours() : [];
      const hasTargetTour = availableTours.some((tour) => tour.id === id);
      return { canStart, hasTargetTour };
    }, tourId);

    if (readiness.canStart && readiness.hasTargetTour) {
      await page.evaluate((id: string) => {
        window.OpencomWidget?.startTour(id);
      }, tourId);
      return;
    }

    await page.waitForTimeout(pollMs);
  }

  throw new Error(`window.OpencomWidget.startTour(${tourId}) was not available within timeout`);
}

test.describe.serial("Widget reliability: outbounds + tour recovery", () => {
  let workspaceId: Id<"workspaces">;
  const hasAdminSecret = Boolean(process.env.TEST_ADMIN_SECRET);

  test.beforeAll(() => {
    workspaceId = requireWorkspaceId();
  });

  test.beforeEach(async ({ page }) => {
    test.skip(!hasAdminSecret, "TEST_ADMIN_SECRET is required for test data seeding/cleanup.");

    await refreshAuthState();
    const authed = await ensureAuthenticatedInPage(page);
    expect(authed).toBe(true);
    await cleanupTestData(workspaceId);
  });

  test.afterEach(async () => {
    if (!hasAdminSecret) {
      return;
    }
    await cleanupTestData(workspaceId);
  });

  test("outbound appears without opening the widget", async ({ page }) => {
    await seedOutboundMessage(workspaceId, {
      name: `e2e_test_preopen_outbound_${Date.now()}`,
      type: "chat",
      status: "active",
      triggerType: "immediate",
    });

    await gotoWithAuthRecovery(page, widgetDemoUrl(workspaceId));
    const widget = await waitForWidgetLoad(page, 15000);

    await expect(widget.locator(".opencom-chat")).toHaveCount(0);

    await expect
      .poll(async () => isOutboundMessageVisible(page), {
        timeout: 20000,
        message: "Expected outbound message to render before opening launcher",
      })
      .toBe(true);

    await expect(widget.locator(".opencom-chat")).toHaveCount(0);
  });

  test("misconfigured tour step has graceful recovery or guaranteed escape", async ({ page }) => {
    const fixture = "tour-step-1";
    const tourName = `e2e_test_tour_recovery_${Date.now()}`;

    const seededTour = await seedTour(workspaceId, {
      name: tourName,
      status: "active",
      targetPageUrl: "/widget-demo*",
      steps: [
        {
          type: "pointer",
          title: "Broken Step",
          content: "This step has an invalid selector and must not trap the visitor.",
          elementSelector: "[data-testid='invalid-selector'",
          routePath: `/widget-demo?workspaceId=${workspaceId}&fixture=${fixture}`,
          advanceOn: "elementClick",
        },
      ],
    });

    await gotoWithAuthRecovery(page, widgetDemoUrl(workspaceId, fixture));
    await waitForWidgetLoad(page, 15000);
    await waitForAndStartTour(page, seededTour.tourId);

    await expect
      .poll(
        async () => {
          const overlayCount = await page.getByTestId("tour-overlay").count();
          if (overlayCount === 0) {
            return "closed";
          }
          const recoveryVisible = await page
            .getByTestId("tour-recovery-hint")
            .isVisible()
            .catch(() => false);
          return recoveryVisible ? "recovery" : "pending";
        },
        { timeout: 15000 }
      )
      .toMatch(/closed|recovery/);

    const overlayCount = await page.getByTestId("tour-overlay").count();
    if (overlayCount > 0) {
      await expect(page.getByTestId("tour-emergency-close")).toBeVisible({ timeout: 5000 });
      await page.getByTestId("tour-emergency-close").click();
    }

    await expect(page.getByTestId("tour-overlay")).toHaveCount(0, { timeout: 10000 });
  });
});
