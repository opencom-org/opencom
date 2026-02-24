import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("segments", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    const workspace = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    testWorkspaceId = workspace.workspaceId;
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

  it("segment list is empty for unauthenticated callers", async () => {
    const segments = await client.query(api.segments.list, {
      workspaceId: testWorkspaceId,
    });

    expect(segments).toEqual([]);
  });

  it("segment creation requires authentication", async () => {
    await expect(
      client.mutation(api.segments.create, {
        workspaceId: testWorkspaceId,
        name: "Pro Users",
        audienceRules: {
          type: "group",
          operator: "and",
          conditions: [
            {
              type: "condition",
              property: { source: "system", key: "email" },
              operator: "contains",
              value: "@example.com",
            },
          ],
        },
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("segment preview returns zero for unauthenticated callers", async () => {
    const preview = await client.query(api.segments.preview, {
      workspaceId: testWorkspaceId,
      audienceRules: {
        type: "group",
        operator: "and",
        conditions: [
          {
            type: "condition",
            property: { source: "system", key: "email" },
            operator: "contains",
            value: "@example.com",
          },
        ],
      },
    });

    expect(preview).toBe(0);
  });
});
