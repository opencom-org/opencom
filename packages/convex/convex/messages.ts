import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthenticatedUserFromSession } from "./auth";
import { hasPermission, requirePermission } from "./permissions";
import { resolveVisitorFromSession } from "./widgetSessions";

export const list = query({
  args: {
    conversationId: v.id("conversations"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return [];
    }

    // Resolve visitor from session token if provided
    let resolvedVisitorId = args.visitorId;
    if (args.sessionToken && conversation.workspaceId) {
      try {
        const resolved = await resolveVisitorFromSession(ctx, {
          sessionToken: args.sessionToken,
          workspaceId: conversation.workspaceId,
        });
        resolvedVisitorId = resolved.visitorId;
      } catch (error) {
        console.error("Failed to resolve visitor session:", error);
      }
    }

    // Allow visitor access if they own this conversation
    if (resolvedVisitorId) {
      const visitor = await ctx.db.get(resolvedVisitorId);
      if (visitor && conversation.visitorId === resolvedVisitorId) {
        return await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
          .order("asc")
          .collect();
      }
    }

    // Otherwise require authenticated agent with permission
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return [];
    }

    const canRead = await hasPermission(
      ctx,
      user._id,
      conversation.workspaceId,
      "conversations.read"
    );
    if (!canRead) {
      return [];
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();
  },
});

export const send = mutation({
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
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Bot messages are NOT allowed from external callers
    if (args.senderType === "bot") {
      throw new Error("Not authorized: bot messages can only be sent by internal system callers");
    }

    // Authorization: visitors can only send to their own conversations
    if (args.senderType === "visitor") {
      let resolvedVisitorId = args.visitorId;
      if (args.sessionToken) {
        const resolved = await resolveVisitorFromSession(ctx, {
          sessionToken: args.sessionToken,
          workspaceId: conversation.workspaceId,
        });
        resolvedVisitorId = resolved.visitorId;
      }
      if (!resolvedVisitorId || conversation.visitorId !== resolvedVisitorId) {
        throw new Error("Not authorized to send messages to this conversation");
      }
    } else if (args.senderType === "agent") {
      // Agents must have permission
      const user = await getAuthenticatedUserFromSession(ctx);
      if (!user) {
        throw new Error("Not authenticated");
      }
      await requirePermission(ctx, user._id, conversation.workspaceId, "conversations.reply");
    }

    const now = Date.now();

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: args.senderId,
      senderType: args.senderType,
      content: args.content,
      createdAt: now,
    });

    const updateData: {
      updatedAt: number;
      lastMessageAt: number;
      unreadByAgent?: number;
      unreadByVisitor?: number;
    } = {
      updatedAt: now,
      lastMessageAt: now,
    };

    if (args.senderType === "visitor") {
      updateData.unreadByAgent = (conversation.unreadByAgent || 0) + 1;
    } else if (args.senderType === "agent") {
      updateData.unreadByVisitor = (conversation.unreadByVisitor || 0) + 1;
    }

    await ctx.db.patch(args.conversationId, updateData);

    await ctx.scheduler.runAfter(0, internal.notifications.notifyNewMessage, {
      conversationId: args.conversationId,
      messageContent: args.content,
      senderType: args.senderType,
      messageId,
      senderId: args.senderId,
      sentAt: now,
      channel: "chat",
    });

    return messageId;
  },
});

// Internal mutation for bot/system messages — only callable by scheduler/actions
export const internalSendBotMessage = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    senderId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const now = Date.now();

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: args.senderId ?? "system",
      senderType: "bot",
      content: args.content,
      createdAt: now,
    });

    await ctx.db.patch(args.conversationId, {
      updatedAt: now,
      lastMessageAt: now,
      unreadByVisitor: (conversation.unreadByVisitor || 0) + 1,
    });

    await ctx.scheduler.runAfter(0, internal.notifications.notifyNewMessage, {
      conversationId: args.conversationId,
      messageContent: args.content,
      senderType: "bot",
      messageId,
      senderId: args.senderId ?? "system",
      sentAt: now,
      channel: "chat",
    });

    return messageId;
  },
});
