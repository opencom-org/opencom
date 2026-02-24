import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import type { Id } from "@opencom/convex/dataModel";
import { cleanupTestData, seedTour, updateWorkspaceMemberPermissions } from "./helpers/test-data";
import { ensureAuthenticatedInPage } from "./helpers/auth-refresh";
import { getTestState } from "./helpers/test-state";
import { waitForWidgetLoad } from "./helpers/widget-helpers";

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

function widgetFixtureUrl(workspaceId: Id<"workspaces">, fixture: string): string {
  return `/widget-demo?workspaceId=${workspaceId}&fixture=${fixture}`;
}

async function ensureAuthed(page: Page): Promise<void> {
  const authed = await ensureAuthenticatedInPage(page);
  expect(authed).toBe(true);
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
      return {
        canStart,
        canListTours,
        hasTargetTour,
        availableTourIds: availableTours.map((tour) => tour.id),
      };
    }, tourId);

    if (readiness.canStart && readiness.hasTargetTour) {
      await page.evaluate((id: string) => {
        window.OpencomWidget?.startTour(id);
      }, tourId);
      return;
    }

    await page.waitForTimeout(pollMs);
  }

  const debug = await page.evaluate(() => {
    const widget = window.OpencomWidget;
    const availableTours =
      typeof widget?.getAvailableTours === "function" ? widget.getAvailableTours() : [];
    return {
      widgetType: typeof widget,
      widgetKeys: widget && typeof widget === "object" ? Object.keys(widget) : [],
      startTourType: typeof widget?.startTour,
      getAvailableToursType: typeof widget?.getAvailableTours,
      availableTourIds: availableTours.map((tour) => tour.id),
      scriptSources: Array.from(document.scripts)
        .map((script) => script.src)
        .filter((src) => src.includes("opencom-widget")),
    };
  });

  throw new Error(
    `window.OpencomWidget.startTour was not available within timeout: ${JSON.stringify(debug)}`
  );
}

test.describe.serial("Tours", () => {
  test.describe.configure({ timeout: 90000 });

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
  });

  test.afterEach(async () => {
    await cleanupTestData(workspaceId);
    await updateWorkspaceMemberPermissions(workspaceId, userEmail, []);
  });

  test("persists checkpoints across navigation/reload and enforces advancement modes", async ({
    page,
  }) => {
    const step1Url = widgetFixtureUrl(workspaceId, "tour-step-1");
    const step2Url = widgetFixtureUrl(workspaceId, "tour-step-2");
    const tourName = `e2e_test_tour_reliability_${Date.now()}`;

    const seededTour = await seedTour(workspaceId, {
      name: tourName,
      status: "active",
      targetPageUrl: "/widget-demo*",
      steps: [
        {
          type: "post",
          title: "Welcome",
          content: "Start this deterministic tour.",
          routePath: `/widget-demo?workspaceId=${workspaceId}&fixture=tour-step-1`,
          advanceOn: "click",
        },
        {
          type: "pointer",
          title: "Click Target",
          content: "Click the highlighted element to continue.",
          elementSelector: "[data-testid='tour-target-1']",
          routePath: `/widget-demo?workspaceId=${workspaceId}&fixture=tour-step-1`,
          advanceOn: "elementClick",
        },
        {
          type: "pointer",
          title: "Missing Selector",
          content: "This step will be skipped deterministically.",
          elementSelector: "[data-testid='tour-target-missing']",
          routePath: `/widget-demo?workspaceId=${workspaceId}&fixture=tour-step-1`,
          advanceOn: "click",
        },
        {
          type: "pointer",
          title: "Fill Field",
          content: "Enter text in the form field to finish.",
          elementSelector: "[data-testid='name-input']",
          routePath: `/widget-demo?workspaceId=${workspaceId}&fixture=tour-step-2`,
          advanceOn: "fieldFill",
        },
      ],
    });

    await page.goto(step1Url, { waitUntil: "domcontentloaded" });
    await waitForWidgetLoad(page);
    await waitForAndStartTour(page, seededTour.tourId);

    await expect(page.getByTestId("tour-step-card")).toBeVisible({ timeout: 15000 });
    await page.getByTestId("tour-primary-action").click();

    await expect(page.getByTestId("tour-advance-guidance")).toContainText(
      /click the highlighted element/i
    );
    await expect(page.getByTestId("tour-primary-action")).toHaveCount(0);
    await page.evaluate(() => {
      const target = document.querySelector<HTMLElement>("[data-testid='tour-target-1']");
      target?.click();
    });

    await expect(page.getByTestId("tour-route-hint")).toBeVisible({ timeout: 15000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForWidgetLoad(page);
    await expect(page.getByTestId("tour-route-hint")).toBeVisible({ timeout: 15000 });

    await page.goto(step2Url, { waitUntil: "domcontentloaded" });
    await waitForWidgetLoad(page);

    await expect(page.getByTestId("tour-step-card")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("tour-advance-guidance")).toContainText(
      /fill in the highlighted field/i
    );
    await expect(page.getByTestId("tour-primary-action")).toHaveCount(0);

    await page.getByTestId("name-input").fill("Tour Resume User");

    await expect(page.getByTestId("tour-overlay")).toHaveCount(0, { timeout: 15000 });
  });

  test("keeps tour primary and dismiss controls reachable on constrained viewport", async ({
    page,
  }) => {
    const fixtureUrl = widgetFixtureUrl(workspaceId, "tour-step-1");
    const tourName = `e2e_test_tour_compact_controls_${Date.now()}`;
    const longContent =
      "This is intentionally long tour content to force constrained overlay behavior and verify that progression and dismiss actions stay visible within compact viewport bounds.";

    const seededTour = await seedTour(workspaceId, {
      name: tourName,
      status: "active",
      targetPageUrl: "/widget-demo*",
      steps: [
        {
          type: "post",
          title: "Compact Post Step",
          content: `${longContent} ${longContent}`,
          routePath: `/widget-demo?workspaceId=${workspaceId}&fixture=tour-step-1`,
          advanceOn: "click",
        },
        {
          type: "pointer",
          title: "Compact Pointer Step",
          content: `${longContent} ${longContent}`,
          elementSelector: "[data-testid='tour-target-1']",
          routePath: `/widget-demo?workspaceId=${workspaceId}&fixture=tour-step-1`,
          advanceOn: "click",
        },
      ],
    });

    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(fixtureUrl, { waitUntil: "domcontentloaded" });
    await waitForWidgetLoad(page);
    await waitForAndStartTour(page, seededTour.tourId);

    await expect(page.getByTestId("tour-step-card")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("tour-primary-action")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Dismiss tour" })).toBeVisible({
      timeout: 10000,
    });

    await page.getByTestId("tour-primary-action").click();

    await expect(page.getByTestId("tour-step-card")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("tour-step-card")).toHaveAttribute(
      "data-tour-layout",
      /(anchored|fallback)/
    );
    await expect(page.getByTestId("tour-primary-action")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Dismiss tour" })).toBeVisible({
      timeout: 10000,
    });
  });
});
