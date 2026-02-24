import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import type { Id } from "@opencom/convex/dataModel";
import {
  cleanupTestData,
  createInboxConversationFixture,
  setInboxSuggestionsEnabled,
} from "./helpers/test-data";
import {
  ensureAuthenticatedInPage,
  gotoWithAuthRecovery,
  refreshAuthState,
} from "./helpers/auth-refresh";
import { getTestState } from "./helpers/test-state";

type ViewportCase = {
  name: string;
  width: number;
  height: number;
};

const VIEWPORT_CASES: ViewportCase[] = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 },
];
const AUTH_ROUTE_RE = /\/(login|signup)(\/|$|\?)/;

function requireWorkspaceId(): Id<"workspaces"> {
  const state = getTestState();
  if (!state?.workspaceId) {
    throw new Error("Missing workspaceId in apps/web/e2e/.e2e-state.json");
  }
  return state.workspaceId as Id<"workspaces">;
}

function conversationRow(page: Page, visitorName: string) {
  return page
    .locator("[data-testid^='conversation-item-']")
    .filter({ hasText: visitorName })
    .first();
}

function isAuthRoute(page: Page): boolean {
  try {
    return AUTH_ROUTE_RE.test(new URL(page.url()).pathname);
  } catch {
    return AUTH_ROUTE_RE.test(page.url());
  }
}

async function openInbox(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await gotoWithAuthRecovery(page, "/inbox");

    if (isAuthRoute(page)) {
      const authRecovered = await ensureAuthenticatedInPage(page);
      if (!authRecovered) {
        await page.waitForTimeout(500);
      }
      continue;
    }

    const listVisible = await page
      .getByTestId("inbox-conversation-list")
      .isVisible({ timeout: 8000 })
      .catch(() => false);
    if (listVisible) return;

    const emptyVisible = await page
      .getByTestId("inbox-empty-state")
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (emptyVisible) return;

    const loadingVisible = await page
      .getByTestId("inbox-conversations-loading")
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    if (loadingVisible) {
      await page.waitForTimeout(1000);
      continue;
    }

    const headingVisible = await page
      .getByRole("heading", { name: "Conversations" })
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (headingVisible) {
      return;
    }

    await page.waitForTimeout(750);
  }

  throw new Error("Inbox did not render expected conversation list or empty state");
}

async function openConversationThread(page: Page, visitorName: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const row = conversationRow(page, visitorName);
    const rowVisible = await row.isVisible().catch(() => false);
    if (!rowVisible) {
      await page.waitForTimeout(500);
      continue;
    }

    try {
      await row.click({ timeout: 10000 });
    } catch {
      await page.waitForTimeout(250);
      continue;
    }

    const inputVisible = await page
      .getByTestId("inbox-reply-input")
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (inputVisible) {
      return;
    }
  }

  throw new Error(`Could not open conversation thread for ${visitorName}`);
}

test.describe("Inbox chat responsiveness", () => {
  let workspaceId: Id<"workspaces">;

  test.beforeAll(() => {
    workspaceId = requireWorkspaceId();
  });

  test.beforeEach(async ({ page }) => {
    await refreshAuthState();
    const authOk = await ensureAuthenticatedInPage(page);
    if (!authOk) {
      throw new Error("Failed to authenticate chat E2E context");
    }

    await page.addInitScript((workspaceIdValue: string) => {
      window.localStorage.setItem(
        "opencom_active_workspace",
        JSON.stringify({ _id: workspaceIdValue })
      );
    }, workspaceId);

    await cleanupTestData(workspaceId);
    await setInboxSuggestionsEnabled(workspaceId, false);
  });

  for (const viewport of VIEWPORT_CASES) {
    test(`chat controls remain usable on ${viewport.name} viewport`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      const visitorName = `e2e_test_chat_${viewport.name}_${Date.now()}`;
      const replyText = `Viewport ${viewport.name} reply ${Date.now()}`;

      await createInboxConversationFixture(workspaceId, {
        visitorName,
        visitorEmail: `${visitorName}@test.opencom.dev`,
        initialMessages: [{ content: "Need responsive chat check", senderType: "visitor" }],
      });

      await openInbox(page);
      await openConversationThread(page, visitorName);

      await expect(page.getByTestId("inbox-message-list")).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId("inbox-reply-input")).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId("inbox-send-button")).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId("inbox-resolve-button")).toBeVisible({ timeout: 10000 });

      await page.getByTestId("inbox-reply-input").fill(replyText);
      await page.getByTestId("inbox-reply-input").press("Enter");

      await expect(page.getByTestId("inbox-message-list")).toContainText(replyText, {
        timeout: 10000,
      });
      await expect(page.getByTestId("inbox-reply-input")).toHaveValue("");
    });
  }

  test("resolve transition keeps status and composer visibility stable", async ({ page }) => {
    const visitorName = `e2e_test_chat_resolve_${Date.now()}`;

    await createInboxConversationFixture(workspaceId, {
      visitorName,
      visitorEmail: `${visitorName}@test.opencom.dev`,
      initialMessages: [{ content: "Please resolve this conversation", senderType: "visitor" }],
    });

    await openInbox(page);
    await openConversationThread(page, visitorName);

    const resolveButton = page.getByTestId("inbox-resolve-button");
    await expect(resolveButton).toBeVisible();
    await resolveButton.click();

    await expect(conversationRow(page, visitorName)).toContainText(/closed/i, { timeout: 10000 });
    await expect(resolveButton).toBeDisabled({ timeout: 10000 });

    await expect(page.getByTestId("inbox-reply-input")).toBeVisible();
    await expect(page.getByTestId("inbox-send-button")).toBeVisible();
  });
});
