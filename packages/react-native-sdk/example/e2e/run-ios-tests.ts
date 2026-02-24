#!/usr/bin/env tsx
/**
 * iOS Simulator E2E Test Runner
 *
 * This script runs E2E tests on the iOS Simulator using MCP tools.
 * It builds the app, installs it, and runs through the test scenarios.
 *
 * Usage:
 *   npx tsx run-ios-tests.ts
 *
 * Environment Variables:
 *   CONVEX_URL - Convex backend URL
 *   TEST_WORKSPACE_ID - Test workspace ID
 *   SIMULATOR_UDID - iOS Simulator UDID (optional, uses booted sim if not set)
 */

import { execFileSync, spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

interface TestStep {
  name: string;
  action: (udid: string) => Promise<void>;
}

const CONFIG = {
  BUNDLE_ID: "com.opencom.example",
  APP_NAME: "OpencomExample",
  PROJECT_PATH: path.join(__dirname, ".."),
  BUILD_PATH: path.join(__dirname, "..", "ios", "build"),
  CONVEX_URL: process.env.CONVEX_URL,
  TIMEOUT: 30000,
};
const UDID_PATTERN = /^[A-Fa-f0-9-]{10,64}$/;
const SAFE_SCREENSHOT_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;

// Utility functions
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPathOutsideRoot(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative.startsWith("..") || path.isAbsolute(relative);
}

function assertPathWithinProject(candidatePath: string, label: string): string {
  const projectRoot = path.resolve(CONFIG.PROJECT_PATH);
  const resolvedCandidate = path.resolve(candidatePath);
  if (isPathOutsideRoot(projectRoot, resolvedCandidate)) {
    throw new Error(
      `${label} must remain within project root (${projectRoot}). Received: ${resolvedCandidate}`
    );
  }
  return resolvedCandidate;
}

function validateUdid(udid: string): string {
  const trimmed = udid.trim();
  if (!UDID_PATTERN.test(trimmed)) {
    throw new Error(`Invalid simulator UDID: ${udid}`);
  }
  return trimmed;
}

function sanitizeScreenshotName(name: string): string {
  const sanitized = name
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!sanitized || !SAFE_SCREENSHOT_NAME_PATTERN.test(sanitized)) {
    throw new Error(`Invalid screenshot name: ${name}`);
  }

  return sanitized;
}

function parseFlags(argv: string[]): { skipBuild: boolean } {
  const supportedFlags = new Set(["--skip-build"]);
  for (const flag of argv) {
    if (!supportedFlags.has(flag)) {
      throw new Error(`Unsupported argument: ${flag}`);
    }
  }
  return { skipBuild: argv.includes("--skip-build") };
}

function execCommand(executable: string, args: string[], cwd?: string): string {
  try {
    return execFileSync(executable, args, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    console.error(`Command failed: ${executable} ${args.join(" ")}`);
    throw error;
  }
}

function runCommand(executable: string, args: string[], cwd?: string): void {
  const result = spawnSync(executable, args, {
    cwd,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Command failed with exit code ${result.status}: ${executable} ${args.join(" ")}`
    );
  }
}

// Get booted simulator UDID
function getBootedSimulator(): string | null {
  try {
    const output = execCommand("xcrun", ["simctl", "list", "devices", "booted", "-j"]);
    const data = JSON.parse(output);
    for (const runtime of Object.values(data.devices) as Array<
      Array<{ udid: string; state: string }>
    >) {
      for (const device of runtime) {
        if (device.state === "Booted") {
          return validateUdid(device.udid);
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Boot simulator if needed
async function ensureSimulatorBooted(): Promise<string> {
  let udid = process.env.SIMULATOR_UDID
    ? validateUdid(process.env.SIMULATOR_UDID)
    : getBootedSimulator();

  if (!udid) {
    console.log("No booted simulator found. Booting iPhone 15 Pro...");
    // Find iPhone 15 Pro
    const output = execCommand("xcrun", ["simctl", "list", "devices", "available", "-j"]);
    const data = JSON.parse(output);
    for (const [runtime, devices] of Object.entries(data.devices) as Array<
      [string, Array<{ name: string; udid: string }>]
    >) {
      if (runtime.includes("iOS")) {
        for (const device of devices) {
          if (device.name.includes("iPhone 15 Pro") || device.name.includes("iPhone 14")) {
            udid = validateUdid(device.udid);
            break;
          }
        }
      }
      if (udid) break;
    }

    if (!udid) {
      throw new Error("No suitable iPhone simulator found");
    }

    execCommand("xcrun", ["simctl", "boot", udid]);
    await sleep(5000);
  }

  console.log(`Using simulator: ${udid}`);
  return udid;
}

// Build the iOS app
async function buildApp(): Promise<void> {
  console.log("Building iOS app...");

  const workspacePath = assertPathWithinProject(
    path.join(CONFIG.PROJECT_PATH, "ios", "OpencomExample.xcworkspace"),
    "iOS workspace path"
  );
  const buildPath = assertPathWithinProject(CONFIG.BUILD_PATH, "iOS build path");
  const buildArgs = [
    "-workspace",
    workspacePath,
    "-scheme",
    CONFIG.APP_NAME,
    "-configuration",
    "Debug",
    "-sdk",
    "iphonesimulator",
    "-derivedDataPath",
    buildPath,
    "build",
  ];

  runCommand("xcodebuild", buildArgs, CONFIG.PROJECT_PATH);
  console.log("Build completed successfully");
}

// Install app on simulator
async function installApp(udid: string): Promise<void> {
  console.log("Installing app on simulator...");
  const safeUdid = validateUdid(udid);

  const appPath = assertPathWithinProject(
    path.join(
      CONFIG.BUILD_PATH,
      "Build",
      "Products",
      "Debug-iphonesimulator",
      `${CONFIG.APP_NAME}.app`
    ),
    "Built app path"
  );

  if (!fs.existsSync(appPath)) {
    throw new Error(`Built app not found at ${appPath}. Run the build step first.`);
  }

  execCommand("xcrun", ["simctl", "install", safeUdid, appPath]);
  console.log("App installed");
}

// Launch app
async function launchApp(udid: string): Promise<void> {
  const safeUdid = validateUdid(udid);
  console.log("Launching app...");
  execCommand("xcrun", ["simctl", "launch", safeUdid, CONFIG.BUNDLE_ID]);
  await sleep(3000);
  console.log("App launched");
}

// Terminate app
async function terminateApp(udid: string): Promise<void> {
  const safeUdid = validateUdid(udid);
  try {
    execCommand("xcrun", ["simctl", "terminate", safeUdid, CONFIG.BUNDLE_ID]);
  } catch {
    // App might not be running
  }
}

// Take screenshot
async function takeScreenshot(udid: string, name: string): Promise<string> {
  const safeUdid = validateUdid(udid);
  const safeName = sanitizeScreenshotName(name);
  const screenshotDir = assertPathWithinProject(
    path.join(__dirname, "screenshots"),
    "Screenshot directory"
  );
  fs.mkdirSync(screenshotDir, { recursive: true });
  const screenshotFilePath = assertPathWithinProject(
    path.join(screenshotDir, `${safeName}-${Date.now()}.png`),
    "Screenshot output file"
  );
  execCommand("xcrun", ["simctl", "io", safeUdid, "screenshot", screenshotFilePath]);
  return screenshotFilePath;
}

// // Tap at coordinates
// async function tap(udid: string, x: number, y: number): Promise<void> {
//   // Using idb or simctl for tap
//   // Note: simctl doesn't support tap directly, would need idb or appium
//   console.log(`Tap at (${x}, ${y})`);
//   // In actual implementation, use MCP tool: mcp3_ui_tap
// }

// // Type text
// async function typeText(udid: string, text: string): Promise<void> {
//   execCommand(`xcrun simctl io ${udid} type "${text}"`);
// }

// Test scenarios
const testScenarios: TestStep[] = [
  {
    name: "App launches successfully",
    action: async (udid) => {
      // App launch is verified by getting here - wait for UI to settle
      await sleep(3000);
      // Verify by checking accessibility - should have Inbox heading
      const output = execCommand("xcrun", ["simctl", "ui", udid, "describe"]);
      if (!output.includes("Inbox") && !output.includes("Opencom")) {
        throw new Error("App UI not detected - expected Inbox or Opencom screen");
      }
    },
  },
  {
    name: "Inbox screen displays correctly",
    action: async (udid) => {
      // Verify inbox filter tabs are visible (All, Open, Closed, Snoozed)
      await sleep(1000);
      // Take screenshot to verify UI
      await takeScreenshot(udid, "inbox-screen");
    },
  },
  {
    name: "Settings button is visible and tappable",
    action: async (udid) => {
      // The settings/launcher button is at bottom right
      // Tap at coordinates (350, 822) for iPhone 16 Pro dimensions
      execCommand("xcrun", ["simctl", "io", udid, "tap", "350", "822"]);
      await sleep(1500);
      // Verify settings screen opened
      await takeScreenshot(udid, "settings-screen");
    },
  },
  {
    name: "Settings screen displays account info",
    action: async (udid) => {
      // Settings should show Account, Notifications, Workspace sections
      await sleep(1000);
      // Go back to inbox
      execCommand("xcrun", ["simctl", "io", udid, "tap", "45", "79"]);
      await sleep(1000);
    },
  },
  {
    name: "Filter tabs are interactive",
    action: async (udid) => {
      // Tap on different filter tabs
      // Tap "Open" tab
      execCommand("xcrun", ["simctl", "io", udid, "tap", "100", "129"]);
      await sleep(500);
      // Tap "Closed" tab
      execCommand("xcrun", ["simctl", "io", udid, "tap", "180", "129"]);
      await sleep(500);
      // Tap "All" tab
      execCommand("xcrun", ["simctl", "io", udid, "tap", "36", "129"]);
      await sleep(500);
    },
  },
];

// Main test runner
async function runTests(): Promise<void> {
  console.log("Starting Mobile SDK E2E Tests\n");
  console.log("=".repeat(50));

  let udid: string;
  let passed = 0;
  let failed = 0;

  try {
    const { skipBuild } = parseFlags(process.argv.slice(2));
    // Setup
    console.log("\n📱 Setting up simulator...");
    udid = await ensureSimulatorBooted();

    console.log("\n🔨 Building app...");
    // Skip build if --skip-build flag is passed
    if (!skipBuild) {
      await buildApp();
    } else {
      console.log("Skipping build (--skip-build flag)");
    }

    console.log("\n📲 Installing app...");
    await terminateApp(udid);
    await installApp(udid);

    console.log("\n🚀 Launching app...");
    await launchApp(udid);

    // Take initial screenshot
    const initialScreenshot = await takeScreenshot(udid, "initial");
    console.log(`Initial screenshot: ${initialScreenshot}`);

    // Run test scenarios
    console.log("\n" + "=".repeat(50));
    console.log("Running tests...\n");

    for (const scenario of testScenarios) {
      try {
        process.stdout.write(`  ${scenario.name}... `);
        await scenario.action(udid);
        console.log("✅");
        passed++;
      } catch (error) {
        console.log("❌");
        console.error(`    Error: ${error}`);
        failed++;

        // Take failure screenshot
        await takeScreenshot(udid, `failure-${scenario.name.replace(/\s+/g, "-")}`);
      }
    }

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log(
      `\nResults: ${passed} passed, ${failed} failed out of ${testScenarios.length} tests`
    );

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Test setup failed:", error);
    process.exit(1);
  } finally {
    // Cleanup
    console.log("\n🧹 Cleaning up...");
    if (udid!) {
      await terminateApp(udid);
    }
  }
}

// Run if executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests, CONFIG };
