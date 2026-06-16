import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

describe("Automation Credentials", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    const workspace = await client.mutation(api.testing_helpers.createTestWorkspace, {});
    testWorkspaceId = workspace.workspaceId;
  });

  afterAll(async () => {
    if (testWorkspaceId) {
      try {
        await client.mutation(api.testing_helpers.cleanupTestData, {
          workspaceId: testWorkspaceId,
        });
      } catch (e) {
        console.warn("Cleanup failed:", e);
      }
    }
    await client.close();
  });

  it("credential management requires authentication", async () => {
    await expect(
      client.query(api.automationCredentials.list, {
        workspaceId: testWorkspaceId,
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.mutation(api.automationCredentials.create, {
        workspaceId: testWorkspaceId,
        name: "Test Key",
        scopes: ["conversations.read"],
        actorName: "Test Bot",
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("webhook subscription management requires authentication", async () => {
    await expect(
      client.query(api.automationWebhooks.listSubscriptions, {
        workspaceId: testWorkspaceId,
      })
    ).rejects.toThrow("Not authenticated");
  });
});
