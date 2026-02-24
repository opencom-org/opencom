import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("messages", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testConversationId: Id<"conversations">;
  let testMessageId: Id<"messages">;

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

    const conversation = await client.mutation(api.testing.helpers.createTestConversation, {
      workspaceId: testWorkspaceId,
      visitorId: visitor.visitorId,
    });
    testConversationId = conversation.conversationId;
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

  it("should create a message from visitor", async () => {
    const result = await client.mutation(api.testing.helpers.createTestMessage, {
      conversationId: testConversationId,
      content: "Hello from visitor!",
      senderType: "visitor",
    });

    expect(result.messageId).toBeDefined();
    testMessageId = result.messageId;
  });

  it("should create a message from agent", async () => {
    const result = await client.mutation(api.testing.helpers.createTestMessage, {
      conversationId: testConversationId,
      content: "Hello from agent!",
      senderType: "agent",
    });

    expect(result.messageId).toBeDefined();
  });

  it("should list messages for conversation", async () => {
    const messages = await client.mutation(api.testing.helpers.listTestMessages, {
      conversationId: testConversationId,
    });

    expect(messages).toBeDefined();
    expect(messages.length).toBe(2);
    expect(messages.some((m) => m.content === "Hello from visitor!")).toBe(true);
    expect(messages.some((m) => m.content === "Hello from agent!")).toBe(true);
  });

  it("should update conversation lastMessageAt when sending message", async () => {
    const beforeMessage = await client.mutation(api.testing.helpers.getTestConversation, {
      id: testConversationId,
    });

    await client.mutation(api.testing.helpers.createTestMessage, {
      conversationId: testConversationId,
      content: "Another message",
      senderType: "visitor",
    });

    const afterMessage = await client.mutation(api.testing.helpers.getTestConversation, {
      id: testConversationId,
    });

    expect(afterMessage?.lastMessageAt).toBeGreaterThanOrEqual(beforeMessage?.lastMessageAt || 0);
  });
});
