import { Page, Locator, expect } from "@playwright/test";

const AUTH_ROUTE_RE = /\/(login|signup)(\/|$|\?)/;

/**
 * Widget E2E Test Helpers
 * Provides utilities for interacting with the embedded widget in E2E tests.
 *
 * Note: The widget is rendered directly in the page as a div#opencom-widget,
 * NOT in an iframe. All selectors work on the page directly.
 */

/**
 * Gets the widget container locator.
 * The widget is rendered as a div.opencom-widget in the page.
 */
export function getWidgetContainer(page: Page): Locator {
  return page.locator(".opencom-widget");
}

/**
 * Waits for the widget to be fully loaded and visible.
 * Returns a scoped locator for the widget container.
 */
export async function waitForWidgetLoad(page: Page, timeout = 10000): Promise<Locator> {
  const widget = getWidgetContainer(page);
  const maxAttempts = 2;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (AUTH_ROUTE_RE.test(page.url())) {
        throw new Error(`Widget page redirected to auth route: ${page.url()}`);
      }

      // Wait for the widget container to exist
      await expect(widget).toBeVisible({ timeout });

      // Wait for the launcher button inside the widget container.
      await expect(widget.locator(".opencom-launcher").first()).toBeVisible({ timeout });

      return widget;
    } catch (error) {
      if (attempt === maxAttempts - 1 || AUTH_ROUTE_RE.test(page.url())) {
        throw error;
      }

      // Some runs race widget bootstrap; reload once and retry.
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
    }
  }

  return widget;
}

/**
 * Opens the widget chat by clicking the launcher.
 */
export async function openWidgetChat(page: Page): Promise<Locator> {
  const widget = await waitForWidgetLoad(page);

  // Click the launcher to open widget (opens to conversation-list first)
  for (let attempt = 0; attempt < 2; attempt++) {
    const launcher = widget.locator(".opencom-launcher").first();
    await expect(launcher).toBeVisible({ timeout: 10000 });
    try {
      await launcher.click({ timeout: 10000 });
      break;
    } catch (error) {
      if (attempt === 1) {
        throw error;
      }
    }
  }

  // Wait for the chat panel to be visible
  await expect(widget.locator(".opencom-chat").first()).toBeVisible({ timeout: 10000 });

  return widget;
}

/**
 * Closes the widget chat.
 */
export async function closeWidgetChat(page: Page): Promise<void> {
  const frame = getWidgetContainer(page);

  // Click close button
  await frame.locator("[data-testid='widget-close'], .opencom-close").click();

  // Wait for chat to be hidden
  await expect(frame.locator("[data-testid='widget-chat'], .opencom-chat")).not.toBeVisible();
}

/**
 * Sends a message from the widget.
 */
export async function sendWidgetMessage(page: Page, message: string): Promise<void> {
  const frame = getWidgetContainer(page);

  // Type message
  const input = frame
    .locator("[data-testid='widget-message-input'], input[placeholder*='Type a message'], textarea")
    .first();
  await input.fill(message);

  // Send message
  await frame
    .locator(
      "[data-testid='widget-send-button'], .opencom-send, [data-testid='send-button'], button[type='submit']"
    )
    .first()
    .click();

  // Wait for message to appear
  await expect(page.getByText(message)).toBeVisible({ timeout: 5000 });
}

/**
 * Waits for a message to appear in the widget.
 */
export async function waitForWidgetMessage(
  page: Page,
  messageText: string | RegExp,
  timeout = 10000
): Promise<void> {
  await expect(page.getByText(messageText)).toBeVisible({ timeout });
}

/**
 * Navigates to a specific tab in the widget (Home, Messages, Help).
 */
export async function navigateToWidgetTab(
  page: Page,
  tab: "home" | "messages" | "help" | "tours" | "tasks" | "tickets"
): Promise<void> {
  const frame = getWidgetContainer(page);

  // Use text-based selectors that match actual widget button structure
  const tabNames: Record<string, string> = {
    home: "Home",
    messages: "Messages",
    help: "Help",
    tours: "Tours",
    tasks: "Tasks",
    tickets: "Tickets",
  };

  await frame.getByRole("button", { name: tabNames[tab] }).click();
}

/**
 * Searches for an article in the help center.
 */
export async function searchHelpCenter(page: Page, query: string): Promise<void> {
  const frame = getWidgetContainer(page);

  // Navigate to help tab
  await navigateToWidgetTab(page, "help");

  // Type in search
  const searchInput = frame.locator("[data-testid='help-search'], input[placeholder*='Search']");
  await searchInput.fill(query);

  // Wait for search results to load after debounce
  await page.waitForLoadState("networkidle").catch(() => {});
}

/**
 * Clicks an article in the help center.
 */
export async function clickHelpArticle(page: Page, articleTitle: string): Promise<void> {
  const frame = getWidgetContainer(page);

  await page.getByText(articleTitle).click();

  // Wait for article content to load
  await expect(frame.locator("[data-testid='article-content'], .article-content")).toBeVisible();
}

/**
 * Checks if a tour step is visible.
 */
export async function isTourStepVisible(page: Page): Promise<boolean> {
  try {
    await expect(
      page.locator("[data-testid='tour-step-card'], [data-testid='tour-overlay']").first()
    ).toBeVisible({
      timeout: 6000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Advances the tour to the next step.
 */
export async function advanceTourStep(page: Page): Promise<void> {
  await page
    .locator(
      "[data-testid='tour-primary-action'], .opencom-tour-btn-primary, button:has-text('Next')"
    )
    .first()
    .click();
}

/**
 * Dismisses the current tour.
 */
export async function dismissTour(page: Page): Promise<void> {
  const dismissSelectors = [
    "[data-testid='tour-emergency-close']",
    "button[aria-label='Dismiss tour']",
    "[data-testid='tour-dismiss']",
    ".tour-dismiss",
    ".opencom-tour-close",
  ];

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const visible = await isTourStepVisible(page);
    if (!visible) {
      return;
    }

    let attemptedDismiss = false;

    for (const selector of dismissSelectors) {
      const dismissButton = page.locator(selector).first();
      const hasDismissButton = await dismissButton.isVisible({ timeout: 1000 }).catch(() => false);
      if (!hasDismissButton) {
        continue;
      }

      attemptedDismiss = true;
      const clicked = await dismissButton
        .click({ timeout: 2500 })
        .then(() => true)
        .catch(async () => {
          return dismissButton
            .click({ force: true, timeout: 2500 })
            .then(() => true)
            .catch(() => false);
        });

      if (!clicked) {
        await page
          .evaluate((dismissSelector) => {
            const target = document.querySelector<HTMLElement>(dismissSelector);
            target?.click();
          }, selector)
          .catch(() => {});
      }

      break;
    }

    if (!attemptedDismiss) {
      await page.keyboard.press("Escape").catch(() => {});
    }

    await page.waitForTimeout(300);
  }
}

/**
 * Checks if a survey is visible.
 */
export async function isSurveyVisible(page: Page): Promise<boolean> {
  const frame = getWidgetContainer(page);

  try {
    await expect(
      frame.locator(".oc-survey-small, .oc-survey-overlay, .oc-survey-large").first()
    ).toBeVisible({
      timeout: 2000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Submits an NPS rating in a survey.
 */
export async function submitNPSRating(page: Page, rating: number): Promise<void> {
  const frame = getWidgetContainer(page);

  // Click the rating button (0-10)
  await frame
    .locator(
      `.oc-survey-nps-button:has-text('${rating}'), [data-testid='nps-${rating}'], button:has-text('${rating}')`
    )
    .first()
    .click();

  // Wait for next step or completion
  await page.waitForLoadState("networkidle").catch(() => {});
}

/**
 * Dismisses a survey.
 */
export async function dismissSurvey(page: Page): Promise<void> {
  const frame = getWidgetContainer(page);

  await frame
    .locator(".oc-survey-dismiss, [data-testid='survey-dismiss'], .survey-dismiss")
    .first()
    .click();
}

/**
 * Checks if an outbound message is visible.
 */
export async function isOutboundMessageVisible(page: Page): Promise<boolean> {
  const frame = getWidgetContainer(page);

  try {
    await expect(
      frame
        .locator(
          ".opencom-outbound-banner, .opencom-outbound-post-overlay, .opencom-outbound-chat, [data-testid='outbound-message'], .outbound-message"
        )
        .first()
    ).toBeVisible({ timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Clicks a button in an outbound message.
 */
export async function clickOutboundButton(page: Page, buttonText: string): Promise<void> {
  const frame = getWidgetContainer(page);

  await frame
    .locator(
      `.opencom-outbound-banner button:has-text('${buttonText}'), .opencom-outbound-post button:has-text('${buttonText}'), .opencom-outbound-chat button:has-text('${buttonText}'), [data-testid='outbound-message'] button:has-text('${buttonText}')`
    )
    .first()
    .click();
}

/**
 * Waits for the AI agent response badge to appear.
 */
export async function waitForAIResponse(page: Page, timeout = 15000): Promise<void> {
  const frame = getWidgetContainer(page);

  await expect(
    frame.locator("[data-testid='ai-badge'], .ai-response-badge, :text('AI')")
  ).toBeVisible({ timeout });
}

/**
 * Clicks the "Talk to human" button for AI handoff.
 */
export async function requestHumanHandoff(page: Page): Promise<void> {
  const frame = getWidgetContainer(page);

  await frame
    .locator(
      "[data-testid='handoff-button'], button:has-text('Talk to human'), button:has-text('human')"
    )
    .click();
}

/**
 * Provides feedback on an AI response.
 */
export async function provideFeedback(page: Page, helpful: boolean): Promise<void> {
  const frame = getWidgetContainer(page);

  const selector = helpful
    ? "[data-testid='feedback-helpful'], button[aria-label*='helpful']"
    : "[data-testid='feedback-not-helpful'], button[aria-label*='not helpful']";

  await frame.locator(selector).last().click();
}

/**
 * Gets the widget theme colors for visual regression testing.
 */
export async function getWidgetTheme(
  page: Page
): Promise<{ primaryColor: string; backgroundColor: string }> {
  const launcher = page.locator("[data-testid='widget-launcher'], .opencom-launcher");
  const primaryColor = await launcher.evaluate(
    (el: Element) => getComputedStyle(el).backgroundColor
  );

  const chat = page.locator("[data-testid='widget-chat'], .opencom-chat");
  let backgroundColor = "rgb(255, 255, 255)";
  try {
    backgroundColor = await chat.evaluate((el: Element) => getComputedStyle(el).backgroundColor);
  } catch {
    // Chat might not be open
  }

  return { primaryColor, backgroundColor };
}
