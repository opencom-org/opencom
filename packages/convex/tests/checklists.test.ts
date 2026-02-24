import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("checklists", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testVisitorId: Id<"visitors">;
  let testSessionToken: string;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    const workspace = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    testWorkspaceId = workspace.workspaceId;

    const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
    });
    testVisitorId = visitor.visitorId;

    const session = await client.mutation(api.testing.helpers.createTestSessionToken, {
      visitorId: testVisitorId,
      workspaceId: testWorkspaceId,
    });
    testSessionToken = session.sessionToken;
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

  it("admin checklist list endpoint is empty for unauthenticated callers", async () => {
    const checklists = await client.query(api.checklists.list, {
      workspaceId: testWorkspaceId,
    });

    expect(checklists).toEqual([]);
  });

  it("admin checklist create endpoint requires authentication", async () => {
    await expect(
      client.mutation(api.checklists.create, {
        workspaceId: testWorkspaceId,
        name: "Getting Started",
        tasks: [
          {
            id: `task-${Date.now()}`,
            title: "Complete profile",
            completionType: "manual",
          },
        ],
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("visitor progress endpoints reject without session token", async () => {
    await expect(
      client.query(api.checklists.getAllProgress, {
        visitorId: testVisitorId,
        workspaceId: testWorkspaceId,
      })
    ).rejects.toThrow("Session token required");

    await expect(
      client.query(api.checklists.getEligible, {
        workspaceId: testWorkspaceId,
        visitorId: testVisitorId,
      })
    ).rejects.toThrow("Session token required");
  });

  it("visitor progress endpoints allow session-bound reads", async () => {
    const allProgress = await client.query(api.checklists.getAllProgress, {
      visitorId: testVisitorId,
      sessionToken: testSessionToken,
      workspaceId: testWorkspaceId,
    });

    expect(allProgress).toEqual([]);

    const eligible = await client.query(api.checklists.getEligible, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
      sessionToken: testSessionToken,
    });

    expect(eligible).toEqual([]);
  });
});
