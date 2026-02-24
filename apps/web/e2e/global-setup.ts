/**
 * Playwright global setup - runs before all E2E tests.
 *
 * Creates a fresh test workspace by signing up a new user.
 * This ensures tests are isolated and don't affect existing data.
 */

import { chromium, FullConfig, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { resolveE2EBackendUrl } from "./helpers/e2e-env";

const BACKEND_URL = resolveE2EBackendUrl();
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// Generate unique test credentials
const TEST_RUN_ID = Date.now();
const TEST_EMAIL = `e2e_test_${TEST_RUN_ID}@opencom.dev`;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || "TestPassword123!";
const TEST_NAME = "E2E Test User";
const TEST_WORKSPACE_NAME = `E2E Test Workspace ${TEST_RUN_ID}`;

// Path to store test state for sharing between setup/tests/teardown
const STATE_FILE = path.join(__dirname, ".e2e-state.json");

export interface E2ETestState {
  testRunId: number;
  email: string;
  workspaceName: string;
  workspaceId?: string;
  userId?: string;
  authStoragePath: string;
}

async function globalSetup(_config: FullConfig) {
  console.log("\n🚀 Setting up E2E test environment...");
  console.log(`   Test Run ID: ${TEST_RUN_ID}`);
  console.log("   Test account: [redacted]");

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to signup page
    console.log("   📝 Creating test workspace via signup...");
    await page.goto(`${BASE_URL}/signup`);

    // Wait for page to load - longer wait for production build
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Check if we need to connect to backend first (only in dev mode)
    const backendInput = page.getByLabel(/backend url/i);
    if (await backendInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await backendInput.fill(BACKEND_URL);
      await page.getByRole("button", { name: /connect/i }).click();
      await page.waitForTimeout(3000);
    }

    // Check if we need to switch to password signup (magic code is default now)
    const passwordSignupButton = page.getByRole("button", { name: /sign up with password/i });
    if (await passwordSignupButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await passwordSignupButton.click();
      await page.waitForTimeout(1500);
    }

    // Fill signup form - wait for form to be ready
    await page.waitForTimeout(1000);
    const nameInput = page.getByLabel("Name", { exact: true });
    await expect(nameInput).toBeVisible({ timeout: 10000 });
    await nameInput.fill(TEST_NAME);
    await page.getByLabel("Email", { exact: true }).fill(TEST_EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);

    // Fill workspace name if the field exists
    const workspaceField = page.getByLabel(/workspace name/i);
    if (await workspaceField.isVisible({ timeout: 1000 }).catch(() => false)) {
      await workspaceField.fill(TEST_WORKSPACE_NAME);
    }

    // Submit signup
    await page.getByRole("button", { name: /create account|sign up/i }).click();

    // Wait for redirect to an authenticated route (new accounts can land on onboarding first)
    await page.waitForURL(/onboarding|inbox|dashboard/, { timeout: 30000 });
    console.log("   ✅ Test workspace created successfully");

    // Wait a moment for localStorage to be populated
    await page.waitForTimeout(1000);

    // Extract workspace ID from localStorage (stored by AuthContext)
    const workspaceId = await page.evaluate(() => {
      const stored = localStorage.getItem("opencom_active_workspace");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return parsed._id;
        } catch {
          return null;
        }
      }
      return null;
    });

    if (workspaceId) {
      console.log(`   📦 Workspace ID: ${workspaceId}`);
    } else {
      console.log("   ⚠️ Could not extract workspace ID from localStorage");
    }

    // Save authentication state
    const authStoragePath = path.join(__dirname, ".auth-state.json");
    await context.storageState({ path: authStoragePath });
    console.log("   💾 Auth state saved");

    // Save test state for tests and teardown
    const testState: E2ETestState = {
      testRunId: TEST_RUN_ID,
      email: TEST_EMAIL,
      workspaceName: TEST_WORKSPACE_NAME,
      workspaceId,
      authStoragePath,
    };

    fs.writeFileSync(STATE_FILE, JSON.stringify(testState, null, 2), { mode: 0o600 });
    console.log("   📄 Test state saved to", STATE_FILE);
  } catch (error) {
    console.error("   ❌ Setup failed:", error);

    // Save screenshot for debugging
    const screenshotPath = path.join(__dirname, "setup-failure.png");
    await page.screenshot({ path: screenshotPath });
    console.log(`   📸 Screenshot saved to ${screenshotPath}`);

    throw error;
  } finally {
    await browser.close();
  }

  console.log("   🎉 Setup complete!\n");
}

export default globalSetup;

// Export helpers for tests to use
export function getTestState(): E2ETestState | null {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch {
    // Ignore errors
  }
  return null;
}
