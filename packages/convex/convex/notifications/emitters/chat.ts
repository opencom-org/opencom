import { v } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { EMAIL_DEBOUNCE_MS, MAX_THREAD_MESSAGES } from "../contracts";
import {
  buildAdminConversationInboxUrl,
  buildDebouncedEmailBatch,
  buildVisitorWebsiteUrl,
  escapeHtml,
  formatEmailTimestamp,
  isSupportSenderType,
  renderConversationThreadHtml,
  renderMetadataList,
} from "../helpers";

type SenderLookupCtx = Pick<QueryCtx | MutationCtx, "db">;

async function resolveSupportSenderLabels(
  ctx: SenderLookupCtx,
  messages: Doc<"messages">[]
): Promise<Map<string, string>> {
  const supportSenderIds = Array.from(
    new Set(
      messages
        .filter((message) => message.senderType === "agent" || message.senderType === "user")
        .map((message) => message.senderId)
    )
  );

  const supportSenderEntries = await Promise.all(
    supportSenderIds.map(async (senderId) => {
      try {
        const sender = (await ctx.db.get(senderId as Id<"users">)) as Doc<"users"> | null;
        return [senderId, sender?.name ?? sender?.email ?? "Support"] as const;
      } catch {
        return [senderId, "Support"] as const;
      }
    })
  );

  return new Map(supportSenderEntries);
}

async function resolveSupportSender(
  ctx: SenderLookupCtx,
  message: Doc<"messages">
): Promise<{ name: string; email: string | null }> {
  if (message.senderType === "bot") {
    return { name: "Support bot", email: null };
  }

  if (message.senderType !== "agent") {
    return { name: "Support", email: null };
  }

  try {
    const sender = (await ctx.db.get(message.senderId as Id<"users">)) as Doc<"users"> | null;
    if (!sender) {
      return { name: "Support", email: null };
    }
    return {
      name: sender.name ?? sender.email ?? "Support",
      email: sender.email ?? null,
    };
  } catch {
    return { name: "Support", email: null };
  }
}

export const notifyNewMessage = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    messageContent: v.string(),
    senderType: v.string(),
    messageId: v.optional(v.id("messages")),
    senderId: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    channel: v.optional(v.union(v.literal("chat"), v.literal("email"))),
    mode: v.optional(v.union(v.literal("send_member_email"), v.literal("send_visitor_email"))),
  },
  handler: async (ctx, args) => {
    const conversation = (await ctx.db.get(args.conversationId)) as Doc<"conversations"> | null;
    if (!conversation) return;
    const triggerSentAt = args.sentAt ?? Date.now();
    const truncatedContent =
      args.messageContent.length > 100
        ? `${args.messageContent.slice(0, 100)}...`
        : args.messageContent;

    if (args.mode === "send_member_email" || args.mode === "send_visitor_email") {
      const recentMessagesDesc = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
        .order("desc")
        .take(200);

      const batchMessages = buildDebouncedEmailBatch({
        recentMessagesDesc: recentMessagesDesc as Doc<"messages">[],
        mode: args.mode,
        triggerMessageId: args.messageId,
        triggerSentAt,
      });

      if (batchMessages.length === 0) {
        return;
      }

      const recentThreadMessages = recentMessagesDesc
        .slice(0, MAX_THREAD_MESSAGES)
        .reverse() as Doc<"messages">[];
      const newMessageIds = new Set(batchMessages.map((message) => message._id));
      const visitor = conversation.visitorId
        ? ((await ctx.db.get(conversation.visitorId)) as Doc<"visitors"> | null)
        : null;
      const visitorLabel = visitor?.name ?? visitor?.email ?? visitor?.readableId ?? "Visitor";
      const supportSenderLabels = await resolveSupportSenderLabels(ctx, recentThreadMessages);
      const threadHtml = renderConversationThreadHtml({
        messages: recentThreadMessages,
        newMessageIds,
        visitorLabel,
        supportSenderLabels,
      });

      if (args.mode === "send_member_email") {
        const recipients = await ctx.runQuery(
          internal.notifications.getMemberRecipientsForNewVisitorMessage,
          {
            workspaceId: conversation.workspaceId,
          }
        );

        if (recipients.emailRecipients.length === 0) {
          return;
        }

        const senderName = visitor?.name ?? visitor?.email ?? "Visitor";
        const senderEmail = visitor?.email ?? null;
        const senderReadableId = visitor?.readableId ?? null;
        const sentAtLabel = formatEmailTimestamp(batchMessages[batchMessages.length - 1].createdAt);
        const conversationInboxUrl = buildAdminConversationInboxUrl(args.conversationId);
        const openConversationHtml = conversationInboxUrl
          ? `<p><a href="${escapeHtml(
              conversationInboxUrl
            )}">Open this conversation in OpenCom inbox</a></p>`
          : "";
        const detailsHtml = renderMetadataList([
          { label: "Sender", value: senderName },
          { label: "Sender email", value: senderEmail },
          { label: "Visitor ID", value: senderReadableId },
          { label: "Sent at", value: sentAtLabel },
          { label: "Conversation ID", value: String(args.conversationId) },
          { label: "Message count", value: String(batchMessages.length) },
          { label: "Channel", value: args.channel ?? conversation.channel ?? "chat" },
        ]);
        const subject =
          batchMessages.length > 1
            ? `${batchMessages.length} new messages from ${senderName}`
            : `New message from ${senderName}`;

        for (const recipient of recipients.emailRecipients) {
          await ctx.scheduler.runAfter(0, internal.notifications.sendNotificationEmail, {
            to: recipient,
            subject,
            html: `<p>You have new visitor message activity.</p>${openConversationHtml}${detailsHtml}<p><strong>Recent conversation (last ${MAX_THREAD_MESSAGES} messages)</strong></p>${threadHtml}`,
          });
        }

        return;
      }

      if (!conversation.visitorId) {
        return;
      }

      const visitorRecipients = await ctx.runQuery(
        internal.notifications.getVisitorRecipientsForSupportReply,
        {
          conversationId: args.conversationId,
          channel: args.channel,
        }
      );

      if (!visitorRecipients.emailRecipient) {
        return;
      }

      const visitorWebsiteUrl = buildVisitorWebsiteUrl(visitor);
      const openWebsiteChatHtml = visitorWebsiteUrl
        ? `<p><a href="${escapeHtml(visitorWebsiteUrl)}">Open chat on the website</a></p>`
        : "";
      const latestSupportMessage = batchMessages[batchMessages.length - 1];
      const supportSender = await resolveSupportSender(ctx, latestSupportMessage);
      const sentAtLabel = formatEmailTimestamp(latestSupportMessage.createdAt);
      const detailsHtml = renderMetadataList([
        { label: "Sender", value: supportSender.name },
        { label: "Sender email", value: supportSender.email },
        { label: "Sent at", value: sentAtLabel },
        { label: "Conversation ID", value: String(args.conversationId) },
        { label: "Message count", value: String(batchMessages.length) },
      ]);
      const subject =
        batchMessages.length > 1
          ? `${batchMessages.length} new messages from support`
          : "New message from support";

      await ctx.scheduler.runAfter(0, internal.notifications.sendNotificationEmail, {
        to: visitorRecipients.emailRecipient,
        subject,
        html: `<p>You have new messages from support.</p>${openWebsiteChatHtml}${detailsHtml}<p><strong>Recent conversation (last ${MAX_THREAD_MESSAGES} messages)</strong></p>${threadHtml}`,
      });

      return;
    }

    if (args.senderType === "visitor") {
      const recipients = await ctx.runQuery(
        internal.notifications.getMemberRecipientsForNewVisitorMessage,
        {
          workspaceId: conversation.workspaceId,
        }
      );

      if (recipients.emailRecipients.length > 0 || recipients.pushRecipients.length > 0) {
        let visitor: Doc<"visitors"> | null = null;
        let senderName = "Visitor";
        if (conversation.visitorId) {
          visitor = (await ctx.db.get(conversation.visitorId)) as Doc<"visitors"> | null;
          if (visitor?.name) {
            senderName = visitor.name;
          } else if (visitor?.email) {
            senderName = visitor.email;
          }
        }

        await ctx.scheduler.runAfter(0, internal.notifications.routeEvent, {
          eventType: "chat_message",
          domain: "chat",
          audience: "agent",
          workspaceId: conversation.workspaceId,
          actorType: "visitor",
          actorVisitorId: conversation.visitorId ?? undefined,
          conversationId: args.conversationId,
          title: `New message from ${senderName}`,
          body: truncatedContent,
          data: {
            conversationId: args.conversationId,
            type: "new_message",
          },
          ...(args.messageId ? { eventKey: `chat_message:${args.messageId}` } : {}),
        });

        if (recipients.emailRecipients.length > 0) {
          await ctx.scheduler.runAfter(EMAIL_DEBOUNCE_MS, internal.notifications.notifyNewMessage, {
            conversationId: args.conversationId,
            messageContent: args.messageContent,
            senderType: args.senderType,
            messageId: args.messageId,
            senderId: args.senderId,
            sentAt: triggerSentAt,
            channel: args.channel,
            mode: "send_member_email",
          });
        }
      }
    }

    if (isSupportSenderType(args.senderType)) {
      if (conversation.visitorId) {
        const visitorRecipients = await ctx.runQuery(
          internal.notifications.getVisitorRecipientsForSupportReply,
          {
            conversationId: args.conversationId,
            channel: args.channel,
          }
        );

        await ctx.scheduler.runAfter(0, internal.notifications.routeEvent, {
          eventType: "chat_message",
          domain: "chat",
          audience: "visitor",
          workspaceId: conversation.workspaceId,
          actorType: args.senderType === "bot" ? "bot" : "agent",
          ...(args.senderType === "agent" && args.senderId
            ? { actorUserId: args.senderId as Id<"users"> }
            : {}),
          conversationId: args.conversationId,
          title: "Support",
          body: truncatedContent,
          data: {
            conversationId: args.conversationId,
            type: "new_message",
          },
          recipientVisitorIds: conversation.visitorId ? [conversation.visitorId] : undefined,
          ...(args.messageId ? { eventKey: `chat_message:${args.messageId}` } : {}),
        });

        if (visitorRecipients.emailRecipient) {
          await ctx.scheduler.runAfter(EMAIL_DEBOUNCE_MS, internal.notifications.notifyNewMessage, {
            conversationId: args.conversationId,
            messageContent: args.messageContent,
            senderType: args.senderType,
            messageId: args.messageId,
            senderId: args.senderId,
            sentAt: triggerSentAt,
            channel: args.channel,
            mode: "send_visitor_email",
          });
        }
      }
    }
  },
});

export const notifyNewConversation = internalMutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const conversation = (await ctx.db.get(args.conversationId)) as Doc<"conversations"> | null;
    if (!conversation) return;

    let visitorInfo = "New visitor";
    if (conversation.visitorId) {
      const visitor = (await ctx.db.get(conversation.visitorId)) as Doc<"visitors"> | null;
      if (visitor?.name) {
        visitorInfo = visitor.name;
      } else if (visitor?.email) {
        visitorInfo = visitor.email;
      }
    }

    await ctx.scheduler.runAfter(0, internal.notifications.routeEvent, {
      eventType: "new_conversation",
      domain: "chat",
      audience: "agent",
      workspaceId: conversation.workspaceId,
      actorType: "visitor",
      actorVisitorId: conversation.visitorId ?? undefined,
      conversationId: args.conversationId,
      title: "New conversation",
      body: `${visitorInfo} started a conversation`,
      data: {
        conversationId: args.conversationId,
        type: "new_conversation",
      },
      eventKey: `new_conversation:${args.conversationId}`,
    });
  },
});

export const notifyAssignment = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    assignedAgentId: v.id("users"),
    actorUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const conversation = (await ctx.db.get(args.conversationId)) as Doc<"conversations"> | null;
    if (!conversation) return;

    let visitorInfo = "a visitor";
    if (conversation.visitorId) {
      const visitor = (await ctx.db.get(conversation.visitorId)) as Doc<"visitors"> | null;
      if (visitor?.name) {
        visitorInfo = visitor.name;
      } else if (visitor?.email) {
        visitorInfo = visitor.email;
      }
    }

    await ctx.scheduler.runAfter(0, internal.notifications.routeEvent, {
      eventType: "assignment",
      domain: "chat",
      audience: "agent",
      workspaceId: conversation.workspaceId,
      actorType: args.actorUserId ? "agent" : "system",
      actorUserId: args.actorUserId,
      conversationId: args.conversationId,
      title: "Conversation assigned",
      body: `You've been assigned a conversation with ${visitorInfo}`,
      data: {
        conversationId: args.conversationId,
        type: "assignment",
      },
      recipientUserIds: [args.assignedAgentId],
      eventKey: `assignment:${args.conversationId}:${args.assignedAgentId}`,
    });
  },
});
