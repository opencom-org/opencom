import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("conversations", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testVisitorId: Id<"visitors">;
  let testConversationId: Id<"conversations">;

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
      email: "visitor@test.com",
      name: "Test Visitor",
    });
    testVisitorId = visitor.visitorId;
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

  it("should create a conversation", async () => {
    const result = await client.mutation(api.testing.helpers.createTestConversation, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
      status: "open",
    });

    expect(result.conversationId).toBeDefined();
    testConversationId = result.conversationId;
  });

  it("should list conversations for workspace", async () => {
    const conversations = await client.mutation(api.testing.helpers.listTestConversations, {
      workspaceId: testWorkspaceId,
    });

    expect(conversations).toBeDefined();
    expect(conversations.length).toBeGreaterThan(0);
  });

  it("should get a conversation by id", async () => {
    const conversation = await client.mutation(api.testing.helpers.getTestConversation, {
      id: testConversationId,
    });

    expect(conversation).toBeDefined();
    expect(conversation?._id).toBe(testConversationId);
    expect(conversation?.status).toBe("open");
  });

  it("should update conversation status to closed", async () => {
    await client.mutation(api.testing.helpers.updateTestConversationStatus, {
      id: testConversationId,
      status: "closed",
    });

    const conversation = await client.mutation(api.testing.helpers.getTestConversation, {
      id: testConversationId,
    });

    expect(conversation?.status).toBe("closed");
  });

  it("should update conversation status to snoozed", async () => {
    await client.mutation(api.testing.helpers.updateTestConversationStatus, {
      id: testConversationId,
      status: "snoozed",
    });

    const conversation = await client.mutation(api.testing.helpers.getTestConversation, {
      id: testConversationId,
    });

    expect(conversation?.status).toBe("snoozed");
  });

  it("should filter conversations by status", async () => {
    const snoozedConversations = await client.mutation(api.testing.helpers.listTestConversations, {
      workspaceId: testWorkspaceId,
      status: "snoozed",
    });

    expect(snoozedConversations.some((c: { _id: string }) => c._id === testConversationId)).toBe(
      true
    );
  });
});
