import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import {
  cleanupTestData,
  createTestPushCampaign,
  createTestWorkspace,
} from "./helpers/testHelpers";

describe("pushCampaigns authorization", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testCampaignId: Id<"pushCampaigns">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    const workspace = await createTestWorkspace(client);
    testWorkspaceId = workspace.workspaceId;

    const campaign = await createTestPushCampaign(client, {
      workspaceId: testWorkspaceId,
      status: "draft",
    });
    testCampaignId = campaign.campaignId;
  });

  afterAll(async () => {
    if (testWorkspaceId) {
      try {
        await cleanupTestData(client, { workspaceId: testWorkspaceId });
      } catch (e) {
        console.warn("Cleanup failed:", e);
      }
    }
    await client.close();
  });

  it("read endpoints are blocked for unauthenticated callers", async () => {
    await expect(
      client.query(api.pushCampaigns.list, {
        workspaceId: testWorkspaceId,
      })
    ).rejects.toThrow("Not authenticated");

    await expect(client.query(api.pushCampaigns.get, { id: testCampaignId })).rejects.toThrow(
      "Not authenticated"
    );

    await expect(client.query(api.pushCampaigns.getStats, { id: testCampaignId })).rejects.toThrow(
      "Not authenticated"
    );
  });

  it("write endpoints require authentication", async () => {
    await expect(
      client.mutation(api.pushCampaigns.create, {
        workspaceId: testWorkspaceId,
        name: "Unauthorized push",
        title: "Title",
        body: "Body",
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.mutation(api.pushCampaigns.update, {
        id: testCampaignId,
        name: "Updated name",
      })
    ).rejects.toThrow("Not authenticated");

    await expect(client.mutation(api.pushCampaigns.send, { id: testCampaignId })).rejects.toThrow(
      "Not authenticated"
    );

    await expect(client.mutation(api.pushCampaigns.pause, { id: testCampaignId })).rejects.toThrow(
      "Not authenticated"
    );

    await expect(client.mutation(api.pushCampaigns.remove, { id: testCampaignId })).rejects.toThrow(
      "Not authenticated"
    );
  });
});
