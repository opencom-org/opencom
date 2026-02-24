import { test, expect } from "./fixtures";
import type { Page, Locator } from "@playwright/test";
import type { Id } from "@opencom/convex/dataModel";
import {
  cleanupTestData,
  createInboxConversationFixture,
  setInboxConversationStatus,
  upsertAutomationSettings,
} from "./helpers/test-data";
import {
  ensureAuthenticatedInPage,
  gotoWithAuthRecovery,
  refreshAuthState,
} from "./helpers/auth-refresh";
import { getTestState } from "./helpers/test-state";
import { openWidgetChat } from "./helpers/widget-helpers";

type ViewportCase = {
  name: string;
  width: number;
  height: number;
};

const VIEWPORT_CASES: ViewportCase[] = [
  { name: "desktop", width: 1366, height: 900 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 },
];

const WIDGET_TEST_EMAIL = "e2e_test_visitor@test.opencom.dev";
const AUTH_ROUTE_RE = /\/(login|signup)(\/|$|\?)/;

function requireWorkspaceId(): Id<"workspaces"> {
  const state = getTestState();
  if (!state?.workspaceId) {
    throw new Error("Missing workspaceId in apps/web/e2e/.e2e-state.json");
  }
  return state.workspaceId as Id<"workspaces">;
}

function widgetDemoUrl(workspaceId: Id<"workspaces">): string {
  return `/widget-demo?workspaceId=${workspaceId}`;
}

function isAuthRoute(page: Page): boolean {
  try {
    return AUTH_ROUTE_RE.test(new URL(page.url()).pathname);
  } catch {
    return AUTH_ROUTE_RE.test(page.url());
  }
}

async function gotoProtectedRoute(page: Page, path: string, readyLocator: Locator): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await gotoWithAuthRecovery(page, path);
    const ready = await readyLocator.isVisible({ timeout: 10000 }).catch(() => false);
    if (!isAuthRoute(page) && ready) {
      return;
    }

    const authRecovered = await ensureAuthenticatedInPage(page);
    if (!authRecovered) {
      await page.waitForTimeout(500);
    }
  }

  throw new Error(`Could not open ${path} in an authenticated state`);
}

async function openFirstWidgetConversation(
  page: Page,
  workspaceId: Id<"workspaces">
): Promise<Locator> {
  await gotoWithAuthRecovery(page, widgetDemoUrl(workspaceId));

  const widget = await openWidgetChat(page);

  const messagesTab = widget.getByRole("button", { name: /^messages$/i }).first();
  if (await messagesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await messagesTab.click();
  }

  const conversationItem = widget.locator(".opencom-conversation-item").first();
  await expect(conversationItem).toBeVisible({ timeout: 10000 });
  await conversationItem.click();

  await expect(widget.getByTestId("widget-message-list")).toBeVisible({ timeout: 10000 });
  return widget;
}

test.describe("CSAT deterministic lifecycle", () => {
  test.describe.configure({ timeout: 120000 });

  let workspaceId: Id<"workspaces">;

  test.beforeAll(() => {
    workspaceId = requireWorkspaceId();
  });

  test.beforeEach(async ({ page }) => {
    await refreshAuthState();
    const authOk = await ensureAuthenticatedInPage(page);
    if (!authOk) {
      throw new Error("Failed to authenticate CSAT E2E context");
    }

    await page.addInitScript((workspaceIdValue: string) => {
      window.localStorage.setItem(
        "opencom_active_workspace",
        JSON.stringify({ _id: workspaceIdValue })
      );
    }, workspaceId);

    await cleanupTestData(workspaceId);
    await upsertAutomationSettings(workspaceId, {
      askForRatingEnabled: true,
      collectEmailEnabled: false,
      showReplyTimeEnabled: false,
      suggestArticlesEnabled: false,
    });
  });

  test.afterEach(async () => {
    await upsertAutomationSettings(workspaceId, {
      askForRatingEnabled: true,
      collectEmailEnabled: true,
      showReplyTimeEnabled: false,
      suggestArticlesEnabled: false,
    });
  });

  for (const viewport of VIEWPORT_CASES) {
    test(`shows CSAT prompt interaction on ${viewport.name} viewport`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      const seeded = await createInboxConversationFixture(workspaceId, {
        visitorEmail: WIDGET_TEST_EMAIL,
        visitorName: `E2E CSAT ${viewport.name}`,
        status: "open",
        initialMessages: [
          { content: `CSAT viewport ${viewport.name} seed`, senderType: "visitor" },
        ],
      });

      const widget = await openFirstWidgetConversation(page, workspaceId);

      await expect(widget.getByTestId("widget-csat-prompt")).toHaveCount(0);
      await setInboxConversationStatus(seeded.conversationId, "closed");

      await expect(widget.getByTestId("widget-conversation-status")).toBeVisible({
        timeout: 10000,
      });
      await expect(widget.getByTestId("widget-csat-prompt")).toBeVisible({ timeout: 10000 });

      await widget.getByTestId("widget-csat-rating-4").click();
      await expect(widget.getByTestId("widget-csat-feedback-input")).toBeVisible({ timeout: 5000 });

      await widget.getByTestId("widget-csat-close").click();
      await expect(widget.getByTestId("widget-csat-prompt")).toHaveCount(0, { timeout: 5000 });
    });
  }

  test("resolve -> prompt -> submit -> report visibility", async ({ page }) => {
    const seeded = await createInboxConversationFixture(workspaceId, {
      visitorEmail: WIDGET_TEST_EMAIL,
      visitorName: "E2E CSAT Flow",
      status: "open",
      initialMessages: [{ content: "Please close and rate this", senderType: "visitor" }],
    });

    const widget = await openFirstWidgetConversation(page, workspaceId);

    await setInboxConversationStatus(seeded.conversationId, "closed");
    await expect(widget.getByTestId("widget-csat-prompt")).toBeVisible({ timeout: 10000 });

    await widget.getByTestId("widget-csat-rating-5").click();
    await widget
      .getByTestId("widget-csat-feedback-input")
      .fill("Great support and quick response.");
    await widget.getByTestId("widget-csat-submit").click();

    await expect(widget.getByTestId("widget-csat-prompt")).toHaveCount(0, { timeout: 15000 });

    await page.reload();

    const reopenedWidget = await openFirstWidgetConversation(page, workspaceId);
    await expect(reopenedWidget.getByTestId("widget-csat-prompt")).toHaveCount(0, {
      timeout: 10000,
    });
    await expect(reopenedWidget.getByTestId("widget-conversation-status")).toContainText(
      /already been recorded/i
    );

    await gotoWithAuthRecovery(page, "/inbox");
    await expect(page).toHaveURL(/\/inbox/, { timeout: 10000 });

    await gotoProtectedRoute(page, "/reports", page.getByTestId("reports-csat-score-card"));
    await expect(page).toHaveURL(/\/reports$/, { timeout: 10000 });

    await gotoProtectedRoute(page, "/reports/csat", page.getByTestId("csat-report-heading"));
    await expect(page).toHaveURL(/\/reports\/csat$/, { timeout: 10000 });
    await expect(page.getByTestId("csat-report-heading")).toBeVisible({ timeout: 10000 });

    await expect
      .poll(
        async () => {
          const totalResponsesText =
            (await page.getByTestId("csat-report-total-value").textContent()) ?? "0";
          const parsed = Number.parseInt(totalResponsesText.trim(), 10);
          return Number.isNaN(parsed) ? -1 : parsed;
        },
        { timeout: 30000 }
      )
      .toBeGreaterThan(0);
  });

  test("disabled Ask for Rating suppresses prompt", async ({ page }) => {
    await upsertAutomationSettings(workspaceId, {
      askForRatingEnabled: false,
      collectEmailEnabled: false,
      showReplyTimeEnabled: false,
      suggestArticlesEnabled: false,
    });

    const seeded = await createInboxConversationFixture(workspaceId, {
      visitorEmail: WIDGET_TEST_EMAIL,
      visitorName: "E2E CSAT Disabled",
      status: "closed",
      initialMessages: [{ content: "Closed with CSAT disabled", senderType: "visitor" }],
    });

    await setInboxConversationStatus(seeded.conversationId, "closed");

    const widget = await openFirstWidgetConversation(page, workspaceId);
    await expect(widget.getByTestId("widget-conversation-status")).toBeVisible({ timeout: 10000 });
    await expect(widget.getByTestId("widget-conversation-status")).toContainText(/disabled/i);
    await expect(widget.getByTestId("widget-csat-prompt")).toHaveCount(0);
  });
});
