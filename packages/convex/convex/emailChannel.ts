import { v } from "convex/values";
import {
  mutation,
  query,
  internalQuery,
  internalMutation,
  internalAction,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { Resend } from "resend";
import { getAuthenticatedUserFromSession } from "./auth";
import { hasPermission, requirePermission } from "./permissions";
import { formatReadableVisitorId } from "./visitorReadableId";

const WEBHOOK_INTERNAL_SECRET =
  process.env.EMAIL_WEBHOOK_INTERNAL_SECRET ?? process.env.RESEND_WEBHOOK_SECRET ?? "";
const ENFORCE_WEBHOOK_INTERNAL_SECRET = process.env.ENFORCE_WEBHOOK_SIGNATURES !== "false";

function assertWebhookInternalAccess(providedSecret?: string): void {
  if (!WEBHOOK_INTERNAL_SECRET) {
    if (ENFORCE_WEBHOOK_INTERNAL_SECRET) {
      throw new Error("Webhook internal secret is not configured");
    }
    return;
  }

  if (!providedSecret || providedSecret !== WEBHOOK_INTERNAL_SECRET) {
    throw new Error("Unauthorized");
  }
}

// Helper to normalize email subject for thread matching
export function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(re|fwd|fw):\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Helper to extract email address from "Name <email@example.com>" format
export function extractEmailAddress(emailString: string): string {
  const match = emailString.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : emailString.toLowerCase().trim();
}

// Get email config for a workspace
export const getEmailConfig = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return null;
    }

    const canRead = await hasPermission(ctx, user._id, args.workspaceId, "settings.integrations");
    if (!canRead) {
      return null;
    }

    return await ctx.db
      .query("emailConfigs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
  },
});

// Get email config by forwarding address
export const getEmailConfigByForwardingAddress = query({
  args: {
    forwardingAddress: v.string(),
    webhookSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertWebhookInternalAccess(args.webhookSecret);

    return await ctx.db
      .query("emailConfigs")
      .withIndex("by_forwarding_address", (q) => q.eq("forwardingAddress", args.forwardingAddress))
      .first();
  },
});

// Create or update email config for a workspace
export const upsertEmailConfig = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    fromName: v.optional(v.string()),
    fromEmail: v.optional(v.string()),
    signature: v.optional(v.string()),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, args.workspaceId, "settings.integrations");

    const existing = await ctx.db
      .query("emailConfigs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        fromName: args.fromName,
        fromEmail: args.fromEmail,
        signature: args.signature,
        enabled: args.enabled,
        updatedAt: now,
      });
      return existing._id;
    }

    // Generate unique forwarding address
    const workspaceIdStr = args.workspaceId.toString().slice(-8);
    const forwardingAddress = `inbox-${workspaceIdStr}@mail.opencom.app`;

    return await ctx.db.insert("emailConfigs", {
      workspaceId: args.workspaceId,
      forwardingAddress,
      fromName: args.fromName,
      fromEmail: args.fromEmail,
      signature: args.signature,
      enabled: args.enabled,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Find existing conversation by email thread
export const findConversationByThread = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    messageId: v.optional(v.string()),
    inReplyTo: v.optional(v.string()),
    references: v.optional(v.array(v.string())),
    subject: v.string(),
    senderEmail: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Try to match by In-Reply-To header
    if (args.inReplyTo) {
      const inReplyTo = args.inReplyTo;
      const thread = await ctx.db
        .query("emailThreads")
        .withIndex("by_message_id", (q) => q.eq("messageId", inReplyTo))
        .first();
      if (thread) {
        return (await ctx.db.get(thread.conversationId)) as Doc<"conversations"> | null;
      }
    }

    // 2. Try to match by References headers
    if (args.references && args.references.length > 0) {
      for (const ref of args.references) {
        const thread = await ctx.db
          .query("emailThreads")
          .withIndex("by_message_id", (q) => q.eq("messageId", ref))
          .first();
        if (thread) {
          return (await ctx.db.get(thread.conversationId)) as Doc<"conversations"> | null;
        }
      }
    }

    // 3. Try to match by normalized subject and sender
    const normalizedSubject = normalizeSubject(args.subject);
    const senderEmail = extractEmailAddress(args.senderEmail);

    const threadBySubject = await ctx.db
      .query("emailThreads")
      .withIndex("by_subject_sender", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("normalizedSubject", normalizedSubject)
          .eq("senderEmail", senderEmail)
      )
      .first();

    if (threadBySubject) {
      return await ctx.db.get(threadBySubject.conversationId);
    }

    return null;
  },
});

// Process inbound email - creates or updates conversation
export const processInboundEmail = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    webhookSecret: v.optional(v.string()),
    from: v.string(),
    to: v.array(v.string()),
    cc: v.optional(v.array(v.string())),
    subject: v.string(),
    textBody: v.optional(v.string()),
    htmlBody: v.optional(v.string()),
    messageId: v.string(),
    inReplyTo: v.optional(v.string()),
    references: v.optional(v.array(v.string())),
    attachments: v.optional(
      v.array(
        v.object({
          filename: v.string(),
          contentType: v.string(),
          size: v.number(),
          storageId: v.optional(v.id("_storage")),
          url: v.optional(v.string()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    assertWebhookInternalAccess(args.webhookSecret);

    const now = Date.now();
    const senderEmail = extractEmailAddress(args.from);
    const normalizedSubject = normalizeSubject(args.subject);

    // Find or create visitor by email
    let visitor = await ctx.db
      .query("visitors")
      .withIndex("by_email", (q) => q.eq("workspaceId", args.workspaceId).eq("email", senderEmail))
      .first();

    if (visitor && !visitor.readableId) {
      await ctx.db.patch(visitor._id, {
        readableId: formatReadableVisitorId(visitor._id),
      });
      visitor = (await ctx.db.get(visitor._id)) as Doc<"visitors"> | null;
    }

    if (!visitor) {
      const visitorId = await ctx.db.insert("visitors", {
        sessionId: `email-${senderEmail}-${now}`,
        workspaceId: args.workspaceId,
        email: senderEmail,
        createdAt: now,
      });

      await ctx.db.patch(visitorId, {
        readableId: formatReadableVisitorId(visitorId),
      });
      visitor = (await ctx.db.get(visitorId)) as Doc<"visitors"> | null;
    }

    // Try to find existing conversation by thread
    let conversation: {
      _id: Id<"conversations">;
      status: "open" | "closed" | "snoozed";
    } | null = null;

    // Check by In-Reply-To
    if (args.inReplyTo) {
      const inReplyTo = args.inReplyTo;
      const thread = await ctx.db
        .query("emailThreads")
        .withIndex("by_message_id", (q) => q.eq("messageId", inReplyTo))
        .first();
      if (thread) {
        conversation = (await ctx.db.get(thread.conversationId)) as Doc<"conversations"> | null;
      }
    }

    // Check by References
    if (!conversation && args.references && args.references.length > 0) {
      for (const ref of args.references) {
        const thread = await ctx.db
          .query("emailThreads")
          .withIndex("by_message_id", (q) => q.eq("messageId", ref))
          .first();
        if (thread) {
          conversation = (await ctx.db.get(thread.conversationId)) as Doc<"conversations"> | null;
          break;
        }
      }
    }

    // Check by subject and sender
    if (!conversation) {
      const threadBySubject = await ctx.db
        .query("emailThreads")
        .withIndex("by_subject_sender", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("normalizedSubject", normalizedSubject)
            .eq("senderEmail", senderEmail)
        )
        .first();

      if (threadBySubject) {
        conversation = await ctx.db.get(threadBySubject.conversationId);
      }
    }

    let conversationId: Id<"conversations">;

    if (conversation) {
      conversationId = conversation._id;
      // Reopen if closed
      if (conversation.status === "closed") {
        await ctx.db.patch(conversationId, {
          status: "open",
          updatedAt: now,
        });
      }
    } else {
      // Create new conversation
      conversationId = await ctx.db.insert("conversations", {
        workspaceId: args.workspaceId,
        visitorId: visitor!._id,
        status: "open",
        channel: "email",
        subject: args.subject,
        createdAt: now,
        updatedAt: now,
        lastMessageAt: now,
        unreadByAgent: 1,
      });
    }

    // Create message
    const content = args.htmlBody || args.textBody || "";
    const messageDbId = await ctx.db.insert("messages", {
      conversationId,
      senderId: visitor!._id,
      senderType: "visitor",
      content,
      channel: "email",
      emailMetadata: {
        subject: args.subject,
        from: args.from,
        to: args.to,
        cc: args.cc,
        messageId: args.messageId,
        inReplyTo: args.inReplyTo,
        references: args.references,
        attachments: args.attachments,
      },
      createdAt: now,
    });

    // Create email thread record for future matching
    await ctx.db.insert("emailThreads", {
      workspaceId: args.workspaceId,
      conversationId,
      messageId: args.messageId,
      inReplyTo: args.inReplyTo,
      references: args.references,
      subject: args.subject,
      normalizedSubject,
      senderEmail,
      createdAt: now,
    });

    // Update conversation
    await ctx.db.patch(conversationId, {
      lastMessageAt: now,
      updatedAt: now,
      unreadByAgent: (conversation?.status === "open" ? 1 : 0) + 1,
    });

    // Notify about new message
    await ctx.scheduler.runAfter(0, internal.notifications.notifyNewMessage, {
      conversationId,
      messageContent: content,
      senderType: "visitor",
      messageId: messageDbId,
      senderId: visitor!._id,
      sentAt: now,
      channel: "email",
    });

    return { conversationId, messageId: messageDbId };
  },
});

// Handle forwarded email - extract original sender
export const processForwardedEmail = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    webhookSecret: v.optional(v.string()),
    forwarderEmail: v.string(),
    originalFrom: v.string(),
    to: v.array(v.string()),
    subject: v.string(),
    textBody: v.optional(v.string()),
    htmlBody: v.optional(v.string()),
    messageId: v.string(),
    attachments: v.optional(
      v.array(
        v.object({
          filename: v.string(),
          contentType: v.string(),
          size: v.number(),
          storageId: v.optional(v.id("_storage")),
          url: v.optional(v.string()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    assertWebhookInternalAccess(args.webhookSecret);

    const now = Date.now();
    const originalSenderEmail = extractEmailAddress(args.originalFrom);
    const normalizedSubject = normalizeSubject(args.subject.replace(/^fwd?:\s*/i, ""));

    // Find or create visitor by original sender email
    let visitor = await ctx.db
      .query("visitors")
      .withIndex("by_email", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("email", originalSenderEmail)
      )
      .first();

    if (visitor && !visitor.readableId) {
      await ctx.db.patch(visitor._id, {
        readableId: formatReadableVisitorId(visitor._id),
      });
      visitor = (await ctx.db.get(visitor._id)) as Doc<"visitors"> | null;
    }

    if (!visitor) {
      const visitorId = await ctx.db.insert("visitors", {
        sessionId: `email-${originalSenderEmail}-${now}`,
        workspaceId: args.workspaceId,
        email: originalSenderEmail,
        createdAt: now,
      });

      await ctx.db.patch(visitorId, {
        readableId: formatReadableVisitorId(visitorId),
      });
      visitor = (await ctx.db.get(visitorId)) as Doc<"visitors"> | null;
    }

    // Create new conversation for forwarded email
    const conversationId = await ctx.db.insert("conversations", {
      workspaceId: args.workspaceId,
      visitorId: visitor!._id,
      status: "open",
      channel: "email",
      subject: args.subject,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      unreadByAgent: 1,
    });

    // Create message
    const content = args.htmlBody || args.textBody || "";
    const messageDbId = await ctx.db.insert("messages", {
      conversationId,
      senderId: visitor!._id,
      senderType: "visitor",
      content,
      channel: "email",
      emailMetadata: {
        subject: args.subject,
        from: args.originalFrom,
        to: args.to,
        messageId: args.messageId,
        attachments: args.attachments,
      },
      createdAt: now,
    });

    // Create email thread record
    await ctx.db.insert("emailThreads", {
      workspaceId: args.workspaceId,
      conversationId,
      messageId: args.messageId,
      subject: args.subject,
      normalizedSubject,
      senderEmail: originalSenderEmail,
      createdAt: now,
    });

    // Notify about new conversation
    await ctx.scheduler.runAfter(0, internal.notifications.notifyNewConversation, {
      conversationId,
    });

    return { conversationId, messageId: messageDbId };
  },
});

// List email threads for a conversation
export const listEmailThreads = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return [];
    }

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

    const limit = Math.max(1, Math.min(args.limit ?? 100, 500));

    return await ctx.db
      .query("emailThreads")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .take(limit);
  },
});

// Generate a unique Message-ID for outbound emails
function generateMessageId(workspaceId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `<${timestamp}.${random}.${workspaceId}@mail.opencom.app>`;
}

// Send email reply from agent
export const sendEmailReply = mutation({
  args: {
    conversationId: v.id("conversations"),
    agentId: v.id("users"),
    to: v.array(v.string()),
    cc: v.optional(v.array(v.string())),
    bcc: v.optional(v.array(v.string())),
    subject: v.string(),
    htmlBody: v.string(),
    textBody: v.optional(v.string()),
    replyToMessageId: v.optional(v.string()),
    attachments: v.optional(
      v.array(
        v.object({
          filename: v.string(),
          contentType: v.string(),
          size: v.number(),
          storageId: v.optional(v.id("_storage")),
          url: v.optional(v.string()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    if (user._id !== args.agentId) {
      throw new Error("Cannot send email as another agent");
    }

    // Get conversation
    const conversation = (await ctx.db.get(args.conversationId)) as Doc<"conversations"> | null;
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    await requirePermission(ctx, user._id, conversation.workspaceId, "conversations.reply");

    // Get email config for workspace
    const emailConfig = await ctx.db
      .query("emailConfigs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", conversation.workspaceId))
      .first();

    if (!emailConfig || !emailConfig.enabled) {
      throw new Error("Email channel not configured for this workspace");
    }

    // Get agent info
    const agent = (await ctx.db.get(args.agentId)) as Doc<"users"> | null;
    if (!agent) {
      throw new Error("Agent not found");
    }
    if (agent.workspaceId !== conversation.workspaceId) {
      throw new Error("Agent does not belong to this workspace");
    }

    // Generate Message-ID
    const messageId = generateMessageId(conversation.workspaceId);

    // Build references array for threading
    let references: string[] = [];
    let inReplyTo: string | undefined;

    if (args.replyToMessageId) {
      inReplyTo = args.replyToMessageId;
      // Get existing thread to build references
      const existingThread = await ctx.db
        .query("emailThreads")
        .withIndex("by_message_id", (q) => q.eq("messageId", args.replyToMessageId!))
        .first();
      if (existingThread?.references) {
        references = [...existingThread.references, args.replyToMessageId];
      } else {
        references = [args.replyToMessageId];
      }
    }

    // Create message record with pending status
    const dbMessageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: args.agentId,
      senderType: "agent",
      content: args.htmlBody,
      channel: "email",
      emailMetadata: {
        subject: args.subject,
        from: emailConfig.fromEmail || emailConfig.forwardingAddress,
        to: args.to,
        cc: args.cc,
        bcc: args.bcc,
        messageId,
        inReplyTo,
        references: references.length > 0 ? references : undefined,
        attachments: args.attachments,
      },
      deliveryStatus: "pending",
      createdAt: now,
    });

    // Create email thread record
    await ctx.db.insert("emailThreads", {
      workspaceId: conversation.workspaceId,
      conversationId: args.conversationId,
      messageId,
      inReplyTo,
      references: references.length > 0 ? references : undefined,
      subject: args.subject,
      normalizedSubject: normalizeSubject(args.subject),
      senderEmail: emailConfig.fromEmail || emailConfig.forwardingAddress,
      createdAt: now,
    });

    // Update conversation
    await ctx.db.patch(args.conversationId, {
      lastMessageAt: now,
      updatedAt: now,
      unreadByVisitor: (conversation.unreadByVisitor || 0) + 1,
    });

    // Schedule email sending (will be handled by action)
    await ctx.scheduler.runAfter(0, internal.emailChannel.sendEmailViaProvider, {
      messageId: dbMessageId,
      to: args.to,
      cc: args.cc,
      bcc: args.bcc,
      subject: args.subject,
      htmlBody: args.htmlBody,
      textBody: args.textBody,
      fromName: emailConfig.fromName || agent.name || "Support",
      fromEmail: emailConfig.fromEmail || emailConfig.forwardingAddress,
      emailMessageId: messageId,
      inReplyTo,
      references: references.length > 0 ? references : undefined,
      signature: emailConfig.signature,
    });

    return { messageId: dbMessageId, emailMessageId: messageId };
  },
});

// Internal mutation to update message delivery status
export const updateDeliveryStatus = internalMutation({
  args: {
    messageId: v.id("messages"),
    status: v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      deliveryStatus: args.status,
    });
  },
});

// Internal mutation to update message delivery status by external email ID (for webhooks)
export const updateDeliveryStatusByExternalId = internalMutation({
  args: {
    externalEmailId: v.string(),
    status: v.union(v.literal("delivered"), v.literal("bounced")),
  },
  handler: async (ctx, args) => {
    // Look up the email thread by the external message ID
    const emailThread = await ctx.db
      .query("emailThreads")
      .withIndex("by_message_id", (q) => q.eq("messageId", args.externalEmailId))
      .first();

    const message = await ctx.db
      .query("messages")
      .withIndex("by_email_message_id", (q) =>
        q.eq("emailMetadata.messageId", args.externalEmailId)
      )
      .first();

    if (!message) {
      return { updated: false, reason: "Message not found" };
    }

    if (emailThread && message.conversationId !== emailThread.conversationId) {
      return { updated: false, reason: "Message not found in conversation" };
    }

    await ctx.db.patch(message._id, {
      deliveryStatus: args.status,
    });
    return { updated: true, messageId: message._id };
  },
});

// Internal action to send email via Resend
export const sendEmailViaProvider = internalAction({
  args: {
    messageId: v.id("messages"),
    to: v.array(v.string()),
    cc: v.optional(v.array(v.string())),
    bcc: v.optional(v.array(v.string())),
    subject: v.string(),
    htmlBody: v.string(),
    textBody: v.optional(v.string()),
    fromName: v.string(),
    fromEmail: v.string(),
    emailMessageId: v.string(),
    inReplyTo: v.optional(v.string()),
    references: v.optional(v.array(v.string())),
    signature: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("RESEND_API_KEY not configured");
      await ctx.runMutation(internal.emailChannel.updateDeliveryStatus, {
        messageId: args.messageId,
        status: "failed",
      });
      return { success: false, error: "Email service not configured" };
    }

    const resend = new Resend(apiKey);

    // Append signature if configured
    let htmlContent = args.htmlBody;
    if (args.signature) {
      htmlContent += `<br><br>--<br>${args.signature}`;
    }

    // Build headers for threading
    const headers: Record<string, string> = {
      "Message-ID": args.emailMessageId,
    };
    if (args.inReplyTo) {
      headers["In-Reply-To"] = args.inReplyTo;
    }
    if (args.references && args.references.length > 0) {
      headers["References"] = args.references.join(" ");
    }

    try {
      await resend.emails.send({
        from: `${args.fromName} <${args.fromEmail}>`,
        to: args.to,
        cc: args.cc,
        bcc: args.bcc,
        subject: args.subject,
        html: htmlContent,
        text: args.textBody,
        headers,
      });

      await ctx.runMutation(internal.emailChannel.updateDeliveryStatus, {
        messageId: args.messageId,
        status: "sent",
      });

      return { success: true };
    } catch (error) {
      console.error("Failed to send email:", error);
      await ctx.runMutation(internal.emailChannel.updateDeliveryStatus, {
        messageId: args.messageId,
        status: "failed",
      });
      return { success: false, error: "Failed to send email" };
    }
  },
});
