import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import type { Id } from "@opencom/convex/dataModel";
import {
  cleanupTestData,
  seedCarousel,
  updateWorkspaceMemberPermissions,
} from "./helpers/test-data";
import {
  ensureAuthenticatedInPage,
  gotoWithAuthRecovery,
  refreshAuthState,
} from "./helpers/auth-refresh";
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

async function ensureAuthenticated(page: Page): Promise<void> {
  const refreshed = await refreshAuthState();
  expect(refreshed).toBe(true);
  const authed = await ensureAuthenticatedInPage(page);
  expect(authed).toBe(true);
}

async function openCarouselsTab(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await gotoWithAuthRecovery(page, "/campaigns");
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
      await page.waitForTimeout(500);
      continue;
    }

    const carouselsTab = page.getByRole("button", { name: /^carousels/i }).first();
    if (!(await carouselsTab.isVisible({ timeout: 8000 }).catch(() => false))) {
      await page.waitForTimeout(400);
      continue;
    }
    await carouselsTab.click();

    const ready = await page
      .getByRole("button", { name: /^new carousel$/i })
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    if (ready) {
      return;
    }
  }

  await expect(page.getByRole("button", { name: /^new carousel$/i })).toBeVisible({
    timeout: 15000,
  });
}

test.describe.serial("Web Admin - Carousel Management", () => {
  test.describe.configure({ timeout: 120000 });

  let workspaceId: Id<"workspaces">;
  let userEmail: string;

  test.beforeAll(() => {
    const context = requireTestContext();
    workspaceId = context.workspaceId;
    userEmail = context.userEmail;
  });

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await cleanupTestData(workspaceId);
    await updateWorkspaceMemberPermissions(workspaceId, userEmail, []);
  });

  test.afterEach(async () => {
    await updateWorkspaceMemberPermissions(workspaceId, userEmail, []);
  });

  test("runs deterministic activate/pause/duplicate/delete lifecycle", async ({ page }) => {
    const seeded = await seedCarousel(workspaceId, {
      name: `e2e_test_carousel_lifecycle_${Date.now()}`,
      status: "draft",
      screens: [
        {
          title: "Welcome",
          body: "Lifecycle scenario",
        },
      ],
    });

    await openCarouselsTab(page);

    const statusToggle = page.getByTestId(`carousel-status-toggle-${seeded.carouselId}`);
    await statusToggle.click();
    await expect(page.getByTestId(`carousel-row-${seeded.carouselId}`)).toContainText(/active/i, {
      timeout: 10000,
    });

    await statusToggle.click();
    await expect(page.getByTestId(`carousel-row-${seeded.carouselId}`)).toContainText(/paused/i, {
      timeout: 10000,
    });

    await page.getByTestId(`carousel-duplicate-${seeded.carouselId}`).click();
    const openedDetail = await page
      .waitForURL(/\/campaigns\/carousels\/[a-z0-9]+/, {
        timeout: 15000,
        waitUntil: "domcontentloaded",
      })
      .then(() => true)
      .catch(() => false);
    if (!openedDetail) {
      await expect(
        page
          .locator("tbody tr")
          .filter({ hasText: new RegExp(`${seeded.name}\\s*\\(Copy\\)`, "i") })
          .first()
      ).toBeVisible({ timeout: 15000 });
    }

    await openCarouselsTab(page);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByTestId(`carousel-delete-${seeded.carouselId}`).click();
    await expect(page.getByTestId(`carousel-row-${seeded.carouselId}`)).toHaveCount(0, {
      timeout: 10000,
    });
  });

  test("surfaces editor validation errors for CTA URLs and deep links", async ({ page }) => {
    const seeded = await seedCarousel(workspaceId, {
      name: `e2e_test_carousel_validation_${Date.now()}`,
      status: "draft",
      screens: [
        {
          title: "Validation",
          body: "CTA checks",
        },
      ],
    });

    await gotoWithAuthRecovery(page, `/campaigns/carousels/${seeded.carouselId}`);
    await expect(page.getByTestId("carousel-name-input")).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: /add button/i }).click();
    await page.getByTestId("carousel-button-action-select").first().selectOption("url");
    await page.getByTestId("carousel-button-url-input").first().fill("invalid-url");
    await page.getByTestId("carousel-save-button").click();

    await expect(page.getByTestId("carousel-validation-errors")).toContainText(
      /valid http\(s\) url/i
    );

    await page
      .getByTestId("carousel-button-url-input")
      .first()
      .fill("https://example.com/features");
    await page.getByTestId("carousel-button-action-select").first().selectOption("deeplink");
    await page.getByTestId("carousel-button-deeplink-input").first().fill("not-a-deeplink");
    await page.getByTestId("carousel-save-button").click();

    await expect(page.getByTestId("carousel-validation-errors")).toContainText(/valid deep link/i);

    await page
      .getByTestId("carousel-button-deeplink-input")
      .first()
      .fill("myapp://onboarding/next");
    await page.getByTestId("carousel-save-button").click();
    await expect(page.getByTestId("carousel-editor-errors")).toHaveCount(0);
  });
});
