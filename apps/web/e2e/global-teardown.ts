/**
 * Playwright global teardown - runs after all E2E tests.
 *
 * Cleans up the test workspace created during setup.
 * Deletes all test data and the workspace itself.
 */

import * as fs from "fs";
import * as path from "path";
import { readTestStateFromPath, type E2ETestState } from "./helpers/test-state";
import { resolveE2EBackendUrl } from "./helpers/e2e-env";

const BACKEND_URL = resolveE2EBackendUrl();
const STATE_FILE = path.join(__dirname, ".e2e-state.json");

async function globalTeardown() {
  console.log("\n🧹 Cleaning up E2E test environment...");

  // Legacy shared state file may not exist when using worker-scoped auth fixtures.
  const testState: E2ETestState | null = readTestStateFromPath(STATE_FILE);
  if (testState) {
    console.log(`   Test Run ID: ${testState.testRunId}`);
    console.log("   Test account: [redacted]");
  } else {
    console.log(
      "   ℹ️ Shared test state not found; continuing cleanup via test email domain match"
    );
  }

  const adminSecret = process.env.TEST_ADMIN_SECRET;
  if (!adminSecret) {
    console.warn("   ⚠️ TEST_ADMIN_SECRET not set, skipping cleanup");
    return;
  }

  try {
    // Clean up all E2E test data (workspaces, users, etc. with e2e_test_ prefix)
    console.log("   🗑️ Deleting test data...");
    const res = await fetch(`${BACKEND_URL}/api/action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: "testAdmin:runTestMutation",
        args: {
          secret: adminSecret,
          name: "testing/helpers:cleanupE2ETestData",
          mutationArgs: {},
        },
        format: "json",
      }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }

    const json = await res.json();
    const result = json.status === "success" ? json.value : json;

    const total = Object.values(result.deleted).reduce(
      (sum: number, val) => sum + (val as number),
      0
    );
    if (total > 0) {
      console.log(`   ✅ Cleaned up ${total} test records`);
      console.log("   Breakdown:", result.deleted);
    } else {
      console.log("   ℹ️ No test data to clean up");
    }
  } catch (error) {
    console.warn("   ⚠️ Cleanup failed (non-fatal):", error);
  }

  // Clean up state files
  try {
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
      console.log("   🗑️ Removed state file");
    }

    // Note: We intentionally do NOT delete the auth state file here
    // because it may be needed by other test workers. The auth state
    // file will be automatically overwritten on the next test run.
  } catch (error) {
    console.warn("   ⚠️ Could not clean up state files:", error);
  }

  console.log("   🎉 Teardown complete!\n");
}

export default globalTeardown;
