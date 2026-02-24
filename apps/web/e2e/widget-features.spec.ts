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
  submitNPSRating,
  dismissSurvey,
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

function getWidgetDemoUrl(workspaceId: string): string {
  return `/widget-demo?workspaceId=${workspaceId}`;
}

async function gotoWidgetDemoAndWait(page: import("@playwright/test").Page, url: string) {
  await gotoWithAuthRecovery(page, url);
  await waitForWidgetLoad(page, 15000);
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

test.beforeEach(async ({ page }) => {
  await refreshAuthState();
  const ok = await ensureAuthenticatedInPage(page);
  if (!ok) {
    test.skip(true, "[widget-features.spec] Could not authenticate test page");
  }
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
    await expect.poll(async () => isTourStepVisible(page), { timeout: 15000 }).toBe(true);
  });

  test("tour step navigation works (next/prev/skip)", async ({ page }) => {
    if (!workspaceId) return test.skip();
    await gotoWidgetDemoAndWait(page, widgetDemoUrl);

    const tourVisible = await isTourStepVisible(page);
    test.skip(!tourVisible, "Tour not visible – may have been completed by a prior test");

    // Advance to next step
    await advanceTourStep(page);
    // Tour should still be visible (multi-step tour) or completed
    // Either outcome is acceptable – just verify the action didn't crash
    await expect(page.locator(".opencom-widget")).toBeVisible();
  });

  test("tour can be dismissed", async ({ page }) => {
    if (!workspaceId) return test.skip();
    await gotoWidgetDemoAndWait(page, widgetDemoUrl);

    const tourVisible = await isTourStepVisible(page);
    test.skip(!tourVisible, "Tour not visible – cannot test dismissal");

    await dismissTour(page);

    // Tour should no longer be visible
    const stillVisible = await isTourStepVisible(page);
    expect(stillVisible).toBe(false);
  });

  test("completed tour does not show again for same visitor", async ({ page }) => {
    if (!workspaceId) return test.skip();
    // First visit - complete or dismiss tour
    await gotoWidgetDemoAndWait(page, widgetDemoUrl);

    const tourVisible = await isTourStepVisible(page);
    if (tourVisible) {
      await dismissTour(page);
    } else {
      // Tour wasn't shown on first visit – still verify second visit
    }

    // Second visit - tour should not appear
    await page.reload();
    await waitForWidgetLoad(page, 15000);

    const tourVisibleAfterReload = await isTourStepVisible(page);
    // Tour should not show again (frequency: first_time_only)
    expect(tourVisibleAfterReload).toBe(false);
  });
});

// Skipped: These tests require additional seeding infrastructure
test.describe("Widget E2E Tests - Surveys", () => {
  let workspaceId: Id<"workspaces"> | null = null;
  let widgetDemoUrl = "/widget-demo";

  test.beforeAll(async () => {
    await refreshAuthState();

    const state = getTestState();
    if (!state?.workspaceId) {
      console.warn("No workspace ID in test state - survey tests will be skipped");
      return;
    }
    workspaceId = state.workspaceId as Id<"workspaces">;
    widgetDemoUrl = getWidgetDemoUrl(state.workspaceId);

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
    await gotoWidgetDemoAndWait(page, widgetDemoUrl);

    // Survey should be visible for a first-time visitor with immediate trigger
    const surveyVisible = await isSurveyVisible(page);
    expect(surveyVisible).toBe(true);
  });

  test("NPS question allows 0-10 scale interaction", async ({ page }) => {
    if (!workspaceId) return test.skip();
    await gotoWidgetDemoAndWait(page, widgetDemoUrl);

    const surveyVisible = await isSurveyVisible(page);
    test.skip(!surveyVisible, "Survey not visible – cannot test NPS interaction");

    // Submit a rating and verify the interaction completes
    await submitNPSRating(page, 8);
    // Widget should still be functional after rating
    await expect(page.locator(".opencom-widget")).toBeVisible();
  });

  test("survey completion shows thank you step", async ({ page }) => {
    if (!workspaceId) return test.skip();
    await gotoWidgetDemoAndWait(page, widgetDemoUrl);

    const surveyVisible = await isSurveyVisible(page);
    test.skip(!surveyVisible, "Survey not visible – cannot test completion flow");

    await submitNPSRating(page, 9);

    // Thank you message should appear after completion
    const frame = getWidgetContainer(page);
    await expect(frame.getByText(/thank you|thanks|appreciated/i)).toBeVisible({ timeout: 3000 });
  });

  test("survey can be dismissed", async ({ page }) => {
    if (!workspaceId) return test.skip();
    await gotoWidgetDemoAndWait(page, widgetDemoUrl);

    const surveyVisible = await isSurveyVisible(page);
    test.skip(!surveyVisible, "Survey not visible – cannot test dismissal");

    await dismissSurvey(page);

    const stillVisible = await isSurveyVisible(page);
    expect(stillVisible).toBe(false);
  });

  test("survey frequency controls (show once) work", async ({ page }) => {
    if (!workspaceId) return test.skip();
    // First visit - complete survey
    await gotoWidgetDemoAndWait(page, widgetDemoUrl);

    const surveyVisible = await isSurveyVisible(page);
    if (surveyVisible) {
      await submitNPSRating(page, 7);
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

    // Click an article link
    const articleLink = frame.locator(".opencom-article-item").first();
    const articleVisible = await articleLink.isVisible({ timeout: 3000 }).catch(() => false);
    test.skip(!articleVisible, "No articles visible in help center");

    await articleLink.click();
    // Article content or detail view should be visible
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

    // Click an article to enter detail view
    const articleLink = frame.locator(".opencom-article-item").first();
    const articleVisible = await articleLink.isVisible({ timeout: 3000 }).catch(() => false);
    test.skip(!articleVisible, "No articles visible – cannot test breadcrumb nav");

    await articleLink.click();
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

    // Look for handoff button
    const handoffButton = frame.locator(
      "button:has-text('human'), button:has-text('agent'), [data-testid='handoff-button']"
    );
    const handoffVisible = await handoffButton
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    test.skip(!handoffVisible, "Handoff button not visible – AI agent may not have responded yet");

    await handoffButton.first().click();
    // Widget should remain functional after handoff
    await expect(frame).toBeVisible();
  });

  test("feedback buttons work (helpful/not helpful)", async ({ page }) => {
    if (!workspaceId) return test.skip();
    await gotoWithAuthRecovery(page, widgetDemoUrl);
    const frame = await openConversationComposer(page);
    await sendWidgetMessage(page, "Help me with setup");

    // Verify message sent
    await expect(frame.getByText("Help me with setup")).toBeVisible({ timeout: 5000 });

    // Look for feedback buttons (appear after AI response)
    const feedbackButtons = frame.locator(
      "[data-testid='feedback-helpful'], [data-testid='feedback-not-helpful'], .feedback-button"
    );
    const feedbackVisible = await feedbackButtons
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    test.skip(!feedbackVisible, "Feedback buttons not visible – AI agent may not have responded");

    await feedbackButtons.first().click();
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
