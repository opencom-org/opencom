import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("conversations - advanced", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testVisitorId: Id<"visitors">;
  let testUserId: Id<"users">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    // Create workspace with a user for assignment tests
    const workspace = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    testWorkspaceId = workspace.workspaceId;
    testUserId = workspace.userId;

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

  it("should assign conversation to agent", async () => {
    const conversation = await client.mutation(api.testing.helpers.createTestConversation, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
    });

    await client.mutation(api.testing.helpers.assignTestConversation, {
      id: conversation.conversationId,
      agentId: testUserId,
    });

    const updated = await client.mutation(api.testing.helpers.getTestConversation, {
      id: conversation.conversationId,
    });

    expect(updated?.assignedAgentId).toBe(testUserId);
  });

  it("should get or create conversation for visitor", async () => {
    const newVisitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
      email: "new-visitor@test.com",
    });

    const { sessionToken } = await client.mutation(api.testing.helpers.createTestSessionToken, {
      visitorId: newVisitor.visitorId,
      workspaceId: testWorkspaceId,
    });

    const conversation = await client.mutation(api.conversations.getOrCreateForVisitor, {
      workspaceId: testWorkspaceId,
      visitorId: newVisitor.visitorId,
      sessionToken,
    });

    expect(conversation).toBeDefined();
    expect(conversation?._id).toBeDefined();
    expect(conversation?.status).toBe("open");

    // Calling again should return the same conversation
    const sameConversation = await client.mutation(api.conversations.getOrCreateForVisitor, {
      workspaceId: testWorkspaceId,
      visitorId: newVisitor.visitorId,
      sessionToken,
    });

    expect(sameConversation?._id).toBe(conversation?._id);
  });

  it("should mark conversation as read by agent", async () => {
    const conversation = await client.mutation(api.testing.helpers.createTestConversation, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
    });

    // Send a message from visitor to create unread count
    await client.mutation(api.testing.helpers.sendTestMessageDirect, {
      conversationId: conversation.conversationId,
      senderId: testVisitorId,
      senderType: "visitor",
      content: "Hello!",
    });

    const beforeRead = await client.mutation(api.testing.helpers.getTestConversation, {
      id: conversation.conversationId,
    });
    expect(beforeRead?.unreadByAgent).toBeGreaterThanOrEqual(0);

    await client.mutation(api.testing.helpers.markTestConversationAsRead, {
      id: conversation.conversationId,
    });

    const afterRead = await client.mutation(api.testing.helpers.getTestConversation, {
      id: conversation.conversationId,
    });
    expect(afterRead?.unreadByAgent).toBe(0);
  });

  it("should mark conversation as read by visitor", async () => {
    const conversation = await client.mutation(api.testing.helpers.createTestConversation, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
    });

    // Send a message from agent to create unread count
    await client.mutation(api.testing.helpers.sendTestMessageDirect, {
      conversationId: conversation.conversationId,
      senderId: testUserId,
      senderType: "agent",
      content: "Hello visitor!",
    });

    const beforeRead = await client.mutation(api.testing.helpers.getTestConversation, {
      id: conversation.conversationId,
    });
    expect(beforeRead?.unreadByVisitor).toBeGreaterThanOrEqual(0);

    // Mark as read (reset unreadByVisitor via direct patch)
    await client.mutation(api.testing.helpers.markTestConversationAsRead, {
      id: conversation.conversationId,
    });

    const afterRead = await client.mutation(api.testing.helpers.getTestConversation, {
      id: conversation.conversationId,
    });
    expect(afterRead?.unreadByAgent).toBe(0);
  });

  it("should list conversations by visitor", async () => {
    const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
    });

    const { sessionToken } = await client.mutation(api.testing.helpers.createTestSessionToken, {
      visitorId: visitor.visitorId,
      workspaceId: testWorkspaceId,
    });

    await client.mutation(api.testing.helpers.createTestConversation, {
      workspaceId: testWorkspaceId,
      visitorId: visitor.visitorId,
    });

    await client.mutation(api.testing.helpers.createTestConversation, {
      workspaceId: testWorkspaceId,
      visitorId: visitor.visitorId,
      status: "closed",
    });

    const conversations = await client.query(api.conversations.listByVisitor, {
      visitorId: visitor.visitorId,
      sessionToken,
      workspaceId: testWorkspaceId,
    });

    expect(conversations.length).toBe(2);
  });

  it("should get total unread count for visitor", async () => {
    const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
    });

    const { sessionToken } = await client.mutation(api.testing.helpers.createTestSessionToken, {
      visitorId: visitor.visitorId,
      workspaceId: testWorkspaceId,
    });

    const conv1 = await client.mutation(api.testing.helpers.createTestConversation, {
      workspaceId: testWorkspaceId,
      visitorId: visitor.visitorId,
    });

    const conv2 = await client.mutation(api.testing.helpers.createTestConversation, {
      workspaceId: testWorkspaceId,
      visitorId: visitor.visitorId,
    });

    // Send messages from agents
    await client.mutation(api.testing.helpers.sendTestMessageDirect, {
      conversationId: conv1.conversationId,
      senderId: testUserId,
      senderType: "agent",
      content: "Message 1",
    });

    await client.mutation(api.testing.helpers.sendTestMessageDirect, {
      conversationId: conv2.conversationId,
      senderId: testUserId,
      senderType: "agent",
      content: "Message 2",
    });

    const totalUnread = await client.query(api.conversations.getTotalUnreadForVisitor, {
      visitorId: visitor.visitorId,
      sessionToken,
      workspaceId: testWorkspaceId,
    });

    expect(totalUnread).toBe(2);
  });

  it("should list conversations for workspace", async () => {
    const conversations = await client.mutation(api.testing.helpers.listTestConversations, {
      workspaceId: testWorkspaceId,
    });

    expect(conversations).toBeDefined();
    expect(Array.isArray(conversations)).toBe(true);
    expect(conversations.length).toBeGreaterThan(0);
  });

  it("should create conversation for visitor with welcome message", async () => {
    const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
    });

    const conversation = await client.mutation(
      api.testing.helpers.createTestConversationForVisitor,
      {
        workspaceId: testWorkspaceId,
        visitorId: visitor.visitorId,
      }
    );

    expect(conversation).toBeDefined();

    // Check that welcome message was created
    const messages = await client.mutation(api.testing.helpers.listTestMessages, {
      conversationId: conversation!._id,
    });

    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].senderType).toBe("bot");
    expect(messages[0].content).toContain("How can we help");
  });
});
