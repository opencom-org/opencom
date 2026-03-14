import { v } from "convex/values";
import { mutation, query, internalMutation, type QueryCtx } from "./_generated/server";
import { type Doc, type Id } from "./_generated/dataModel";
import { getAuthenticatedUserFromSession } from "./auth";
import { getShallowRunAfter, notifyNewMessageRef } from "./notifications/functionRefs";
import { hasPermission, requirePermission } from "./permissions";
import {
  bindStagedSupportAttachments,
  describeSupportAttachmentSelection,
  loadSupportAttachmentDescriptorMap,
  materializeSupportAttachmentDescriptors,
  type SupportAttachmentDescriptor,
} from "./supportAttachments";
import { supportAttachmentIdArrayValidator } from "./supportAttachmentTypes";
import { resolveVisitorFromSession } from "./widgetSessions";
import { emitAutomationEvent } from "./automationEvents";

async function withSupportSenderNames(
  ctx: QueryCtx,
  messages: Doc<"messages">[]
): Promise<Array<Doc<"messages"> & { senderName?: string }>> {
  const supportSenderIds = [
    ...new Set(
      messages
        .filter((message) => message.senderType === "agent" || message.senderType === "user")
        .map((message) => message.senderId)
    ),
  ];

  if (supportSenderIds.length === 0) {
    return messages;
  }

  const senderNameById = new Map<string, string>();

  await Promise.all(
    supportSenderIds.map(async (senderId) => {
      try {
        const sender = (await ctx.db.get(senderId as Id<"users">)) as Doc<"users"> | null;
        if (!sender) {
          return;
        }
        const senderName = sender.name?.trim() || sender.email?.trim();
        if (!senderName) {
          return;
        }
        senderNameById.set(senderId, senderName);
      } catch {
        // Some historical sender IDs are not user IDs; fall back to default UI labels.
      }
    })
  );

  return messages.map((message) => {
    if (message.senderType !== "agent" && message.senderType !== "user") {
      return message;
    }
    return {
      ...message,
      senderName: senderNameById.get(message.senderId) ?? "Support",
    };
  });
}

async function withMessageAttachments(
  ctx: QueryCtx,
  messages: Array<Doc<"messages"> & { senderName?: string }>
): Promise<Array<Doc<"messages"> & { senderName?: string; attachments: SupportAttachmentDescriptor[] }>> {
  const descriptorMap = await loadSupportAttachmentDescriptorMap(
    ctx,
    messages.flatMap((message) => message.attachmentIds ?? [])
  );

  return messages.map((message) => ({
    ...message,
    attachments: materializeSupportAttachmentDescriptors(message.attachmentIds, descriptorMap),
  }));
}

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
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
          .order("asc")
          .collect();
        return await withMessageAttachments(ctx, await withSupportSenderNames(ctx, messages));
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

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();
    return await withMessageAttachments(ctx, await withSupportSenderNames(ctx, messages));
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
    attachmentIds: v.optional(supportAttachmentIdArrayValidator),
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
    let resolvedVisitorId = args.visitorId;
    let authenticatedUserId: Id<"users"> | undefined;
    if (args.senderType === "visitor") {
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
      authenticatedUserId = user._id;
    }

    const now = Date.now();

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: args.senderId,
      senderType: args.senderType,
      content: args.content,
      createdAt: now,
    });

    let attachedIds: Id<"supportAttachments">[] = [];
    if (args.senderType === "visitor" && resolvedVisitorId) {
      attachedIds = await bindStagedSupportAttachments(ctx, {
        workspaceId: conversation.workspaceId,
        attachmentIds: args.attachmentIds,
        actor: { accessType: "visitor", visitorId: resolvedVisitorId },
        binding: { kind: "message", messageId },
      });
    } else if (args.senderType === "agent" && authenticatedUserId) {
      attachedIds = await bindStagedSupportAttachments(ctx, {
        workspaceId: conversation.workspaceId,
        attachmentIds: args.attachmentIds,
        actor: { accessType: "agent", userId: authenticatedUserId },
        binding: { kind: "message", messageId },
      });
    }

    if (attachedIds.length > 0) {
      await ctx.db.patch(messageId, {
        attachmentIds: attachedIds,
      });
    }

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

    const messagePreview =
      args.content.trim().length > 0
        ? args.content
        : (describeSupportAttachmentSelection(attachedIds) ?? args.content);

    const runAfter = getShallowRunAfter(ctx);
    await runAfter(0, notifyNewMessageRef, {
      conversationId: args.conversationId,
      messageContent: messagePreview,
      senderType: args.senderType,
      messageId,
      senderId: args.senderId,
      sentAt: now,
      channel: "chat",
    });

    await emitAutomationEvent(ctx, {
      workspaceId: conversation.workspaceId,
      eventType: "message.created",
      resourceType: "message",
      resourceId: messageId,
      data: { conversationId: args.conversationId, senderType: args.senderType, channel: "chat" },
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

    if (args.senderId === "ai-agent") {
      const activeClaim = await ctx.db
        .query("automationConversationClaims")
        .withIndex("by_conversation_status", (q) =>
          q.eq("conversationId", args.conversationId).eq("status", "active")
        )
        .first();

      if (activeClaim && activeClaim.expiresAt > now) {
        throw new Error("Conversation is currently claimed by external automation");
      }
    }

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

    const runAfter = getShallowRunAfter(ctx);
    await runAfter(0, notifyNewMessageRef, {
      conversationId: args.conversationId,
      messageContent: args.content,
      senderType: "bot",
      messageId,
      senderId: args.senderId ?? "system",
      sentAt: now,
      channel: "chat",
    });

    await emitAutomationEvent(ctx, {
      workspaceId: conversation.workspaceId,
      eventType: "message.created",
      resourceType: "message",
      resourceId: messageId,
      data: { conversationId: args.conversationId, senderType: "bot", channel: "chat" },
    });

    return messageId;
  },
});
