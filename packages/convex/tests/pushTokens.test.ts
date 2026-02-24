import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("pushTokens", () => {
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

    const user = await client.mutation(api.testing.helpers.createTestUser, {
      workspaceId: testWorkspaceId,
      email: `push-test-${Date.now()}@test.opencom.dev`,
    });
    testUserId = user.userId;
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

  it("register requires authentication", async () => {
    await expect(
      client.mutation(api.pushTokens.register, {
        token: `expo-token-${Date.now()}`,
        userId: testUserId,
        platform: "ios",
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("unregister requires authentication", async () => {
    await expect(
      client.mutation(api.pushTokens.unregister, {
        token: "non-existent-token",
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("read endpoint is empty for unauthenticated callers", async () => {
    const tokens = await client.query(api.pushTokens.getByUser, {
      userId: testUserId,
    });

    expect(tokens).toEqual([]);
  });
});
