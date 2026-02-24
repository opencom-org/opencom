import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("auth - workspace and user creation via test helpers", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testUserId: Id<"users">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);
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

  it("should create a test workspace with admin user", async () => {
    const result = await client.mutation(api.testing.helpers.createTestWorkspace, {});

    expect(result.workspaceId).toBeDefined();
    expect(result.userId).toBeDefined();

    testWorkspaceId = result.workspaceId;
    testUserId = result.userId;
  });

  it("should retrieve workspace details", async () => {
    const workspace = await client.mutation(api.testing.helpers.getTestWorkspaceFull, {
      id: testWorkspaceId,
    });

    expect(workspace).toBeDefined();
    expect(workspace?._id).toBe(testWorkspaceId);
  });

  it("should create additional users in workspace", async () => {
    const email = `additional-user-${Date.now()}@test.opencom.dev`;
    const user = await client.mutation(api.testing.helpers.createTestUser, {
      workspaceId: testWorkspaceId,
      email,
      role: "agent",
    });

    expect(user.userId).toBeDefined();
  });

  it("should list workspace members", async () => {
    const members = await client.mutation(api.testing.helpers.listTestWorkspaceMembers, {
      workspaceId: testWorkspaceId,
    });

    expect(members.length).toBeGreaterThanOrEqual(2);
    const admin = members.find((m: { userId: string }) => m.userId === testUserId);
    expect(admin).toBeDefined();
    expect(admin?.role).toBe("admin");
  });

  it("should clean up test data", async () => {
    await expect(
      client.mutation(api.testing.helpers.cleanupTestData, {
        workspaceId: testWorkspaceId,
      })
    ).resolves.not.toThrow();

    // Prevent double cleanup in afterAll
    testWorkspaceId = undefined as any;
  });
});
