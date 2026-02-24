import { test, expect } from "./fixtures";
import type { Id } from "@opencom/convex/dataModel";
import {
  cleanupTestData,
  createInboxConversationFixture,
  seedInboxAIResponse,
  setInboxSuggestionsEnabled,
} from "./helpers/test-data";
import {
  ensureAuthenticatedInPage,
  gotoWithAuthRecovery,
  refreshAuthState,
} from "./helpers/auth-refresh";
import { getTestState } from "./helpers/test-state";

const AUTH_ROUTE_RE = /\/(login|signup)(\/|$|\?)/;

function requireWorkspaceId(): Id<"workspaces"> {
  const state = getTestState();
  if (!state?.workspaceId) {
    throw new Error("Missing workspaceId in apps/web/e2e/.e2e-state.json");
  }
  return state.workspaceId as Id<"workspaces">;
}

function isAuthRoute(page: import("@playwright/test").Page): boolean {
  try {
    return AUTH_ROUTE_RE.test(new URL(page.url()).pathname);
  } catch {
    return AUTH_ROUTE_RE.test(page.url());
  }
}

async function openInbox(page: import("@playwright/test").Page): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await gotoWithAuthRecovery(page, "/inbox");

    if (isAuthRoute(page)) {
      const recovered = await ensureAuthenticatedInPage(page);
      if (!recovered) {
        await page.waitForTimeout(500);
      }
      continue;
    }

    const headingVisible = await page
      .getByRole("heading", { name: "Conversations" })
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    if (headingVisible) {
      return;
    }

    const listVisible = await page
      .getByTestId("inbox-conversation-list")
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (listVisible) {
      return;
    }

    await page.waitForTimeout(700);
  }

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
    if (!(await row.isVisible().catch(() => false))) {
      await page.waitForTimeout(400);
      continue;
    }
    await row.click();
    const inputVisible = await page
      .getByTestId("inbox-reply-input")
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (inputVisible) {
      return;
    }
  }
  throw new Error(`Could not open conversation for ${visitorName}`);
}

async function setAIFilter(
  page: import("@playwright/test").Page,
  value: "all" | "ai_handled" | "handoff"
): Promise<void> {
  await page.getByTestId("inbox-ai-filter").selectOption(value);
}

test.describe("Inbox AI deterministic workflow", () => {
  let workspaceId: Id<"workspaces">;

  test.beforeAll(() => {
    workspaceId = requireWorkspaceId();
  });

  test.beforeEach(async ({ page }) => {
    await refreshAuthState();
    const authOk = await ensureAuthenticatedInPage(page);
    if (!authOk) {
      throw new Error("Failed to authenticate AI inbox E2E context");
    }
    await cleanupTestData(workspaceId);
    await setInboxSuggestionsEnabled(workspaceId, false);
  });

  test("shows AI-handled review metadata and deep-links to the source message", async ({
    page,
  }) => {
    const visitorName = "e2e_test_ai_handled";
    const fixture = await createInboxConversationFixture(workspaceId, {
      visitorName,
      visitorEmail: `${visitorName}@test.opencom.dev`,
      initialMessages: [{ content: "How can I reset my password?", senderType: "visitor" }],
    });
    const seeded = await seedInboxAIResponse(fixture.conversationId, {
      visitorId: fixture.visitorId,
      visitorSessionToken: fixture.visitorSessionToken,
      query: "How can I reset my password?",
      response: "Open Settings, then choose Security and use the password reset option.",
      confidence: 0.87,
      feedback: "helpful",
      handedOff: false,
      sources: [{ type: "article", id: "article_reset_password", title: "Reset Password Guide" }],
    });

    await openInbox(page);
    await setAIFilter(page, "ai_handled");

    const row = conversationRow(page, visitorName);
    await expect(row).toBeVisible({ timeout: 10000 });
    await expect(row).toContainText("AI handled");

    await openConversationThread(page, visitorName);
    const openReviewButton = page.getByTestId("inbox-open-ai-review");
    await expect(openReviewButton).toBeVisible({ timeout: 10000 });
    await openReviewButton.click();

    const reviewPanel = page.getByTestId("inbox-ai-review-panel");
    await expect(reviewPanel).toBeVisible({ timeout: 10000 });
    await expect(reviewPanel).toContainText("Open Settings, then choose Security");
    await expect(reviewPanel).toContainText("Confidence 87%");
    await expect(reviewPanel).toContainText("Feedback helpful");
    await expect(reviewPanel).toContainText("Reset Password Guide");

    const jumpButton = page.getByTestId(`inbox-ai-review-jump-${seeded.responseId}`);
    await jumpButton.click();

    const sourceMessage = page.getByTestId(`message-item-${seeded.messageId}`);
    await expect(sourceMessage).toBeVisible({ timeout: 10000 });
    await expect(sourceMessage).toHaveAttribute("data-highlighted", "true", { timeout: 10000 });
  });

  test("filters handoff conversations and shows handoff reason consistency", async ({ page }) => {
    const handoffVisitor = "e2e_test_ai_handoff";
    const aiHandledVisitor = "e2e_test_ai_non_handoff";
    const handoffReason = "Low confidence response";

    const handoffFixture = await createInboxConversationFixture(workspaceId, {
      visitorName: handoffVisitor,
      visitorEmail: `${handoffVisitor}@test.opencom.dev`,
      initialMessages: [{ content: "Can you help with billing?", senderType: "visitor" }],
    });
    await seedInboxAIResponse(handoffFixture.conversationId, {
      visitorId: handoffFixture.visitorId,
      visitorSessionToken: handoffFixture.visitorSessionToken,
      query: "Can you help with billing?",
      response: "I should connect you with a human specialist for billing support.",
      confidence: 0.22,
      handedOff: true,
      handoffReason,
      feedback: "not_helpful",
      sources: [{ type: "article", id: "article_billing", title: "Billing FAQ" }],
    });

    const handledFixture = await createInboxConversationFixture(workspaceId, {
      visitorName: aiHandledVisitor,
      visitorEmail: `${aiHandledVisitor}@test.opencom.dev`,
      initialMessages: [{ content: "What are your support hours?", senderType: "visitor" }],
    });
    await seedInboxAIResponse(handledFixture.conversationId, {
      visitorId: handledFixture.visitorId,
      visitorSessionToken: handledFixture.visitorSessionToken,
      query: "What are your support hours?",
      response: "Support is available from 9am to 6pm on weekdays.",
      confidence: 0.9,
      handedOff: false,
    });

    await openInbox(page);
    await setAIFilter(page, "handoff");

    const handoffRow = conversationRow(page, handoffVisitor);
    await expect(handoffRow).toBeVisible({ timeout: 10000 });
    await expect(handoffRow).toContainText("AI handoff");
    await expect(handoffRow).toContainText(handoffReason);

    await expect(conversationRow(page, aiHandledVisitor)).toHaveCount(0);

    await openConversationThread(page, handoffVisitor);
    const openReviewButton = page.getByTestId("inbox-open-ai-review");
    await expect(openReviewButton).toBeVisible({ timeout: 10000 });
    await openReviewButton.click();

    const reviewPanel = page.getByTestId("inbox-ai-review-panel");
    await expect(reviewPanel).toContainText("AI handoff");
    await expect(reviewPanel).toContainText(`Handoff reason: ${handoffReason}`);
    await expect(reviewPanel).toContainText("Feedback not helpful");
  });
});
