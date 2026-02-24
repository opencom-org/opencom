#!/usr/bin/env npx tsx
/**
 * Script to clean up E2E test data from the Convex database.
 *
 * Usage:
 *   pnpm cleanup:e2e
 *
 * Or directly from packages/convex:
 *   npx tsx scripts/cleanup-e2e-data.ts
 */

import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL = process.env.CONVEX_URL;

async function main() {
  console.log(`Connecting to Convex at ${CONVEX_URL}...`);

  const client = new ConvexClient(CONVEX_URL);

  console.log("Cleaning up E2E test data...");

  try {
    const result = await client.mutation(api.testing.helpers.cleanupE2ETestData, {});

    console.log("\n✅ E2E test data cleanup complete!");
    console.log("\nDeleted:");
    console.log(`  - Users: ${result.deleted.users}`);
    console.log(`  - Workspaces: ${result.deleted.workspaces}`);
    console.log(`  - Conversations: ${result.deleted.conversations}`);
    console.log(`  - Messages: ${result.deleted.messages}`);
    console.log(`  - Visitors: ${result.deleted.visitors}`);
    console.log(`  - Members: ${result.deleted.members}`);
    console.log(`  - Sessions: ${result.deleted.sessions}`);
    console.log(`  - Invitations: ${result.deleted.invitations}`);

    await client.close();
  } catch (error) {
    console.error("❌ Cleanup failed:", error);
    await client.close();
    process.exit(1);
  }
}

main();
