import { internalMutation } from "../../_generated/server";
import { v } from "convex/values";
import { formatReadableVisitorId } from "../../visitorReadableId";

const createTestVisitor = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    externalUserId: v.optional(v.string()),
    customAttributes: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const sessionId = `test-session-${timestamp}-${randomSuffix}`;

    const visitorId = await ctx.db.insert("visitors", {
      sessionId,
      workspaceId: args.workspaceId,
      email: args.email,
      name: args.name,
      externalUserId: args.externalUserId,
      customAttributes: args.customAttributes,
      createdAt: timestamp,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
    });

    await ctx.db.patch(visitorId, {
      readableId: formatReadableVisitorId(visitorId),
    });

    return { visitorId, sessionId };
  },
});

/**
 * Creates a test conversation in the specified workspace.
 */
const createTestConversation = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    userId: v.optional(v.id("users")),
    assignedAgentId: v.optional(v.id("users")),
    status: v.optional(v.union(v.literal("open"), v.literal("closed"), v.literal("snoozed"))),
    firstResponseAt: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();

    const conversationId = await ctx.db.insert("conversations", {
      workspaceId: args.workspaceId,
      visitorId: args.visitorId,
      userId: args.userId,
      assignedAgentId: args.assignedAgentId,
      status: args.status || "open",
      createdAt: timestamp,
      updatedAt: timestamp,
      unreadByAgent: 0,
      unreadByVisitor: 0,
      firstResponseAt: args.firstResponseAt,
      resolvedAt: args.resolvedAt,
      aiWorkflowState: "none",
    });

    return { conversationId };
  },
});

/**
 * Creates a test survey directly (bypasses auth on surveys.create).
 */
const createTestMessage = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    senderType: v.union(
      v.literal("user"),
      v.literal("visitor"),
      v.literal("agent"),
      v.literal("bot")
    ),
    senderId: v.optional(v.string()),
    emailMessageId: v.optional(v.string()),
    externalEmailId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const senderId = args.senderId || `test-sender-${timestamp}`;

    const emailId = args.emailMessageId || args.externalEmailId;
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId,
      senderType: args.senderType,
      content: args.content,
      createdAt: timestamp,
      ...(emailId && {
        channel: "email" as const,
        emailMetadata: { messageId: emailId },
        deliveryStatus: "pending" as const,
      }),
    });

    await ctx.db.patch(args.conversationId, {
      lastMessageAt: timestamp,
      updatedAt: timestamp,
    });

    return { messageId };
  },
});
const getTestConversation = internalMutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Lists conversations for a workspace directly (bypasses auth).
 */
const listTestConversations = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(v.union(v.literal("open"), v.literal("closed"), v.literal("snoozed"))),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("conversations")
        .withIndex("by_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", args.status!)
        )
        .order("desc")
        .collect();
    }
    return await ctx.db
      .query("conversations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
  },
});

/**
 * Updates conversation status directly (bypasses auth on conversations.updateStatus).
 */
const updateTestConversationStatus = internalMutation({
  args: {
    id: v.id("conversations"),
    status: v.union(v.literal("open"), v.literal("closed"), v.literal("snoozed")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };
    if (args.status === "closed") {
      patch.resolvedAt = now;
    } else if (args.status === "open") {
      patch.resolvedAt = undefined;
    }
    await ctx.db.patch(args.id, patch);
  },
});

/**
 * Assigns a conversation directly (bypasses auth on conversations.assign).
 */
const assignTestConversation = internalMutation({
  args: {
    id: v.id("conversations"),
    agentId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      assignedAgentId: args.agentId,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Marks a conversation as read directly (bypasses auth).
 */
const markTestConversationAsRead = internalMutation({
  args: { id: v.id("conversations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      unreadByAgent: 0,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Lists messages for a conversation directly (bypasses auth).
 */
const listTestMessages = internalMutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();
  },
});

/**
 * Sends a message directly (bypasses auth on messages.send, including bot restriction).
 */
const sendTestMessageDirect = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    senderId: v.string(),
    senderType: v.union(
      v.literal("user"),
      v.literal("visitor"),
      v.literal("agent"),
      v.literal("bot")
    ),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: args.senderId,
      senderType: args.senderType,
      content: args.content,
      createdAt: now,
    });

    const conversation = await ctx.db.get(args.conversationId);
    const unreadUpdate: Record<string, number> = {};
    if (args.senderType === "visitor") {
      unreadUpdate.unreadByAgent = (conversation?.unreadByAgent || 0) + 1;
    } else if (args.senderType === "agent" || args.senderType === "user") {
      unreadUpdate.unreadByVisitor = (conversation?.unreadByVisitor || 0) + 1;
    }

    await ctx.db.patch(args.conversationId, {
      updatedAt: now,
      lastMessageAt: now,
      ...unreadUpdate,
    });
    return messageId;
  },
});

/**
 * Seeds an AI response record and updates conversation workflow fields for deterministic tests.
 */
const getTestVisitor = internalMutation({
  args: { id: v.id("visitors") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Adds a workspace member directly (bypasses auth on workspaceMembers.add).
 */
const getTestMessage = internalMutation({
  args: { id: v.id("messages") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Updates workspace allowed origins directly (bypasses auth).
 */
const createTestConversationForVisitor = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.id("visitors"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("conversations", {
      workspaceId: args.workspaceId,
      visitorId: args.visitorId,
      status: "open",
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      aiWorkflowState: "none",
    });

    await ctx.db.insert("messages", {
      conversationId: id,
      senderId: "system",
      senderType: "bot",
      content: "Hi! How can we help you today?",
      createdAt: now,
    });

    return await ctx.db.get(id);
  },
});

/**
 * Looks up a user by email using the by_email index.
 * Mirrors the typed query pattern used in authConvex createOrUpdateUser.
 */

export const conversationTestHelpers: Record<string, ReturnType<typeof internalMutation>> = {
  createTestVisitor,
  createTestConversation,
  createTestMessage,
  getTestConversation,
  listTestConversations,
  updateTestConversationStatus,
  assignTestConversation,
  markTestConversationAsRead,
  listTestMessages,
  sendTestMessageDirect,
  getTestVisitor,
  getTestMessage,
  createTestConversationForVisitor,
} as const;
