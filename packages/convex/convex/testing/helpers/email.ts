import { internalMutation } from "../../_generated/server";
import { v } from "convex/values";

const createTestEmailConfig = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    enabled: v.optional(v.boolean()),
    fromName: v.optional(v.string()),
    fromEmail: v.optional(v.string()),
    signature: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const forwardingAddress = `test-inbox-${randomSuffix}@mail.opencom.app`;

    const emailConfigId = await ctx.db.insert("emailConfigs", {
      workspaceId: args.workspaceId,
      forwardingAddress,
      fromName: args.fromName,
      fromEmail: args.fromEmail,
      signature: args.signature,
      enabled: args.enabled ?? true,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return { emailConfigId, forwardingAddress };
  },
});

/**
 * Creates a test email conversation with email-specific fields.
 */
const createTestEmailConversation = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    subject: v.string(),
    status: v.optional(v.union(v.literal("open"), v.literal("closed"), v.literal("snoozed"))),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();

    const conversationId = await ctx.db.insert("conversations", {
      workspaceId: args.workspaceId,
      visitorId: args.visitorId,
      status: args.status || "open",
      channel: "email",
      subject: args.subject,
      createdAt: timestamp,
      updatedAt: timestamp,
      unreadByAgent: 0,
      unreadByVisitor: 0,
    });

    return { conversationId };
  },
});

/**
 * Creates a test email message with email metadata.
 */
const createTestEmailMessage = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    senderType: v.union(v.literal("visitor"), v.literal("agent")),
    senderId: v.optional(v.string()),
    subject: v.string(),
    from: v.string(),
    to: v.array(v.string()),
    messageId: v.string(),
    inReplyTo: v.optional(v.string()),
    references: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const senderId = args.senderId || `test-sender-${timestamp}`;

    const dbMessageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId,
      senderType: args.senderType,
      content: args.content,
      channel: "email",
      emailMetadata: {
        subject: args.subject,
        from: args.from,
        to: args.to,
        messageId: args.messageId,
        inReplyTo: args.inReplyTo,
        references: args.references,
      },
      createdAt: timestamp,
    });

    await ctx.db.patch(args.conversationId, {
      lastMessageAt: timestamp,
      updatedAt: timestamp,
    });

    return { messageId: dbMessageId };
  },
});

/**
 * Creates a test email thread record for thread matching tests.
 */
const createTestEmailThread = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    messageId: v.string(),
    subject: v.string(),
    senderEmail: v.string(),
    inReplyTo: v.optional(v.string()),
    references: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const normalizedSubject = args.subject
      .replace(/^(re|fwd|fw):\s*/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    const threadId = await ctx.db.insert("emailThreads", {
      workspaceId: args.workspaceId,
      conversationId: args.conversationId,
      messageId: args.messageId,
      inReplyTo: args.inReplyTo,
      references: args.references,
      subject: args.subject,
      normalizedSubject,
      senderEmail: args.senderEmail.toLowerCase(),
      createdAt: timestamp,
    });

    return { threadId };
  },
});

/**
 * Creates a test ticket in the specified workspace.
 */
const simulateEmailWebhook = internalMutation({
  args: {
    eventType: v.string(),
    emailId: v.string(),
  },
  handler: async (ctx, args) => {
    // Map event type to delivery status (only schema-valid values)
    const statusMap: Record<string, "pending" | "sent" | "delivered" | "bounced" | "failed"> = {
      "email.sent": "sent",
      "email.delivered": "delivered",
      "email.opened": "delivered",
      "email.clicked": "delivered",
      "email.bounced": "bounced",
      "email.complained": "failed",
      "email.delivery_delayed": "pending",
    };

    const deliveryStatus = statusMap[args.eventType];
    if (!deliveryStatus) return;

    // Find message by emailMetadata.messageId
    const message = await ctx.db
      .query("messages")
      .withIndex("by_email_message_id", (q) => q.eq("emailMetadata.messageId", args.emailId))
      .first();

    if (message) {
      await ctx.db.patch(message._id, { deliveryStatus });
    }
  },
});

/**
 * Gets a message by ID directly (bypasses auth).
 */

export const emailTestHelpers: Record<string, ReturnType<typeof internalMutation>> = {
  createTestEmailConfig,
  createTestEmailConversation,
  createTestEmailMessage,
  createTestEmailThread,
  simulateEmailWebhook,
} as const;
