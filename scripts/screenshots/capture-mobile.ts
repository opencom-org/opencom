#!/usr/bin/env tsx
/**
 * Mobile Admin App – iOS Simulator Screenshot Capture
 *
 * Launches the Opencom mobile admin app on the iOS simulator, navigates
 * key screens (inbox, settings, conversation), and captures screenshots
 * via `xcrun simctl`.
 *
 * Prerequisites:
 *   - iOS Simulator booted (or set SIMULATOR_UDID)
 *   - Mobile admin app built and installed on the simulator
 *     (npx expo run:ios from apps/mobile)
 *   - User logged in or app configured with demo identity
 *
 * Usage:
 *   npx tsx scripts/screenshots/capture-mobile.ts
 */

import { execSync } from "child_process";
import * as path from "path";
import { ensureOutputDir, writeManifest, entry, type ScreenshotEntry } from "./manifest";

const BUNDLE_ID = "com.opencom.app";

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
  const outDir = ensureOutputDir("mobile");
  const entries: ScreenshotEntry[] = [];

  console.log("📸 Mobile Admin App Screenshot Capture");
  console.log(`   Output: ${outDir}\n`);

  const udid = process.env.SIMULATOR_UDID || getBootedSim();
  if (!udid) {
    console.error("❌ No booted iOS simulator found. Boot one or set SIMULATOR_UDID.");
    process.exit(1);
  }
  console.log(`   Simulator: ${udid}`);

  // Check if the app is installed
  try {
    const apps = exec(`xcrun simctl listapps ${udid}`);
    if (!apps.includes(BUNDLE_ID)) {
      console.error(`❌ Mobile admin app (${BUNDLE_ID}) is not installed on this simulator.`);
      console.error("   Build and install it first: cd apps/mobile && npx expo run:ios");
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

    // Inbox / home screen
    let fp = await screenshot(udid, outDir, "mobile-inbox");
    entries.push(entry("mobile", "inbox", fp));
    console.log("   📷 inbox");

    // Note: Further interactive screenshots (settings, conversation)
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
