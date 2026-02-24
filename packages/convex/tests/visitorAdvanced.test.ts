import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";

describe("visitors - advanced", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);
    testWorkspaceId = (await authenticateClientForWorkspace(client)).workspaceId;
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

  it("should update location for visitor", async () => {
    const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
    });

    await client.mutation(api.visitors.updateLocation, {
      visitorId: visitor.visitorId,
      location: {
        city: "New York",
        country: "United States",
      },
    });

    const updated = await client.mutation(api.testing.helpers.getTestVisitor, {
      id: visitor.visitorId,
    });

    expect(updated?.location?.city).toBe("New York");
  });

  it("should merge visitors when identifying with existing email", async () => {
    const email = `merge-test-${Date.now()}@test.com`;

    // Create first visitor with email
    const visitor1 = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
      email,
      name: "Original Visitor",
    });

    // Create a conversation for visitor1
    await client.mutation(api.testing.helpers.createTestConversation, {
      workspaceId: testWorkspaceId,
      visitorId: visitor1.visitorId,
    });

    // Create second visitor without email
    const visitor2 = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
    });

    // Identify visitor2 with same email - should merge into visitor1
    const merged = await client.mutation(api.visitors.identify, {
      visitorId: visitor2.visitorId,
      email,
      name: "Updated Name",
    });

    // The merged visitor should be visitor1
    expect(merged?._id).toBe(visitor1.visitorId);
    expect(merged?.name).toBe("Updated Name");

    // Visitor2 should be deleted
    const deletedVisitor = await client.mutation(api.testing.helpers.getTestVisitor, {
      id: visitor2.visitorId,
    });
    expect(deletedVisitor).toBeNull();
  });

  it("should identify visitor and merge custom attributes", async () => {
    const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
    });

    await client.mutation(api.visitors.identify, {
      visitorId: visitor.visitorId,
      customAttributes: {
        plan: "pro",
        feature2: true,
      },
    });

    const updated = await client.mutation(api.testing.helpers.getTestVisitor, {
      id: visitor.visitorId,
    });

    expect(updated?.customAttributes?.plan).toBe("pro");
    expect(updated?.customAttributes?.feature2).toBe(true);
  });

  it("should track firstSeenAt and lastSeenAt", async () => {
    const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
    });

    const initial = await client.mutation(api.testing.helpers.getTestVisitor, {
      id: visitor.visitorId,
    });

    const firstSeenAt = initial?.firstSeenAt;
    const initialLastSeenAt = initial?.lastSeenAt;

    expect(firstSeenAt).toBeDefined();
    expect(initialLastSeenAt).toBeDefined();

    // Wait a bit and update
    await new Promise((resolve) => setTimeout(resolve, 10));

    await client.mutation(api.visitors.heartbeat, {
      visitorId: visitor.visitorId,
    });

    const updated = await client.mutation(api.testing.helpers.getTestVisitor, {
      id: visitor.visitorId,
    });

    expect(updated?.firstSeenAt).toBe(firstSeenAt);
    expect(updated?.lastSeenAt).toBeGreaterThan(initialLastSeenAt!);
  });
});
