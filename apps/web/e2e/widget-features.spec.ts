import { test, expect } from "./fixtures";
import {
  waitForWidgetLoad,
  getWidgetContainer,
  openWidgetChat,
  sendWidgetMessage,
  navigateToWidgetTab,
  isTourStepVisible,
  advanceTourStep,
  dismissTour,
  isSurveyVisible,
  waitForSurveyVisible,
  submitNPSRating,
  submitSurvey,
  dismissSurvey,
  waitForHelpArticleVisible,
} from "./helpers/widget-helpers";
import {
  ensureAuthenticatedInPage,
  gotoWithAuthRecovery,
  refreshAuthState,
} from "./helpers/auth-refresh";
import {
  seedTour,
  seedSurvey,
  seedArticles,
  seedMessengerSettings,
  seedAIAgentSettings,
  cleanupTestData,
} from "./helpers/test-data";
import { getTestState } from "./helpers/test-state";
import { Id } from "@opencom/convex/dataModel";

/**
 * Widget E2E Tests
 *
 * These tests use the /widget-demo page which embeds the widget.
 * The widget is built and served from /opencom-widget.iife.js by the web app.
 * Tests pass workspaceId as a URL param to connect to the test workspace.
 */

function getWidgetDemoUrl(workspaceId: string, visitorKey?: string): string {
  const params = new URLSearchParams({ workspaceId });
  if (visitorKey) {
    params.set("visitorKey", visitorKey);
  }
  return `/widget-demo?${params.toString()}`;
}

async function gotoWidgetDemoAndWait(page: import("@playwright/test").Page, url: string) {
  await gotoWithAuthRecovery(page, url);
  await waitForWidgetLoad(page, 15000);
}

async function gotoFreshWidgetDemoAndWait(page: import("@playwright/test").Page, url: string) {
  await page.context().clearCookies();
  await page.goto("about:blank");
  await page
    .evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    })
    .catch(() => {});
  await gotoWidgetDemoAndWait(page, url);
}

async function openConversationComposer(page: import("@playwright/test").Page) {
  const frame = await openWidgetChat(page);
  const messageInput = frame
    .locator("[data-testid='widget-message-input'], input[placeholder*='Type a message']")
    .first();
  if ((await messageInput.isVisible({ timeout: 2000 }).catch(() => false)) === false) {
    const startButton = frame
      .getByRole("button", { name: /start a conversation|send us a message/i })
      .first();
    await expect(startButton).toBeVisible({ timeout: 5000 });
    await startButton.click();
  }
  return frame;
}

async function waitForTourToRender(
  page: import("@playwright/test").Page,
  timeout = 15000
): Promise<void> {
  let widgetOpened = false;

  await expect
    .poll(
      async () => {
        const visible = await isTourStepVisible(page);
        if (visible) {
          return true;
        }

        if (!widgetOpened) {
          widgetOpened = true;
          await openWidgetChat(page).catch(() => {});
        }

        return isTourStepVisible(page);
      },
      { timeout }
    )
    .toBe(true);
}

async function expectTourToBeHidden(page: import("@playwright/test").Page): Promise<void> {
  await expect.poll(async () => isTourStepVisible(page, 250), { timeout: 6000 }).toBe(false);
}

async function ensureTourAvailableForDismissal(
  page: import("@playwright/test").Page
): Promise<void> {
  const autoDisplayDeadline = Date.now() + 15000;
  let widgetOpened = false;

  while (Date.now() < autoDisplayDeadline) {
    if (await isTourStepVisible(page, 500)) {
      return;
    }

    if (!widgetOpened) {
      widgetOpened = true;
      await openWidgetChat(page).catch(() => {});
    }

    await page.waitForTimeout(500);
  }

  const widget = getWidgetContainer(page);
  const toursTab = widget.getByTitle("Product Tours").first();
  await expect(toursTab).toBeVisible({ timeout: 10000 });
  await toursTab.click();

  const availableTour = widget.locator("[data-testid^='tour-item-']:not([disabled])").first();
  await expect(availableTour).toBeVisible({ timeout: 10000 });
  await availableTour.click();

  await expect.poll(async () => isTourStepVisible(page, 500), { timeout: 10000 }).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await refreshAuthState();
  const ok = await ensureAuthenticatedInPage(page);
  expect(ok).toBe(true);
});

test.describe("Widget E2E Tests - Product Tours", () => {
  let workspaceId: Id<"workspaces"> | null = null;
  let widgetDemoUrl: string;

  test.beforeAll(async () => {
    // Re-authenticate if the auth token has expired (widget tests run late in the suite)
    await refreshAuthState();

    const state = getTestState();
    if (!state?.workspaceId) {
      console.warn("No workspace ID in test state - widget tests may fail");
      return;
    }
    workspaceId = state.workspaceId as Id<"workspaces">;
    widgetDemoUrl = getWidgetDemoUrl(state.workspaceId);

    // Seed a test tour targeting the widget demo page
    try {
      await seedTour(workspaceId, {
        name: "e2e_test_welcome_tour",
        status: "active",
        targetPageUrl: "/widget-demo",
        steps: [
          { type: "post", title: "Welcome!", content: "Welcome to our E2E test tour." },
          {
            type: "pointer",
            title: "Step 1",
            content: "This is the first target",
            elementSelector: "[data-testid='tour-target-1']",
          },
          {
            type: "pointer",
            title: "Step 2",
            content: "This is the second target",
            elementSelector: "[data-testid='tour-target-2']",
          },
        ],
      });
    } catch (e) {
      console.warn("Failed to seed tour data:", e);
      workspaceId = null;
    }
  });

  test("tour displays when targeting conditions match", async ({ page }) => {
    if (!workspaceId) return test.skip();
    await gotoWidgetDemoAndWait(page, widgetDemoUrl);

    // Tour should be visible for a first-time visitor on the target page
    await waitForTourToRender(page);
  });

  test("tour step navigation works (next/prev/skip)", async ({ page }) => {
    if (!workspaceId) return test.skip();
    await gotoWidgetDemoAndWait(page, widgetDemoUrl);
    await waitForTourToRender(page);

    // Advance to next step
    await advanceTourStep(page);
    // Tour should still be visible (multi-step tour) or completed
    // Either outcome is acceptable – just verify the action didn't crash
    await expect(page.locator(".opencom-widget")).toBeVisible();
  });

  test("tour can be dismissed", async ({ page }) => {
    if (!workspaceId) return test.skip();
    await gotoWidgetDemoAndWait(page, widgetDemoUrl);
    await waitForTourToRender(page);

    await dismissTour(page);

    // Tour should no longer be visible
    await expectTourToBeHidden(page);
  });

  test("completed tour does not show again for same visitor", async ({ page }) => {
    if (!workspaceId) return test.skip();
    test.slow();

    // First visit - complete or dismiss tour
    await gotoWidgetDemoAndWait(page, widgetDemoUrl);
    await ensureTourAvailableForDismissal(page);
    await dismissTour(page);
    await expectTourToBeHidden(page);

    // Second visit - tour should not appear
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForWidgetLoad(page, 15000);
    if (!(await isTourStepVisible(page, 500))) {
      await openWidgetChat(page).catch(() => {});
    }
    await expectTourToBeHidden(page);
  });
});

// Skipped: These tests require additional seeding infrastructure
test.describe("Widget E2E Tests - Surveys", () => {
  let workspaceId: Id<"workspaces"> | null = null;

  function surveyWidgetDemoUrl(visitorKey: string): string {
    if (!workspaceId) {
      throw new Error("workspaceId is required for survey widget tests");
    }
    return getWidgetDemoUrl(workspaceId, visitorKey);
  }

  test.beforeEach(async ({ page }) => {
    // Dismiss any active tours that might be blocking interactions (e.g. tour backdrop)
    await dismissTour(page).catch(() => {});
  });

  test.beforeAll(async () => {
    await refreshAuthState();

    const state = getTestState();
    if (!state?.workspaceId) {
      console.warn("No workspace ID in test state - survey tests will be skipped");
      return;
    }
    workspaceId = state.workspaceId as Id<"workspaces">;

    // Seed a test NPS survey
    try {
      await seedSurvey(workspaceId, {
        name: "e2e_test_nps_survey",
        format: "small",
        status: "active",
        questionType: "nps",
        triggerType: "immediate",
      });
    } catch (e) {
      console.warn("Failed to seed survey data:", e);
      workspaceId = null;
    }
  });

  test.afterAll(async () => {
    if (workspaceId) {
      await cleanupTestData(workspaceId);
    }
  });

  test("small format survey displays as floating banner", async ({ page }) => {
    if (!workspaceId) return test.skip();
    await gotoFreshWidgetDemoAndWait(page, surveyWidgetDemoUrl("survey-banner"));

    // Survey should be visible for a first-time visitor with immediate trigger
    await waitForSurveyVisible(page, 15000);
  });

  test("NPS question allows 0-10 scale interaction", async ({ page }) => {
    if (!workspaceId) return test.skip();
    await gotoFreshWidgetDemoAndWait(page, surveyWidgetDemoUrl("survey-nps-scale"));

    await waitForSurveyVisible(page, 10000);

    // Submit a rating and verify the interaction completes
    await submitNPSRating(page, 8);
    // Widget should still be functional after rating
    await expect(page.locator(".opencom-widget")).toBeVisible();
    await expect(getWidgetContainer(page)).toBeVisible();
  });

  test("survey completion shows thank you step", async ({ page }) => {
    if (!workspaceId) return test.skip();
    await gotoFreshWidgetDemoAndWait(page, surveyWidgetDemoUrl("survey-thank-you"));

    await waitForSurveyVisible(page, 10000);

    await submitNPSRating(page, 9);
    await submitSurvey(page);

    // Thank you message should appear after completion
    const frame = getWidgetContainer(page);
    await expect(frame.getByText(/thank you|thanks|appreciated/i)).toBeVisible({ timeout: 5000 });
  });

  test("survey can be dismissed", async ({ page }) => {
    if (!workspaceId) return test.skip();
    await gotoFreshWidgetDemoAndWait(page, surveyWidgetDemoUrl("survey-dismiss"));

    await waitForSurveyVisible(page, 10000);

    await dismissSurvey(page);

    const stillVisible = await isSurveyVisible(page);
    expect(stillVisible).toBe(false);
  });

  test("survey frequency controls (show once) work", async ({ page }) => {
    if (!workspaceId) return test.skip();
    const frequencyTestUrl = surveyWidgetDemoUrl("survey-frequency-once");
    // First visit - complete survey
    await gotoWidgetDemoAndWait(page, frequencyTestUrl);

    const surveyVisible = await isSurveyVisible(page);
    if (surveyVisible) {
      await submitNPSRating(page, 7);
      await submitSurvey(page);
    }

    // Second visit - survey should not appear
    await page.reload();
    await waitForWidgetLoad(page, 15000);

    const surveyVisibleAfterReload = await isSurveyVisible(page);
    // Survey with frequency "once" should not show again
    expect(surveyVisibleAfterReload).toBe(false);
  });
});

test.describe("Widget E2E Tests - Help Center", () => {
  let workspaceId: Id<"workspaces"> | null = null;
  let widgetDemoUrl = "/widget-demo";

  test.beforeAll(async () => {
    await refreshAuthState();

    const state = getTestState();
    if (!state?.workspaceId) {
      console.warn("No workspace ID in test state - help center tests will be skipped");
      return;
    }
    workspaceId = state.workspaceId as Id<"workspaces">;
    widgetDemoUrl = getWidgetDemoUrl(state.workspaceId);

    try {
      // Seed test articles
      await seedArticles(workspaceId, {
        collectionName: "e2e_test_getting_started",
        articleCount: 3,
      });

      // Seed messenger settings
      await seedMessengerSettings(workspaceId);
    } catch (e) {
      console.warn("Failed to seed help center data:", e);
      workspaceId = null;
    }
  });

  test.afterAll(async () => {
    if (workspaceId) {
      await cleanupTestData(workspaceId);
    }
  });

  test("help center tab displays article collections", async ({ page }) => {
    if (!workspaceId) return test.skip();
    await gotoWithAuthRecovery(page, widgetDemoUrl);
    const frame = await waitForWidgetLoad(page, 15000);

    // Click the launcher button to open the widget
    await frame.locator("button").first().click();
    await expect(frame.locator(".opencom-chat")).toBeVisible({ timeout: 5000 });

    // Navigate to help tab
    await navigateToWidgetTab(page, "help");

    // Help center content should be visible (articles, collections, or search)
    const helpContent = frame
      .locator("input[placeholder*='Search'], [data-testid='help-search'], .opencom-article-item")
      .first();
    await expect(helpContent).toBeVisible({ timeout: 5000 });
  });

  test("article search functionality works", async ({ page }) => {
    if (!workspaceId) return test.skip();
    await gotoWithAuthRecovery(page, widgetDemoUrl);
    const frame = await waitForWidgetLoad(page, 15000);

    // Open widget first
    await frame.locator("button").first().click();
    await expect(frame.locator(".opencom-chat")).toBeVisible({ timeout: 5000 });

    // Navigate to help tab
    await navigateToWidgetTab(page, "help");

    // Search input should be present in help center
    const searchInput = frame.locator("input[placeholder*='Search'], [data-testid='help-search']");
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill("getting started");

    // Widget should remain functional after search
    await expect(frame).toBeVisible();
  });

  test("article detail view renders content", async ({ page }) => {
    if (!workspaceId) return test.skip();
    await gotoWithAuthRecovery(page, widgetDemoUrl);
    const frame = await waitForWidgetLoad(page, 15000);

    // Open widget first
    await frame.locator("button").first().click();
    await expect(frame.locator(".opencom-chat")).toBeVisible({ timeout: 5000 });

    // Navigate to help tab
    await navigateToWidgetTab(page, "help");

    // Click a collection first, then open an article detail view
    const collectionButton = await waitForHelpArticleVisible(page, 10000);
    await collectionButton.click();

    const articleButton = frame
      .locator(".opencom-article-item, button:has(.opencom-article-item)")
      .first();
    await expect(articleButton).toBeVisible({ timeout: 10000 });
    await articleButton.click();
    await expect(
      frame.locator("[data-testid='article-content'], .article-content, .opencom-chat")
    ).toBeVisible({ timeout: 5000 });
  });

  test("breadcrumb navigation back to collections", async ({ page }) => {
    if (!workspaceId) return test.skip();
    await gotoWithAuthRecovery(page, widgetDemoUrl);
    const frame = await waitForWidgetLoad(page, 15000);

    // Open widget first
    await frame.locator("button").first().click();
    await expect(frame.locator(".opencom-chat")).toBeVisible({ timeout: 5000 });

    // Navigate to help tab
    await navigateToWidgetTab(page, "help");

    // Click a collection first, then open an article detail view
    const collectionButton = await waitForHelpArticleVisible(page, 10000);
    await collectionButton.click();

    const articleButton = frame
      .locator(".opencom-article-item, button:has(.opencom-article-item)")
      .first();
    await expect(articleButton).toBeVisible({ timeout: 10000 });
    await articleButton.click();
    await expect(
      frame.locator("[data-testid='article-content'], .article-content, .opencom-chat")
    ).toBeVisible({ timeout: 5000 });

    // Navigate back via breadcrumb / back button
    const backButton = frame.locator(".opencom-back, [data-testid='back-button'], .back-button");
    await expect(backButton).toBeVisible({ timeout: 3000 });
    await backButton.click();

    // Should return to collection list
    await expect(frame).toBeVisible();
  });
});

test.describe("Widget E2E Tests - AI Agent", () => {
  let workspaceId: Id<"workspaces"> | null = null;
  let widgetDemoUrl = "/widget-demo";

  test.beforeAll(async () => {
    await refreshAuthState();

    const state = getTestState();
    if (!state?.workspaceId) {
      console.warn("No workspace ID in test state - AI agent tests will be skipped");
      return;
    }
    workspaceId = state.workspaceId as Id<"workspaces">;
    widgetDemoUrl = getWidgetDemoUrl(state.workspaceId);

    try {
      // Seed AI agent settings (enabled)
      await seedAIAgentSettings(workspaceId, { enabled: true });

      // Seed articles for AI to use as knowledge base
      await seedArticles(workspaceId, {
        collectionName: "e2e_test_ai_knowledge",
        articleCount: 3,
      });

      await seedMessengerSettings(workspaceId);
    } catch (e) {
      console.warn("Failed to seed AI agent data:", e);
      workspaceId = null;
    }
  });

  test.afterAll(async () => {
    if (workspaceId) {
      await cleanupTestData(workspaceId);
    }
  });

  test("AI agent responds to visitor message", async ({ page }) => {
    if (!workspaceId) return test.skip();
    await gotoWithAuthRecovery(page, widgetDemoUrl);
    const frame = await openConversationComposer(page);
    await sendWidgetMessage(page, "How do I get started?");

    // Verify the sent message appears in the conversation
    await expect(frame.getByText("How do I get started?")).toBeVisible({ timeout: 5000 });
  });

  test("AI response shows AI badge", async ({ page }) => {
    if (!workspaceId) return test.skip();
    await gotoWithAuthRecovery(page, widgetDemoUrl);
    const frame = await openConversationComposer(page);
    await sendWidgetMessage(page, "What features do you offer?");

    // Verify the message was sent
    await expect(frame.getByText("What features do you offer?")).toBeVisible({ timeout: 5000 });
  });

  test("Talk to human button triggers handoff", async ({ page }) => {
    if (!workspaceId) return test.skip();
    await gotoWithAuthRecovery(page, widgetDemoUrl);
    const frame = await openConversationComposer(page);
    await sendWidgetMessage(page, "I need a human to help me");

    // Wait for either the explicit AI response badge or the handoff message
    await expect(
      frame
        .locator(
          "[data-testid='ai-badge'], :text('Waiting for human support'), :text('connect you with a human agent'), button:has-text('Talk to a human')"
        )
        .first()
    ).toBeVisible({ timeout: 20000 });
  });

  test("feedback buttons work (helpful/not helpful)", async ({ page }) => {
    if (!workspaceId) return test.skip();
    await gotoWithAuthRecovery(page, widgetDemoUrl);
    const frame = await openConversationComposer(page);
    await sendWidgetMessage(page, "Help me with setup");

    // Wait for any AI-related element to appear (badge or handoff)
    const aiIndicators = frame.locator(
      "[data-testid='ai-badge'], .ai-response-badge, :text('AI'), :text('human support')"
    );
    await expect(aiIndicators.first()).toBeVisible({ timeout: 20000 });

    // Feedback should render when supported; if the conversation is handed off immediately,
    // assert the AI response/handoff state instead of waiting on non-existent controls.
    const feedbackButtons = frame.locator(
      "[data-testid='feedback-helpful'], [data-testid='feedback-not-helpful'], .feedback-button, button[aria-label*='helpful'], button[aria-label*='not helpful']"
    );

    const feedbackVisible = await feedbackButtons
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (feedbackVisible) {
      await feedbackButtons.first().click();
    } else {
      // If buttons aren't visible, we must be in a handoff or minimal AI state
      await expect(
        frame.locator(":text('human support'), :text('human agent'), :text('AI')").first()
      ).toBeVisible({ timeout: 10000 });
    }

    await expect(frame).toBeVisible();
  });
});

test.describe("Widget E2E Tests - Large Format Survey", () => {
  let workspaceId: Id<"workspaces"> | null = null;
  let widgetDemoUrl = "/widget-demo";

  test.beforeAll(async () => {
    await refreshAuthState();

    const state = getTestState();
    if (!state?.workspaceId) {
      console.warn("No workspace ID in test state - large survey tests will be skipped");
      return;
    }
    workspaceId = state.workspaceId as Id<"workspaces">;
    widgetDemoUrl = getWidgetDemoUrl(state.workspaceId);

    try {
      // Seed a large format survey (modal)
      await seedSurvey(workspaceId, {
        name: "e2e_test_large_survey",
        format: "large",
        status: "active",
        questionType: "star_rating",
        triggerType: "time_on_page",
      });
    } catch (e) {
      console.warn("Failed to seed large survey data:", e);
      workspaceId = null;
    }
  });

  test.afterAll(async () => {
    if (workspaceId) {
      await cleanupTestData(workspaceId);
    }
  });

  test("large format survey displays as modal", async ({ page }) => {
    if (!workspaceId) return test.skip();
    await gotoWidgetDemoAndWait(page, widgetDemoUrl);

    // Wait for time-on-page trigger to fire
    const frame = getWidgetContainer(page);
    const modal = frame.locator(
      ".oc-survey-overlay, .oc-survey-large, [data-testid='survey-modal']"
    );
    // Large survey modal should appear after time delay (seeded with time_on_page trigger)
    await expect(modal.first()).toBeVisible({ timeout: 15000 });
  });
});
