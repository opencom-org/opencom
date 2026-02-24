import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("automation", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testUserId: Id<"users">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    const workspace = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    testWorkspaceId = workspace.workspaceId;
    testUserId = workspace.userId;
  });

  afterAll(async () => {
    if (testWorkspaceId) {
      try {
        await client.mutation(api.testing.helpers.cleanupTestData, {
          workspaceId: testWorkspaceId,
        });
      } catch (e) {
        console.warn("Cleanup failed:", e);
      }
    }
    await client.close();
  });

  it("automation settings reads are hidden from unauthenticated callers", async () => {
    const settings = await client.query(api.automationSettings.get, {
      workspaceId: testWorkspaceId,
    });

    expect(settings).toBeNull();
  });

  it("automation settings writes require authentication", async () => {
    await expect(
      client.mutation(api.automationSettings.upsert, {
        workspaceId: testWorkspaceId,
        suggestArticlesEnabled: true,
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("tag management is protected", async () => {
    const tags = await client.query(api.tags.list, {
      workspaceId: testWorkspaceId,
    });
    expect(tags).toEqual([]);

    await expect(
      client.mutation(api.tags.create, {
        workspaceId: testWorkspaceId,
        name: "Bug",
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("office hours public reads still return defaults", async () => {
    const officeHours = await client.query(api.officeHours.getOrDefault, {
      workspaceId: testWorkspaceId,
    });

    expect(officeHours.schedule).toHaveLength(7);
    expect(officeHours.timezone).toBe("America/New_York");
  });

  it("office hours writes require authentication", async () => {
    await expect(
      client.mutation(api.officeHours.upsert, {
        workspaceId: testWorkspaceId,
        timezone: "America/Los_Angeles",
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("assignment rule management is protected", async () => {
    const rules = await client.query(api.assignmentRules.list, {
      workspaceId: testWorkspaceId,
    });
    expect(rules).toEqual([]);

    await expect(
      client.mutation(api.assignmentRules.create, {
        workspaceId: testWorkspaceId,
        name: "VIP Customers",
        priority: 0,
        enabled: true,
        conditions: [
          {
            field: "visitor.email",
            operator: "contains",
            value: "@enterprise.com",
          },
        ],
        action: {
          type: "assign_user",
          userId: testUserId,
        },
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("common issue button admin endpoints are protected", async () => {
    const publicButtons = await client.query(api.commonIssueButtons.list, {
      workspaceId: testWorkspaceId,
    });
    expect(Array.isArray(publicButtons)).toBe(true);

    const adminButtons = await client.query(api.commonIssueButtons.listAll, {
      workspaceId: testWorkspaceId,
    });
    expect(adminButtons).toEqual([]);

    await expect(
      client.mutation(api.commonIssueButtons.create, {
        workspaceId: testWorkspaceId,
        label: "Need help",
        action: "start_conversation",
        conversationStarter: "Can you help me?",
        enabled: true,
      })
    ).rejects.toThrow("Not authenticated");
  });
});
