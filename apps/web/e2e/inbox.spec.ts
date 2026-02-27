import { test, expect } from "./fixtures";
import type { Id } from "@opencom/convex/dataModel";
import {
  cleanupTestData,
  createInboxConversationFixture,
  createInboxConversationWithoutVisitorFixture,
  setInboxConversationStatus,
  setInboxSuggestionsEnabled,
} from "./helpers/test-data";
import {
  ensureAuthenticatedInPage,
  gotoWithAuthRecovery,
  refreshAuthState,
} from "./helpers/auth-refresh";
import { getTestState } from "./helpers/test-state";
import { formatHumanVisitorId } from "../src/lib/visitorIdentity";

function requireWorkspaceId(): Id<"workspaces"> {
  const state = getTestState();
  if (!state?.workspaceId) {
    throw new Error("Missing workspaceId in apps/web/e2e/.e2e-state.json");
  }
  return state.workspaceId as Id<"workspaces">;
}

async function openInbox(page: import("@playwright/test").Page): Promise<void> {
  await gotoWithAuthRecovery(page, "/inbox");
  await expect(page.getByRole("heading", { name: "Conversations" })).toBeVisible({
    timeout: 10000,
  });
}

function conversationRow(page: import("@playwright/test").Page, visitorName: string) {
  return page
    .locator("[data-testid^='conversation-item-']")
    .filter({ hasText: visitorName })
    .first();
}

async function openConversationThread(
  page: import("@playwright/test").Page,
  visitorName: string
): Promise<void> {
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

async function openFirstConversationThread(page: import("@playwright/test").Page): Promise<void> {
  const firstRow = page.locator("[data-testid^='conversation-item-']").first();
  await expect(firstRow).toBeVisible({ timeout: 10000 });
  await firstRow.click();
  await expect(page.getByTestId("inbox-reply-input")).toBeVisible({ timeout: 10000 });
}

async function sendReply(page: import("@playwright/test").Page, replyText: string): Promise<void> {
  const input = page.getByTestId("inbox-reply-input");
  await expect(input).toBeVisible({ timeout: 10000 });
  await input.fill(replyText);
  await input.press("Enter");
}

test.describe("Inbox deterministic flow", () => {
  let workspaceId: Id<"workspaces">;

  test.beforeAll(() => {
    workspaceId = requireWorkspaceId();
  });

  test.beforeEach(async ({ page }) => {
    await refreshAuthState();
    const authOk = await ensureAuthenticatedInPage(page);
    if (!authOk) {
      throw new Error("Failed to authenticate inbox E2E test context");
    }
    await cleanupTestData(workspaceId);
    await setInboxSuggestionsEnabled(workspaceId, false);
  });

  test("shows empty state when workspace has no seeded conversations", async ({ page }) => {
    await openInbox(page);
    await expect(page.getByTestId("inbox-empty-state")).toBeVisible();
    await expect(page.getByText(/no conversations yet/i)).toBeVisible();
  });

  test("open -> reply persists after refresh", async ({ page }) => {
    const visitorName = "e2e_test_inbox_reply";
    const replyText = `E2E reply ${Date.now()}`;

    await createInboxConversationFixture(workspaceId, {
      visitorName,
      visitorEmail: `${visitorName}@test.opencom.dev`,
      initialMessages: [{ content: "Initial visitor message", senderType: "visitor" }],
    });

    await openInbox(page);

    await openConversationThread(page, visitorName);

    await sendReply(page, replyText);

    await expect(page.getByTestId("inbox-message-list")).toContainText(replyText, {
      timeout: 10000,
    });

    await page.reload();
    await expect(page.getByRole("heading", { name: "Conversations" })).toBeVisible({
      timeout: 10000,
    });

    await openConversationThread(page, visitorName);

    await expect(page.getByTestId("inbox-message-list")).toContainText(replyText, {
      timeout: 10000,
    });
  });

  test("switching between conversations does not oscillate selection", async ({ page }) => {
    const firstVisitorName = "e2e_test_switch_first";
    const secondVisitorName = "e2e_test_switch_second";
    const firstMessage = "Switch target first conversation";
    const secondMessage = "Switch target second conversation";

    const firstSeeded = await createInboxConversationFixture(workspaceId, {
      visitorName: firstVisitorName,
      visitorEmail: `${firstVisitorName}@test.opencom.dev`,
      initialMessages: [{ content: firstMessage, senderType: "visitor" }],
    });
    const secondSeeded = await createInboxConversationFixture(workspaceId, {
      visitorName: secondVisitorName,
      visitorEmail: `${secondVisitorName}@test.opencom.dev`,
      initialMessages: [{ content: secondMessage, senderType: "visitor" }],
    });

    await openInbox(page);

    await page.getByTestId(`conversation-item-${firstSeeded.conversationId}`).click();
    await expect(page.getByTestId("inbox-reply-input")).toBeVisible({ timeout: 10000 });
    await expect
      .poll(() => new URL(page.url()).searchParams.get("conversationId"))
      .toBe(String(firstSeeded.conversationId));

    await page.getByTestId(`conversation-item-${secondSeeded.conversationId}`).click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("conversationId"))
      .toBe(String(secondSeeded.conversationId));
    await expect(page.getByTestId("inbox-message-list")).toContainText(secondMessage, {
      timeout: 10000,
    });

    await page.waitForTimeout(1200);
    await expect
      .poll(() => new URL(page.url()).searchParams.get("conversationId"))
      .toBe(String(secondSeeded.conversationId));
  });

  test("reply moves conversation to top ordering", async ({ page }) => {
    const olderVisitor = "e2e_test_order_old";
    const newerVisitor = "e2e_test_order_new";
    const replyText = `Ordering reply ${Date.now()}`;

    await createInboxConversationFixture(workspaceId, {
      visitorName: olderVisitor,
      visitorEmail: `${olderVisitor}@test.opencom.dev`,
      initialMessages: [{ content: "Older conversation", senderType: "visitor" }],
    });

    await new Promise((resolve) => setTimeout(resolve, 30));

    await createInboxConversationFixture(workspaceId, {
      visitorName: newerVisitor,
      visitorEmail: `${newerVisitor}@test.opencom.dev`,
      initialMessages: [{ content: "Newer conversation", senderType: "visitor" }],
    });

    await openInbox(page);

    const firstRowBeforeReply = page.locator("[data-testid^='conversation-item-']").first();
    await expect(firstRowBeforeReply).toContainText(newerVisitor);

    await openConversationThread(page, olderVisitor);
    await sendReply(page, replyText);

    await expect(page.getByTestId("inbox-message-list")).toContainText(replyText, {
      timeout: 10000,
    });

    const firstRowAfterReply = page.locator("[data-testid^='conversation-item-']").first();
    await expect(firstRowAfterReply).toContainText(olderVisitor, { timeout: 10000 });
    await expect(firstRowAfterReply).toContainText(replyText);
  });

  test("resolve action updates conversation status", async ({ page }) => {
    const visitorName = "e2e_test_resolve";

    await createInboxConversationFixture(workspaceId, {
      visitorName,
      visitorEmail: `${visitorName}@test.opencom.dev`,
      initialMessages: [{ content: "Please resolve me", senderType: "visitor" }],
    });

    await openInbox(page);

    const row = conversationRow(page, visitorName);
    await openConversationThread(page, visitorName);

    await page.getByTestId("inbox-resolve-button").click();

    await expect(row).toContainText(/closed/i, { timeout: 10000 });

    await page.reload();
    await expect(page.getByRole("heading", { name: "Conversations" })).toBeVisible({
      timeout: 10000,
    });
    await expect(conversationRow(page, visitorName)).toContainText(/closed/i, { timeout: 10000 });
  });

  test("ticket conversion navigates to ticket detail", async ({ page }) => {
    const visitorName = "e2e_test_ticket_convert";

    await createInboxConversationFixture(workspaceId, {
      visitorName,
      visitorEmail: `${visitorName}@test.opencom.dev`,
      initialMessages: [{ content: "Need ticket", senderType: "visitor" }],
    });

    await openInbox(page);

    await openFirstConversationThread(page);

    const convertButton = page.getByTestId("inbox-convert-ticket-button");
    await expect(convertButton).toBeVisible({ timeout: 10000 });
    await convertButton.click();

    await expect(page).toHaveURL(/\/tickets\/.+/, { timeout: 10000 });
  });

  test("uses visitor id fallback label and restores selected thread when returning from visitor profile", async ({
    page,
  }) => {
    const seeded = await createInboxConversationFixture(workspaceId, {
      visitorName: "",
      visitorEmail: "",
      initialMessages: [{ content: "Anonymous visitor message", senderType: "visitor" }],
    });

    await openInbox(page);

    const expectedFallback = formatHumanVisitorId(String(seeded.visitorId));
    await expect(page.getByTestId(`conversation-label-${seeded.conversationId}`)).toHaveText(
      expectedFallback,
      {
        timeout: 10000,
      }
    );

    await page.getByTestId(`conversation-item-${seeded.conversationId}`).click();
    await expect(page.getByTestId("inbox-reply-input")).toBeVisible({ timeout: 10000 });
    await expect
      .poll(() => new URL(page.url()).searchParams.get("conversationId"))
      .toBe(String(seeded.conversationId));

    await expect(page.getByTestId("inbox-open-visitor-profile")).toBeVisible({ timeout: 10000 });
    await page.getByTestId("inbox-open-visitor-profile").click();
    await expect(page).toHaveURL(new RegExp(`/visitors/${seeded.visitorId}$`), { timeout: 10000 });
    await expect(page.getByTestId("visitor-detail-heading")).toBeVisible({ timeout: 10000 });

    await page.goBack();
    await expect(page).toHaveURL(/\/inbox(?:\?|$)/, { timeout: 10000 });
    await expect
      .poll(() => new URL(page.url()).searchParams.get("conversationId"))
      .toBe(String(seeded.conversationId));
    await expect(page.getByTestId("inbox-reply-input")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("inbox-message-list")).toContainText("Anonymous visitor message", {
      timeout: 10000,
    });
  });

  test("hides visitor profile action for conversations without visitor id", async ({ page }) => {
    const seeded = await createInboxConversationWithoutVisitorFixture(workspaceId, {
      initialMessages: [{ content: "System-created thread", senderType: "bot" }],
    });

    await openInbox(page);
    await page.getByTestId(`conversation-item-${seeded.conversationId}`).click();
    await expect(page.getByTestId("inbox-reply-input")).toBeVisible({ timeout: 10000 });

    await expect(page.getByTestId("inbox-open-visitor-profile")).toHaveCount(0);
  });

  test("renders unread badge only for positive counts and clears after opening thread", async ({
    page,
  }) => {
    const visitorName = "e2e_test_unread_badge";
    const seeded = await createInboxConversationFixture(workspaceId, {
      visitorName,
      visitorEmail: `${visitorName}@test.opencom.dev`,
      initialMessages: [{ content: "Unread message", senderType: "visitor" }],
    });

    const noUnreadSeed = await createInboxConversationFixture(workspaceId, {
      visitorName: "e2e_test_unread_zero",
      visitorEmail: "e2e_test_unread_zero@test.opencom.dev",
      initialMessages: [{ content: "Agent message", senderType: "agent" }],
    });

    await openInbox(page);

    const unreadBadge = page.getByTestId(`conversation-unread-badge-${seeded.conversationId}`);
    await expect(unreadBadge).toHaveText("1", { timeout: 10000 });
    await expect(
      page.getByTestId(`conversation-unread-badge-${noUnreadSeed.conversationId}`)
    ).toHaveCount(0);

    await page.getByTestId(`conversation-item-${seeded.conversationId}`).click();
    await expect(page.getByTestId("inbox-reply-input")).toBeVisible({ timeout: 10000 });
    await expect(unreadBadge).toHaveCount(0);
  });

  test("sidecar disabled fallback keeps reply workflow functional", async ({ page }) => {
    const visitorName = "e2e_test_sidecar_off";
    const replyText = `Sidecar off reply ${Date.now()}`;

    await setInboxSuggestionsEnabled(workspaceId, false);
    await createInboxConversationFixture(workspaceId, {
      visitorName,
      visitorEmail: `${visitorName}@test.opencom.dev`,
      initialMessages: [{ content: "Sidecar should be off", senderType: "visitor" }],
    });

    await openInbox(page);

    await openFirstConversationThread(page);

    await expect(page.getByTestId("inbox-sidecar-container")).toHaveCount(0);

    await sendReply(page, replyText);
    await expect(page.getByTestId("inbox-reply-input")).toHaveValue("", { timeout: 15000 });
    await expect(page.getByTestId("inbox-workflow-error")).toHaveCount(0);
  });

  test("sidecar enabled renders panel and does not block reply", async ({ page }) => {
    const visitorName = "e2e_test_sidecar_on";
    const replyText = `Sidecar on reply ${Date.now()}`;

    await setInboxSuggestionsEnabled(workspaceId, true);
    await createInboxConversationFixture(workspaceId, {
      visitorName,
      visitorEmail: `${visitorName}@test.opencom.dev`,
      initialMessages: [],
    });

    await openInbox(page);

    await openFirstConversationThread(page);

    await expect(page.getByTestId("inbox-sidecar-container")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("inbox-suggestions-sidecar")).toBeVisible({ timeout: 10000 });

    await sendReply(page, replyText);
    await expect(page.getByTestId("inbox-reply-input")).toHaveValue("", { timeout: 15000 });
    await expect(page.getByTestId("inbox-workflow-error")).toHaveCount(0);
    await expect(page.getByTestId("inbox-sidecar-container")).toBeVisible();
  });

  test("compact viewport prioritizes thread and uses on-demand AI panels", async ({ page }) => {
    const visitorName = "e2e_test_compact_panels";
    const replyText = `Compact viewport reply ${Date.now()}`;

    await page.setViewportSize({ width: 390, height: 844 });
    await setInboxSuggestionsEnabled(workspaceId, true);
    await createInboxConversationFixture(workspaceId, {
      visitorName,
      visitorEmail: `${visitorName}@test.opencom.dev`,
      initialMessages: [{ content: "Compact viewport panel test", senderType: "visitor" }],
    });

    await openInbox(page);
    await openConversationThread(page, visitorName);

    await expect(page.getByTestId("inbox-thread-pane")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("inbox-conversation-pane")).toHaveCount(0);
    await expect(page.getByTestId("inbox-reply-input")).toBeVisible();
    await expect(page.getByTestId("inbox-send-button")).toBeVisible();
    await expect(page.getByTestId("inbox-resolve-button")).toBeVisible();

    await page.getByTestId("inbox-open-ai-review").click();
    await expect(page.getByTestId("inbox-ai-review-panel")).toBeVisible({ timeout: 10000 });
    await page.getByTestId("inbox-ai-review-panel-close").click();
    await expect(page.getByTestId("inbox-ai-review-panel")).toHaveCount(0);
    await expect(page.getByTestId("inbox-reply-input")).toBeFocused();

    await page.getByTestId("inbox-open-suggestions").click();
    await expect(page.getByTestId("inbox-sidecar-container")).toBeVisible({ timeout: 10000 });
    await page.getByTestId("inbox-sidecar-container-close").click();
    await expect(page.getByTestId("inbox-sidecar-container")).toHaveCount(0);
    await expect(page.getByTestId("inbox-reply-input")).toBeFocused();

    await sendReply(page, replyText);
    await expect(page.getByTestId("inbox-reply-input")).toHaveValue("", { timeout: 15000 });
    await expect(page.getByTestId("inbox-workflow-error")).toHaveCount(0);
  });

  test("desktop viewport keeps all thread header actions visible", async ({ page }) => {
    const visitorName = "e2e_test_desktop_rails";

    await page.setViewportSize({ width: 1180, height: 900 });
    await setInboxSuggestionsEnabled(workspaceId, true);
    await createInboxConversationFixture(workspaceId, {
      visitorName,
      visitorEmail: `${visitorName}@test.opencom.dev`,
      initialMessages: [{ content: "Desktop viewport panel test", senderType: "visitor" }],
    });

    await openInbox(page);
    await openConversationThread(page, visitorName);

    await expect(page.getByTestId("inbox-conversation-pane")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("inbox-ai-review-panel")).toHaveCount(0);
    await expect(page.getByTestId("inbox-resolve-button")).toBeVisible();
    await expect(page.getByTestId("inbox-convert-ticket-button")).toBeVisible();
    await expect(page.getByTestId("inbox-open-visitor-profile")).toBeVisible();
    await expect(page.getByTestId("inbox-open-ai-review")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("inbox-open-suggestions")).toBeVisible({ timeout: 10000 });

    await page.getByTestId("inbox-open-suggestions").click();
    await expect(page.getByTestId("inbox-sidecar-container")).toBeVisible({ timeout: 10000 });
    await page.getByTestId("inbox-sidecar-container-close").click();
    await expect(page.getByTestId("inbox-sidecar-container")).toHaveCount(0);

    await page.getByTestId("inbox-open-ai-review").click();
    await expect(page.getByTestId("inbox-ai-review-panel")).toBeVisible({ timeout: 10000 });
    await page.getByTestId("inbox-ai-review-panel-close").click();
    await expect(page.getByTestId("inbox-ai-review-panel")).toHaveCount(0);
    await expect(page.getByTestId("inbox-reply-input")).toBeVisible();
    await expect(page.getByTestId("inbox-send-button")).toBeVisible();
    await expect(page.getByTestId("inbox-resolve-button")).toBeVisible();
  });

  test("read status remains synchronized after manual resolve setup", async ({ page }) => {
    const visitorName = "e2e_test_resolved_seed";

    const seeded = await createInboxConversationFixture(workspaceId, {
      visitorName,
      visitorEmail: `${visitorName}@test.opencom.dev`,
      initialMessages: [{ content: "Already resolved", senderType: "visitor" }],
    });
    await setInboxConversationStatus(seeded.conversationId, "closed");

    await openInbox(page);

    const row = conversationRow(page, visitorName);
    await expect(row).toContainText(/closed/i, { timeout: 10000 });
    await openConversationThread(page, visitorName);

    await expect(page.getByTestId("inbox-resolve-button")).toBeDisabled();
    await expect(page.getByTestId("inbox-workflow-error")).toHaveCount(0);
  });
});
