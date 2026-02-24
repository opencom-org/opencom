import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("visitors", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testVisitorId: Id<"visitors">;
  let testSessionId: string;

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

  it("should create a visitor via test helper", async () => {
    const result = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
      email: "visitor@example.com",
      name: "Test Visitor",
    });

    expect(result).toBeDefined();
    expect(result.visitorId).toBeDefined();
    testVisitorId = result.visitorId;
    testSessionId = result.sessionId;
  });

  it("should get visitor by session id", async () => {
    const visitor = await client.query(api.visitors.getBySession, {
      sessionId: testSessionId,
    });

    expect(visitor).toBeDefined();
    expect(visitor?._id).toBe(testVisitorId);
    expect(visitor?.email).toBe("visitor@example.com");
  });

  it("should identify visitor with updated info", async () => {
    await client.mutation(api.visitors.identify, {
      visitorId: testVisitorId,
      name: "Updated Visitor Name",
      email: "updated@example.com",
    });

    const visitor = await client.query(api.visitors.getBySession, {
      sessionId: testSessionId,
    });

    expect(visitor?.name).toBe("Updated Visitor Name");
    expect(visitor?.email).toBe("updated@example.com");
  });

  it("should get visitor by id", async () => {
    const visitor = await client.mutation(api.testing.helpers.getTestVisitor, {
      id: testVisitorId,
    });

    expect(visitor).toBeDefined();
    expect(visitor?._id).toBe(testVisitorId);
  });

  it("should update visitor heartbeat", async () => {
    const beforeUpdate = await client.mutation(api.testing.helpers.getTestVisitor, {
      id: testVisitorId,
    });

    await client.mutation(api.visitors.heartbeat, {
      visitorId: testVisitorId,
    });

    const afterUpdate = await client.mutation(api.testing.helpers.getTestVisitor, {
      id: testVisitorId,
    });

    expect(afterUpdate?.lastSeenAt).toBeGreaterThanOrEqual(beforeUpdate?.lastSeenAt || 0);
  });

  it("should check if visitor is online", async () => {
    await client.mutation(api.visitors.heartbeat, {
      visitorId: testVisitorId,
    });

    const isOnline = await client.query(api.visitors.isOnline, {
      visitorId: testVisitorId,
    });

    expect(isOnline).toBe(true);
  });
});
