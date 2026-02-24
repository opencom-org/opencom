#!/usr/bin/env tsx
/**
 * React Native SDK Example – iOS Simulator Screenshot Capture
 *
 * Launches the RN SDK example app on the iOS simulator, navigates key
 * screens (home, messenger open, help center, tickets), and captures
 * screenshots via `xcrun simctl`.
 *
 * Prerequisites:
 *   - iOS Simulator booted (or set SIMULATOR_UDID)
 *   - RN SDK example app built and installed on the simulator
 *     (npx expo run:ios from packages/react-native-sdk/example)
 *   - EXPO_PUBLIC_WORKSPACE_ID and EXPO_PUBLIC_CONVEX_URL configured
 *
 * Usage:
 *   npx tsx scripts/screenshots/capture-rn-sdk.ts
 */

import { execSync } from "child_process";
import * as path from "path";
import { ensureOutputDir, writeManifest, entry, type ScreenshotEntry } from "./manifest";

const BUNDLE_ID = "com.opencom.sdk.example";

function exec(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
  } catch (e: any) {
    throw new Error(`Command failed: ${cmd}\n${e.stderr || e.message}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getBootedSim(): string | null {
  try {
    const out = exec("xcrun simctl list devices booted -j");
    const data = JSON.parse(out);
    for (const devs of Object.values(data.devices) as Array<
      Array<{ udid: string; state: string }>
    >) {
      for (const d of devs) {
        if (d.state === "Booted") return d.udid;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function screenshot(udid: string, dir: string, name: string): Promise<string> {
  const filePath = path.join(dir, `${name}.png`);
  exec(`xcrun simctl io ${udid} screenshot "${filePath}"`);
  return filePath;
}

async function run() {
  const outDir = ensureOutputDir("rn-sdk");
  const entries: ScreenshotEntry[] = [];

  console.log("📸 RN SDK Example Screenshot Capture");
  console.log(`   Output: ${outDir}\n`);

  const udid = process.env.SIMULATOR_UDID || getBootedSim();
  if (!udid) {
    console.error("❌ No booted iOS simulator found. Boot one or set SIMULATOR_UDID.");
    process.exit(1);
  }
  console.log(`   Simulator: ${udid}`);

  // Check if the app is installed
  try {
    const apps = exec("xcrun simctl listapps " + udid);
    if (!apps.includes(BUNDLE_ID)) {
      console.error(`❌ RN SDK example app (${BUNDLE_ID}) is not installed on this simulator.`);
      console.error(
        "   Build and install it first: cd packages/react-native-sdk/example && npx expo run:ios"
      );
      process.exit(1);
    }
  } catch {
    /* listing may fail on older Xcode, try launching anyway */
  }

  try {
    // Terminate if already running, then launch
    try {
      exec(`xcrun simctl terminate ${udid} ${BUNDLE_ID}`);
    } catch {
      /* ok */
    }
    console.log("1️⃣  Launching app...");
    exec(`xcrun simctl launch ${udid} ${BUNDLE_ID}`);
    await sleep(5000);

    // Home screen
    let fp = await screenshot(udid, outDir, "rn-sdk-home");
    entries.push(entry("rn-sdk", "home", fp));
    console.log("   📷 home");

    // Note: Further interactive screenshots (opening messenger, tabs)
    // require MCP simulator tools for tap/swipe. Run the script first
    // to capture the home screen, then use MCP tools interactively
    // to navigate and capture additional screens.
    console.log("   ℹ️  Use iOS simulator MCP tools for interactive screenshots");

    // Write manifest
    const manifestPath = writeManifest(outDir, entries);
    console.log(`\n✅ Done – ${entries.length} screenshots captured`);
    console.log(`   Manifest: ${manifestPath}`);
  } catch (err) {
    console.error("❌ Error:", err);
    // Attempt to capture failure state
    await screenshot(udid, outDir, "capture-failure").catch(() => {});
    process.exit(1);
  } finally {
    try {
      exec(`xcrun simctl terminate ${udid} ${BUNDLE_ID}`);
    } catch {
      /* ok */
    }
  }
}

run();
