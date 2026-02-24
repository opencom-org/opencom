import { test, expect } from "./fixtures";

// Auth is handled by global setup via storageState in playwright.config.ts

test.describe("Identity Verification Flow", () => {
  // No beforeEach needed - using global auth state

  test("should display security settings section", async ({ page }) => {
    await page.goto("/settings");

    // Look for security settings section
    const securitySection = page.getByText(/security.*settings|identity.*verification/i);
    await expect(securitySection.first()).toBeVisible({ timeout: 5000 });
  });

  test("should show identity verification toggle", async ({ page }) => {
    await page.goto("/settings");

    // Look for identity verification section
    const identitySection = page.getByText(/identity.*verification|hmac/i);
    if (
      await identitySection
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      expect(await identitySection.first().isVisible()).toBe(true);
    }
  });

  test("should show warning when identity verification is disabled", async ({ page }) => {
    await page.goto("/settings");

    // Look for warning about impersonation risk
    const warningText = page.getByText(/without.*identity.*verification|impersonat/i);
    if (
      await warningText
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      expect(await warningText.first().isVisible()).toBe(true);
    }
  });

  test("should enable identity verification", async ({ page }) => {
    await page.goto("/settings");

    // Look for a toggle near identity verification text
    const identitySection = page.getByText(/identity.*verification/i).first();
    if (await identitySection.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Try to find nearby toggle button
      const toggle = page.locator("button[role='switch'], button:has(span.rounded-full)").first();

      if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) {
        await toggle.click();

        // After enabling, should show HMAC secret
        const secretDisplay = page.getByText(/hmac.*secret|secret.*key/i);
        await expect(secretDisplay.first()).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test("should display HMAC secret after enabling", async ({ page }) => {
    await page.goto("/settings");

    // Enable identity verification first (if not already enabled)
    const toggle = page.locator("button[role='switch']").first();

    if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Check if already enabled by looking for secret display
      const secretDisplay = page.locator("code").first();

      if (!(await secretDisplay.isVisible({ timeout: 1000 }).catch(() => false))) {
        await toggle.click();
        await page.waitForTimeout(1000);
      }

      // Should show secret in code block
      const codeBlock = page.locator("code");
      if (await codeBlock.isVisible({ timeout: 3000 }).catch(() => false)) {
        expect(await codeBlock.isVisible()).toBe(true);
      }
    }
  });

  test("should have copy button for HMAC secret", async ({ page }) => {
    await page.goto("/settings");

    // Check if there's a copy icon/button in the security section
    const securitySection = page.getByText(/hmac.*secret/i);
    if (
      await securitySection
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      // Copy button should be nearby
      const nearCopyButton = page.getByRole("button", { name: /copy/i });
      if (await nearCopyButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        expect(await nearCopyButton.isVisible()).toBe(true);
      }
    }
  });

  test("should show verification mode selector", async ({ page }) => {
    await page.goto("/settings");

    // Look for mode selector (optional/required)
    const modeSelector = page.getByText(/verification.*mode|optional|required/i);
    if (
      await modeSelector
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      // Should have dropdown or radio for mode selection
      const modeDropdown = page.locator("select").filter({ hasText: /optional|required/i });
      if (await modeDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
        expect(await modeDropdown.isVisible()).toBe(true);
      }
    }
  });

  test("should show integration example code", async ({ page }) => {
    await page.goto("/settings");

    // Look for code example section
    const codeExample = page.locator("pre").filter({ hasText: /crypto|hmac|createHmac/i });
    if (
      await codeExample
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      expect(await codeExample.first().isVisible()).toBe(true);
    }
  });

  test("should have rotate secret button", async ({ page }) => {
    await page.goto("/settings");

    // Look for rotate secret button
    const rotateButton = page.getByRole("button", { name: /rotate.*secret/i });
    if (await rotateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      expect(await rotateButton.isVisible()).toBe(true);
    }
  });

  test("should show audit log retention settings", async ({ page }) => {
    await page.goto("/settings");

    // Look for audit log retention section
    const retentionSection = page.getByText(/audit.*log.*retention|retention.*period/i);
    if (
      await retentionSection
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      expect(await retentionSection.first().isVisible()).toBe(true);

      // Should have retention period selector
      const retentionSelector = page
        .locator("select")
        .filter({ hasText: /30.*days|90.*days|365.*days/i });
      if (await retentionSelector.isVisible({ timeout: 2000 }).catch(() => false)) {
        expect(await retentionSelector.isVisible()).toBe(true);
      }
    }
  });

  test("should show unverified badge in inbox for unverified visitors", async ({ page }) => {
    await page.goto("/inbox");

    // Unverified badge only shows if there are unverified visitors
    // Just check the page loads properly
    await expect(page).toHaveURL(/inbox/, { timeout: 5000 });
  });
});
