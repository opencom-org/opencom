#!/usr/bin/env tsx
/**
 * Seeds curated demo content into the landing page workspace.
 *
 * Usage:
 *   pnpm seed:landing
 *   # or with explicit env vars:
 *   CONVEX_URL=https://xxx.convex.cloud WORKSPACE_ID=abc123 TEST_ADMIN_SECRET=xxx pnpm seed:landing
 *   # cleanup mode:
 *   pnpm seed:landing --cleanup
 */

import { callMutation } from "./screenshots/seed";

type ConvexHttpResponse<T> =
  | { status: "success"; value: T }
  | { status: "error"; errorMessage: string };

function isWrongWorkspaceIdError(message: string): boolean {
  return (
    message.includes('validator `v.id("workspaces")`') ||
    (message.includes("table `widgetSessions`") && message.includes("Path: .workspaceId"))
  );
}

async function validateWorkspaceId(convexUrl: string, workspaceId: string): Promise<void> {
  const res = await fetch(`${convexUrl}/api/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      path: "workspaces:get",
      args: { id: workspaceId },
      format: "json",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Workspace validation failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as ConvexHttpResponse<unknown>;

  if (json.status === "error") {
    throw new Error(json.errorMessage);
  }

  if (json.value === null) {
    throw new Error(`Workspace "${workspaceId}" was not found.`);
  }
}

async function main() {
  const convexUrl = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;

  const workspaceId = process.env.WORKSPACE_ID || process.env.NEXT_PUBLIC_WORKSPACE_ID;

  if (!convexUrl) {
    console.error(
      "Error: CONVEX_URL or NEXT_PUBLIC_CONVEX_URL must be set.\n" +
        "Example: CONVEX_URL=https://your-deployment.convex.cloud pnpm seed:landing"
    );
    process.exit(1);
  }

  if (!workspaceId) {
    console.error(
      "Error: WORKSPACE_ID must be set.\n" + "Example: WORKSPACE_ID=abc123 pnpm seed:landing"
    );
    process.exit(1);
  }

  if (!process.env.TEST_ADMIN_SECRET) {
    console.error(
      "Error: TEST_ADMIN_SECRET must be set (test data mutations are internal).\n" +
        "Set the same value as the TEST_ADMIN_SECRET env var on your Convex deployment."
    );
    process.exit(1);
  }

  try {
    await validateWorkspaceId(convexUrl, workspaceId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (isWrongWorkspaceIdError(message)) {
      console.error(
        `Error: WORKSPACE_ID (${workspaceId}) is not a valid workspaces ID.\n` +
          "It appears to be an ID from another table (for example widgetSessions).\n" +
          "Use the workspace ID from your Opencom web app settings page."
      );
      process.exit(1);
    }

    console.error(`Error validating WORKSPACE_ID (${workspaceId}): ${message}`);
    process.exit(1);
  }

  const isCleanup = process.argv.includes("--cleanup");

  if (isCleanup) {
    console.log("Cleaning up landing demo data...");
    const result = await callMutation(convexUrl, "testData:cleanupLandingDemo", {
      workspaceId,
    });
    console.log("Cleanup complete:", JSON.stringify(result, null, 2));
  } else {
    console.log("Seeding landing demo data...");
    const result = await callMutation(convexUrl, "testData:seedLandingDemo", {
      workspaceId,
    });
    console.log("Seed complete:", JSON.stringify(result, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
