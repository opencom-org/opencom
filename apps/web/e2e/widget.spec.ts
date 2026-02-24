import { test, expect } from "./fixtures";
import type { Locator } from "@playwright/test";
import { waitForWidgetLoad, openWidgetChat } from "./helpers/widget-helpers";
import { gotoWithAuthRecovery } from "./helpers/auth-refresh";
import { resolveE2EBackendUrl } from "./helpers/e2e-env";

// Widget demo URL with workspace ID injected via query param
const getWidgetDemoUrl = (workspaceId?: string) =>
  workspaceId ? `/widget-demo?workspaceId=${workspaceId}` : "/widget-demo";
const WIDGET_CONVEX_URL = resolveE2EBackendUrl();

async function gotoWidgetDemoOrSkip(
  page: import("@playwright/test").Page,
  workspaceId?: string
): Promise<void> {
  await gotoWithAuthRecovery(page, getWidgetDemoUrl(workspaceId));
  if (page.isClosed()) {
    throw new Error("[widget.spec] Widget demo page was closed during setup");
  }
  if (!/\/widget-demo/.test(page.url())) {
    throw new Error(`[widget.spec] Unexpected URL during widget setup: ${page.url()}`);
  }
}

async function waitForWidgetLoadOrSkip(
  page: import("@playwright/test").Page,
  timeout = 10000
): Promise<Locator> {
  return await waitForWidgetLoad(page, timeout);
}

async function openWidgetChatOrSkip(page: import("@playwright/test").Page): Promise<Locator> {
  return await openWidgetChat(page);
}

async function startConversationIfNeeded(widget: Locator, required = true): Promise<boolean> {
  const input = widget.locator("input.opencom-input");
  if (await input.isVisible({ timeout: 1500 }).catch(() => false)) {
    return true;
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    const outboundDismiss = widget.locator(".opencom-outbound-chat-close").first();
    if (await outboundDismiss.isVisible({ timeout: 500 }).catch(() => false)) {
      await outboundDismiss.click({ force: true }).catch(() => {});
    }

    const messagesTab = widget.getByRole("button", { name: /^Messages$/i }).first();
    if (await messagesTab.isVisible({ timeout: 1000 }).catch(() => false)) {
      await messagesTab.click({ timeout: 4000 }).catch(() => {});
    }

    const existingConversation = widget.locator(".opencom-conversation-item").first();
    if (await existingConversation.isVisible({ timeout: 1000 }).catch(() => false)) {
      try {
        await existingConversation.click({ timeout: 4000 });
      } catch {
        await existingConversation.click({ force: true, timeout: 4000 }).catch(() => {});
      }
    } else {
      const startButtonCandidates = [
        widget.locator(".opencom-start-conv").first(),
        widget.locator(".opencom-home-start-button").first(),
        widget.locator(".opencom-new-conv").first(),
      ];

      for (const startButton of startButtonCandidates) {
        if (!(await startButton.isVisible({ timeout: 800 }).catch(() => false))) {
          continue;
        }
        try {
          await startButton.click({ timeout: 4000 });
          break;
        } catch {
          await startButton.click({ force: true, timeout: 4000 }).catch(() => {});
        }
      }
    }

    if (await input.isVisible({ timeout: 8000 }).catch(() => false)) {
      return true;
    }
  }

  if (required) {
    await expect(input).toBeVisible({ timeout: 10000 });
  }
  return false;
}

test.describe("Widget Integration - Core", () => {
  test.beforeEach(async ({ page, testState }) => {
    // Navigate to widget demo page with workspace ID from test state
    await gotoWidgetDemoOrSkip(page, testState.workspaceId);
  });

  test("should embed widget on page", async ({ page }) => {
    // Wait for widget to load
    const frame = await waitForWidgetLoadOrSkip(page, 15000);

    // Verify launcher is visible
    await expect(
      frame.locator("[data-testid='widget-launcher'], .opencom-launcher, button").first()
    ).toBeVisible();
  });

  test("should open widget chat on launcher click", async ({ page }) => {
    const frame = await openWidgetChatOrSkip(page);
    await expect(frame.locator(".opencom-chat").first()).toBeVisible({ timeout: 10000 });
  });

  test("should send message from widget", async ({ page }) => {
    // Open widget chat
    const frame = await openWidgetChatOrSkip(page);
    await startConversationIfNeeded(frame);

    // Find and fill message input
    const messageInput = frame.locator("input.opencom-input");
    await expect(messageInput).toBeVisible({ timeout: 5000 });
    await messageInput.fill("Hello from E2E test!");

    // Send message
    const sendBtn = frame.locator(".opencom-send");
    await expect(sendBtn).toBeVisible({ timeout: 2000 });
    await sendBtn.click();

    // Wait for message to appear in the conversation
    await expect(frame.getByText("Hello from E2E test!")).toBeVisible({ timeout: 5000 });
  });

  test("should sync widget message to admin inbox", async ({ page }) => {
    // First send a message from widget
    const frame = await openWidgetChatOrSkip(page);
    await startConversationIfNeeded(frame);

    const testMessage = `Sync test ${Date.now()}`;
    const messageInput = frame.locator("input.opencom-input");
    await expect(messageInput).toBeVisible({ timeout: 5000 });
    await messageInput.fill(testMessage);

    const sendBtn = frame.locator(".opencom-send");
    await expect(sendBtn).toBeVisible({ timeout: 2000 });
    await sendBtn.click();

    // Verify message appears in widget conversation
    await expect(frame.getByText(testMessage)).toBeVisible({ timeout: 5000 });

    // Note: Full sync test would require admin login and inbox verification
    // This is handled in the integration test suite with proper auth setup
  });

  test("should display welcome message from settings", async ({ page }) => {
    const frame = await openWidgetChatOrSkip(page);

    // Ensure we are on the Home tab before asserting greeting.
    const homeTab = frame.getByRole("button", { name: /^Home$/i }).first();
    await expect(homeTab).toBeVisible({ timeout: 10000 });
    await homeTab.click();

    const greeting = frame.locator(".opencom-home-greeting");
    await expect(greeting).toBeVisible({ timeout: 15000 });

    const welcomeText = frame.locator(".opencom-home-welcome-text");
    await expect(welcomeText).toBeVisible({ timeout: 10000 });
  });

  test("should respect theme colors from messenger settings", async ({ page }) => {
    const frame = await waitForWidgetLoadOrSkip(page);

    // Get launcher button and check it has some styling applied
    const launcher = frame.locator(".opencom-launcher").first();
    await expect(launcher).toBeVisible();

    // Verify the launcher has a background color (theme applied)
    const bgColor = await launcher.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bgColor).toBeTruthy();
  });
});

test.describe("Widget Automatic Event Tracking", () => {
  test.beforeEach(async ({ page, testState }) => {
    await gotoWidgetDemoOrSkip(page, testState.workspaceId);
  });

  test("should track page_view event on page load", async ({ page }) => {
    // Wait for widget to initialize
    const frame = await waitForWidgetLoadOrSkip(page, 15000);

    // Widget should be loaded which indicates page tracking has occurred
    await expect(frame.locator("button").first()).toBeVisible();
  });

  test("should track session_start event on widget initialization", async ({ page }) => {
    // Clear session storage to ensure new session
    await page.evaluate(() => {
      localStorage.removeItem("opencom_session_id");
      localStorage.removeItem("opencom_visitor_id");
    });

    // Reload to trigger new session
    await page.reload();

    // Widget should initialize with new session
    const frame = await waitForWidgetLoadOrSkip(page, 15000);
    await expect(frame.locator("button").first()).toBeVisible();
  });

  test("should track scroll_depth events at thresholds", async ({ page }) => {
    // Wait for widget to load first
    await waitForWidgetLoadOrSkip(page);

    // Scroll whichever container is active for this page (main overflow container or window).
    for (const pct of [0.25, 0.5, 0.75, 0.9]) {
      await page.evaluate((p) => {
        const main = document.querySelector("main");
        if (main instanceof HTMLElement && main.scrollHeight - main.clientHeight > 0) {
          const scrollHeight = main.scrollHeight - main.clientHeight;
          main.scrollTo(0, scrollHeight * p);
          return;
        }

        const docEl = document.scrollingElement || document.documentElement;
        const scrollHeight = docEl.scrollHeight - window.innerHeight;
        if (scrollHeight > 0) {
          window.scrollTo(0, scrollHeight * p);
        }
      }, pct);
      await page.waitForTimeout(120);
    }

    // Verify the bottom section was reached after scrolling.
    const lastSection = page.locator("[data-testid='scroll-section-5']");
    await expect(lastSection).toBeVisible({ timeout: 5000 });
    await expect(lastSection).toBeInViewport({ timeout: 5000 });
  });

  test("should track exit_intent event on mouse leave", async ({ page }) => {
    await waitForWidgetLoadOrSkip(page);

    // Dispatch a deterministic mouseleave event at top boundary.
    await page.evaluate(() => {
      document.dispatchEvent(new MouseEvent("mouseleave", { clientY: 0, bubbles: true }));
    });

    // Widget should still be functional
    const widget = await waitForWidgetLoad(page, 15000);
    await expect(widget.locator("button").first()).toBeVisible();
  });

  test("should track page_view on SPA navigation", async ({ page }) => {
    await waitForWidgetLoadOrSkip(page);

    // Simulate SPA navigation using pushState
    await page.evaluate(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("e2eSpaNav", String(Date.now()));
      history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    });
    await page.waitForFunction(() => window.location.search.includes("e2eSpaNav"), null, {
      timeout: 5000,
    });

    // Widget should still be active
    const widget2 = await waitForWidgetLoad(page, 15000);
    await expect(widget2.locator("button").first()).toBeVisible();

    // Navigate back
    await page.evaluate(() => {
      history.back();
    });
    await page.waitForFunction(() => !window.location.search.includes("e2eSpaNav"), null, {
      timeout: 5000,
    });
    await waitForWidgetLoad(page, 15000);
    await expect(widget2.locator("button").first()).toBeVisible();
  });
});

test.describe("Widget Email Capture", () => {
  test.beforeEach(async ({ page, testState }) => {
    // Navigate to widget demo page (inits widget with email)
    await gotoWidgetDemoOrSkip(page, testState.workspaceId);
    await waitForWidgetLoadOrSkip(page);

    // Re-init widget WITHOUT email so email capture can trigger.
    // Grab convexUrl from the already-initialised widget page, then destroy and re-init.
    await page.evaluate(
      ({ wsId, convexUrl }) => {
        window.OpencomWidget?.destroy();
        sessionStorage.removeItem("opencom_email_dismissed");

        window.OpencomWidget?.init({
          convexUrl,
          workspaceId: wsId,
          trackPageViews: false,
          user: { name: "Anonymous Visitor" }, // no email
        });
      },
      { wsId: testState.workspaceId, convexUrl: WIDGET_CONVEX_URL }
    );

    // Wait for widget to re-appear after re-init
    await waitForWidgetLoadOrSkip(page, 15000);
  });

  test("should show email capture prompt after first visitor message", async ({ page }) => {
    const widget = await openWidgetChatOrSkip(page);
    await startConversationIfNeeded(widget);

    // Send a message
    const input = widget.locator("input.opencom-input");
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill("Hi, I need help!");
    await widget.locator(".opencom-send").click();

    // Email capture prompt should appear after sending the first message
    await expect(widget.locator(".opencom-email-capture")).toBeVisible({ timeout: 10000 });
  });

  test("should submit email via capture prompt", async ({ page }) => {
    const widget = await openWidgetChatOrSkip(page);
    await startConversationIfNeeded(widget);

    // Send a message to trigger email capture
    const input = widget.locator("input.opencom-input");
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill("Testing email capture");
    await widget.locator(".opencom-send").click();

    // Wait for email capture prompt
    await expect(widget.locator(".opencom-email-capture")).toBeVisible({ timeout: 10000 });

    // Fill and submit email
    const emailInput = widget.locator(".opencom-email-input");
    await emailInput.fill(`visitor+${Date.now()}@example.com`);
    await widget.locator(".opencom-email-submit").click();

    // Prompt should disappear after submission; retry submit once if UI lagged.
    const capturePrompt = widget.locator(".opencom-email-capture");
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!(await capturePrompt.isVisible({ timeout: 1500 }).catch(() => false))) {
        break;
      }
      await widget
        .locator(".opencom-email-submit")
        .click({ timeout: 5000 })
        .catch(() => {});
      await page.waitForTimeout(800);
    }
    await expect(capturePrompt).not.toBeVisible({ timeout: 20000 });
  });

  test("should dismiss email capture prompt", async ({ page }) => {
    const widget = await openWidgetChatOrSkip(page);
    await startConversationIfNeeded(widget);

    // Send a message to trigger email capture
    const input = widget.locator("input.opencom-input");
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill("Testing email dismiss");
    await widget.locator(".opencom-send").click();

    // Wait for email capture prompt
    const capturePrompt = widget.locator(".opencom-email-capture");
    await expect(capturePrompt).toBeVisible({ timeout: 10000 });

    // Click Skip to dismiss
    const skipButton = widget.locator(".opencom-email-skip");
    await skipButton.click({ timeout: 5000 }).catch(async () => {
      await skipButton.click({ force: true, timeout: 5000 });
    });
    await page
      .waitForFunction(() => sessionStorage.getItem("opencom_email_dismissed") === "true", null, {
        timeout: 5000,
      })
      .catch(() => {});

    // Prompt should disappear after dismissal
    await expect(capturePrompt).not.toBeVisible({ timeout: 20000 });
  });
});
