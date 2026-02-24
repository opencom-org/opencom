import { v } from "convex/values";
import { internalMutation, internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { jsonRecordValidator } from "./validators";
import { sendEmail } from "./email";
import {
  resolveMemberNewVisitorMessagePreference,
  resolveWorkspaceNewVisitorMessageDefaults,
} from "./lib/notificationPreferences";

export const getPushTokensForWorkspace = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    excludeUserId: v.optional(v.id("users")),
    event: v.optional(v.literal("newVisitorMessage")),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const workspaceDefaults = args.event
      ? await ctx.db
          .query("workspaceNotificationDefaults")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
          .first()
      : null;

    const defaultNewVisitorMessagePreferences =
      resolveWorkspaceNewVisitorMessageDefaults(workspaceDefaults);

    const tokens: { token: string; platform: "ios" | "android"; userId: Id<"users"> }[] = [];

    for (const user of users) {
      if (args.excludeUserId && user._id === args.excludeUserId) {
        continue;
      }

      const prefs = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_user_workspace", (q) =>
          q.eq("userId", user._id).eq("workspaceId", args.workspaceId)
        )
        .first();

      const pushEnabled =
        args.event === "newVisitorMessage"
          ? resolveMemberNewVisitorMessagePreference(prefs, defaultNewVisitorMessagePreferences)
              .push
          : !prefs?.muted;

      if (!pushEnabled) {
        continue;
      }

      const userTokens = await ctx.db
        .query("pushTokens")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();

      for (const t of userTokens) {
        if (t.notificationsEnabled === false) {
          continue;
        }
        tokens.push({
          token: t.token,
          platform: t.platform,
          userId: user._id,
        });
      }
    }

    return tokens;
  },
});

export const getMemberRecipientsForNewVisitorMessage = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const workspaceDefaults = await ctx.db
      .query("workspaceNotificationDefaults")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const defaultNewVisitorMessagePreferences =
      resolveWorkspaceNewVisitorMessageDefaults(workspaceDefaults);

    const emailRecipients: string[] = [];
    const pushRecipients: {
      token: string;
      platform: "ios" | "android";
      userId: Id<"users">;
    }[] = [];

    const decisions: Array<{
      userId: Id<"users">;
      emailEnabled: boolean;
      pushEnabled: boolean;
      pushTokenCount: number;
      emailAddress: string | null;
    }> = [];

    for (const user of users) {
      const prefs = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_user_workspace", (q) =>
          q.eq("userId", user._id).eq("workspaceId", args.workspaceId)
        )
        .first();

      const effective = resolveMemberNewVisitorMessagePreference(
        prefs,
        defaultNewVisitorMessagePreferences
      );

      if (effective.email && user.email) {
        emailRecipients.push(user.email);
      }

      let enabledPushTokenCount = 0;
      if (effective.push) {
        const userTokens = await ctx.db
          .query("pushTokens")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();

        for (const token of userTokens) {
          if (token.notificationsEnabled === false) {
            continue;
          }
          enabledPushTokenCount += 1;
          pushRecipients.push({
            token: token.token,
            platform: token.platform,
            userId: user._id,
          });
        }
      }

      decisions.push({
        userId: user._id,
        emailEnabled: effective.email,
        pushEnabled: effective.push,
        pushTokenCount: enabledPushTokenCount,
        emailAddress: user.email ?? null,
      });
    }

    return {
      emailRecipients,
      pushRecipients,
      decisions,
    };
  },
});

export const getVisitorRecipientsForSupportReply = internalQuery({
  args: {
    conversationId: v.id("conversations"),
    channel: v.optional(v.union(v.literal("chat"), v.literal("email"))),
  },
  handler: async (ctx, args) => {
    const conversation = (await ctx.db.get(args.conversationId)) as Doc<"conversations"> | null;
    const visitorId = conversation?.visitorId;
    if (!visitorId) {
      return {
        emailRecipient: null as string | null,
        pushTokens: [] as string[],
      };
    }

    const visitor = (await ctx.db.get(visitorId)) as Doc<"visitors"> | null;
    const visitorTokens = await ctx.db
      .query("visitorPushTokens")
      .withIndex("by_visitor", (q) => q.eq("visitorId", visitorId))
      .collect();

    return {
      emailRecipient: visitor?.email && args.channel !== "email" ? visitor.email : null,
      pushTokens: visitorTokens
        .filter((token) => token.notificationsEnabled !== false)
        .map((token) => token.token),
    };
  },
});

export const sendPushNotification = internalAction({
  args: {
    tokens: v.array(v.string()),
    title: v.string(),
    body: v.string(),
    data: v.optional(jsonRecordValidator),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    sent: number;
    failed?: number;
    error?: string;
    tickets: Array<{
      status: string;
      id?: string;
      error?: string;
      errorCode?: string;
      token?: string;
    }>;
  }> => {
    if (args.tokens.length === 0) {
      return { success: true, sent: 0, tickets: [] };
    }

    return await ctx.runAction(internal.push.sendPush, {
      tokens: args.tokens,
      title: args.title,
      body: args.body,
      data: args.data,
    });
  },
});

export const sendNotificationEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
  },
  handler: async (_ctx, args) => {
    return await sendEmail(args.to, args.subject, args.html);
  },
});

const notificationEventTypeValidator = v.union(
  v.literal("chat_message"),
  v.literal("new_conversation"),
  v.literal("assignment"),
  v.literal("ticket_created"),
  v.literal("ticket_status_changed"),
  v.literal("ticket_assigned"),
  v.literal("ticket_comment"),
  v.literal("ticket_customer_reply"),
  v.literal("ticket_resolved"),
  v.literal("outbound_message"),
  v.literal("carousel_trigger"),
  v.literal("push_campaign")
);
const notificationDomainValidator = v.union(
  v.literal("chat"),
  v.literal("ticket"),
  v.literal("outbound"),
  v.literal("campaign")
);
const notificationAudienceValidator = v.union(
  v.literal("agent"),
  v.literal("visitor"),
  v.literal("both")
);
const notificationActorTypeValidator = v.union(
  v.literal("agent"),
  v.literal("visitor"),
  v.literal("bot"),
  v.literal("system")
);
const notificationChannelValidator = v.union(
  v.literal("push"),
  v.literal("email"),
  v.literal("web"),
  v.literal("widget")
);
const notificationRecipientTypeValidator = v.union(v.literal("agent"), v.literal("visitor"));

type NotificationPushAttempt = {
  dedupeKey: string;
  recipientType: "agent" | "visitor";
  userId?: Id<"users">;
  visitorId?: Id<"visitors">;
  tokens: string[];
};

function truncatePreview(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

function buildDefaultEventKey(args: {
  eventType: string;
  conversationId?: Id<"conversations">;
  ticketId?: Id<"tickets">;
  outboundMessageId?: Id<"outboundMessages">;
  campaignId?: Id<"pushCampaigns">;
  actorUserId?: Id<"users">;
  actorVisitorId?: Id<"visitors">;
}) {
  const primaryId =
    args.conversationId ?? args.ticketId ?? args.outboundMessageId ?? args.campaignId ?? "none";
  const actorId = args.actorUserId ?? args.actorVisitorId ?? "system";
  return `${args.eventType}:${String(primaryId)}:${String(actorId)}:${Date.now()}`;
}

async function resolveDefaultVisitorRecipients(
  ctx: any,
  args: {
    conversationId?: Id<"conversations">;
    ticketId?: Id<"tickets">;
  }
): Promise<Id<"visitors">[]> {
  if (args.conversationId) {
    const conversation = (await ctx.db.get(args.conversationId)) as Doc<"conversations"> | null;
    if (conversation?.visitorId) {
      return [conversation.visitorId];
    }
  }
  if (args.ticketId) {
    const ticket = (await ctx.db.get(args.ticketId)) as Doc<"tickets"> | null;
    if (ticket?.visitorId) {
      return [ticket.visitorId];
    }
  }
  return [];
}

export const logDeliveryOutcome = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    eventId: v.optional(v.id("notificationEvents")),
    eventKey: v.string(),
    dedupeKey: v.string(),
    channel: notificationChannelValidator,
    recipientType: notificationRecipientTypeValidator,
    userId: v.optional(v.id("users")),
    visitorId: v.optional(v.id("visitors")),
    tokenCount: v.optional(v.number()),
    status: v.union(v.literal("delivered"), v.literal("suppressed"), v.literal("failed")),
    reason: v.optional(v.string()),
    error: v.optional(v.string()),
    metadata: v.optional(jsonRecordValidator),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notificationDeliveries", {
      workspaceId: args.workspaceId,
      eventId: args.eventId,
      eventKey: args.eventKey,
      dedupeKey: args.dedupeKey,
      channel: args.channel,
      recipientType: args.recipientType,
      userId: args.userId,
      visitorId: args.visitorId,
      tokenCount: args.tokenCount,
      status: args.status,
      reason: args.reason,
      error: args.error,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
  },
});

export const dispatchPushAttempts = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    eventId: v.optional(v.id("notificationEvents")),
    eventKey: v.string(),
    title: v.optional(v.string()),
    body: v.string(),
    data: v.optional(jsonRecordValidator),
    attempts: v.array(
      v.object({
        dedupeKey: v.string(),
        recipientType: notificationRecipientTypeValidator,
        userId: v.optional(v.id("users")),
        visitorId: v.optional(v.id("visitors")),
        tokens: v.array(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let delivered = 0;
    let failed = 0;
    const results: Array<{
      dedupeKey: string;
      status: "delivered" | "suppressed" | "failed";
      sent: number;
      failed: number;
      error?: string;
      reason?: string;
    }> = [];

    for (const attempt of args.attempts) {
      if (attempt.tokens.length === 0) {
        failed += 1;
        await ctx.runMutation(internal.notifications.logDeliveryOutcome, {
          workspaceId: args.workspaceId,
          eventId: args.eventId,
          eventKey: args.eventKey,
          dedupeKey: attempt.dedupeKey,
          channel: "push",
          recipientType: attempt.recipientType,
          userId: attempt.userId,
          visitorId: attempt.visitorId,
          tokenCount: 0,
          status: "suppressed",
          reason: "missing_push_token",
        });
        results.push({
          dedupeKey: attempt.dedupeKey,
          status: "suppressed",
          sent: 0,
          failed: 0,
          reason: "missing_push_token",
        });
        continue;
      }

      const result = await ctx.runAction(internal.push.sendPush, {
        tokens: attempt.tokens,
        title: args.title,
        body: args.body,
        data: args.data,
      });
      const sent = result.sent ?? 0;
      const failedCount = result.failed ?? 0;
      const failedTicket = (result.tickets ?? []).find(
        (ticket: { status?: string; error?: string }) => ticket.status === "error"
      );

      if (sent > 0) {
        delivered += 1;
        await ctx.runMutation(internal.notifications.logDeliveryOutcome, {
          workspaceId: args.workspaceId,
          eventId: args.eventId,
          eventKey: args.eventKey,
          dedupeKey: attempt.dedupeKey,
          channel: "push",
          recipientType: attempt.recipientType,
          userId: attempt.userId,
          visitorId: attempt.visitorId,
          tokenCount: attempt.tokens.length,
          status: "delivered",
          ...(failedCount > 0
            ? {
                reason: "partial_delivery",
                metadata: {
                  sent,
                  failed: failedCount,
                },
              }
            : {}),
        });
        results.push({
          dedupeKey: attempt.dedupeKey,
          status: "delivered",
          sent,
          failed: failedCount,
          ...(failedCount > 0 ? { reason: "partial_delivery" } : {}),
        });
      } else {
        failed += 1;
        const errorMessage = result.error ?? failedTicket?.error ?? "Push transport error";
        await ctx.runMutation(internal.notifications.logDeliveryOutcome, {
          workspaceId: args.workspaceId,
          eventId: args.eventId,
          eventKey: args.eventKey,
          dedupeKey: attempt.dedupeKey,
          channel: "push",
          recipientType: attempt.recipientType,
          userId: attempt.userId,
          visitorId: attempt.visitorId,
          tokenCount: attempt.tokens.length,
          status: "failed",
          error: errorMessage,
        });
        results.push({
          dedupeKey: attempt.dedupeKey,
          status: "failed",
          sent,
          failed: failedCount || attempt.tokens.length,
          error: errorMessage,
        });
      }
    }

    return {
      attempted: args.attempts.length,
      delivered,
      failed,
      results,
    };
  },
});

export const routeEvent = internalMutation({
  args: {
    eventType: notificationEventTypeValidator,
    domain: notificationDomainValidator,
    audience: notificationAudienceValidator,
    workspaceId: v.id("workspaces"),
    actorType: notificationActorTypeValidator,
    actorUserId: v.optional(v.id("users")),
    actorVisitorId: v.optional(v.id("visitors")),
    conversationId: v.optional(v.id("conversations")),
    ticketId: v.optional(v.id("tickets")),
    outboundMessageId: v.optional(v.id("outboundMessages")),
    campaignId: v.optional(v.id("pushCampaigns")),
    title: v.optional(v.string()),
    body: v.string(),
    data: v.optional(jsonRecordValidator),
    recipientUserIds: v.optional(v.array(v.id("users"))),
    recipientVisitorIds: v.optional(v.array(v.id("visitors"))),
    excludeUserIds: v.optional(v.array(v.id("users"))),
    excludeVisitorIds: v.optional(v.array(v.id("visitors"))),
    eventKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const eventKey = args.eventKey ?? buildDefaultEventKey(args);
    const eventId = await ctx.db.insert("notificationEvents", {
      workspaceId: args.workspaceId,
      eventKey,
      eventType: args.eventType,
      domain: args.domain,
      audience: args.audience,
      actorType: args.actorType,
      actorUserId: args.actorUserId,
      actorVisitorId: args.actorVisitorId,
      conversationId: args.conversationId,
      ticketId: args.ticketId,
      outboundMessageId: args.outboundMessageId,
      campaignId: args.campaignId,
      title: args.title,
      bodyPreview: truncatePreview(args.body, 280),
      data: args.data,
      createdAt: Date.now(),
    });

    const attempts: NotificationPushAttempt[] = [];
    let suppressed = 0;

    const recordSuppressed = async (entry: {
      dedupeKey: string;
      recipientType: "agent" | "visitor";
      userId?: Id<"users">;
      visitorId?: Id<"visitors">;
      reason: string;
      error?: string;
    }) => {
      suppressed += 1;
      await ctx.db.insert("notificationDeliveries", {
        workspaceId: args.workspaceId,
        eventId,
        eventKey,
        dedupeKey: entry.dedupeKey,
        channel: "push",
        recipientType: entry.recipientType,
        userId: entry.userId,
        visitorId: entry.visitorId,
        status: "suppressed",
        reason: entry.reason,
        error: entry.error,
        createdAt: Date.now(),
      });
    };

    const explicitUserIds = new Set(args.recipientUserIds ?? []);
    const explicitVisitorIds = new Set(args.recipientVisitorIds ?? []);
    const excludeUserIds = new Set(args.excludeUserIds ?? []);
    const excludeVisitorIds = new Set(args.excludeVisitorIds ?? []);

    if (args.actorUserId) {
      excludeUserIds.add(args.actorUserId);
    }
    if (args.actorVisitorId) {
      excludeVisitorIds.add(args.actorVisitorId);
    }

    if (args.audience === "agent" || args.audience === "both") {
      const agentUserIds =
        explicitUserIds.size > 0
          ? Array.from(explicitUserIds)
          : (
              await ctx.db
                .query("users")
                .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
                .collect()
            ).map((user) => user._id);

      const workspaceDefaults = await ctx.db
        .query("workspaceNotificationDefaults")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .first();
      const defaultNewVisitorMessagePreferences =
        resolveWorkspaceNewVisitorMessageDefaults(workspaceDefaults);

      for (const userId of new Set(agentUserIds)) {
        const dedupeKey = `${eventKey}:agent:${userId}:push`;
        if (excludeUserIds.has(userId)) {
          await recordSuppressed({
            dedupeKey,
            recipientType: "agent",
            userId,
            reason: "sender_excluded",
          });
          continue;
        }

        const user = (await ctx.db.get(userId)) as Doc<"users"> | null;
        if (!user || user.workspaceId !== args.workspaceId) {
          await recordSuppressed({
            dedupeKey,
            recipientType: "agent",
            userId,
            reason: "recipient_out_of_workspace",
          });
          continue;
        }

        const existingDedupe = await ctx.db
          .query("notificationDedupeKeys")
          .withIndex("by_dedupe_key", (q) => q.eq("dedupeKey", dedupeKey))
          .first();
        if (existingDedupe) {
          await recordSuppressed({
            dedupeKey,
            recipientType: "agent",
            userId,
            reason: "duplicate_event_recipient_channel",
          });
          continue;
        }

        const prefs = await ctx.db
          .query("notificationPreferences")
          .withIndex("by_user_workspace", (q) =>
            q.eq("userId", userId).eq("workspaceId", args.workspaceId)
          )
          .first();
        const pushEnabled =
          args.eventType === "chat_message" && args.actorType === "visitor"
            ? resolveMemberNewVisitorMessagePreference(prefs, defaultNewVisitorMessagePreferences)
                .push
            : !prefs?.muted;
        if (!pushEnabled) {
          await recordSuppressed({
            dedupeKey,
            recipientType: "agent",
            userId,
            reason: "preference_muted",
          });
          continue;
        }

        const tokens = (
          await ctx.db
            .query("pushTokens")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect()
        )
          .filter((token) => token.notificationsEnabled !== false)
          .map((token) => token.token);
        if (tokens.length === 0) {
          await recordSuppressed({
            dedupeKey,
            recipientType: "agent",
            userId,
            reason: "missing_push_token",
          });
          continue;
        }

        await ctx.db.insert("notificationDedupeKeys", {
          dedupeKey,
          eventId,
          eventKey,
          workspaceId: args.workspaceId,
          channel: "push",
          recipientType: "agent",
          userId,
          createdAt: Date.now(),
        });
        attempts.push({
          dedupeKey,
          recipientType: "agent",
          userId,
          tokens,
        });
      }
    }

    if (args.audience === "visitor" || args.audience === "both") {
      const visitorIds =
        explicitVisitorIds.size > 0
          ? Array.from(explicitVisitorIds)
          : await resolveDefaultVisitorRecipients(ctx, {
              conversationId: args.conversationId,
              ticketId: args.ticketId,
            });

      for (const visitorId of new Set(visitorIds)) {
        const dedupeKey = `${eventKey}:visitor:${visitorId}:push`;
        if (excludeVisitorIds.has(visitorId)) {
          await recordSuppressed({
            dedupeKey,
            recipientType: "visitor",
            visitorId,
            reason: "sender_excluded",
          });
          continue;
        }

        const visitor = (await ctx.db.get(visitorId)) as Doc<"visitors"> | null;
        if (!visitor || visitor.workspaceId !== args.workspaceId) {
          await recordSuppressed({
            dedupeKey,
            recipientType: "visitor",
            visitorId,
            reason: "recipient_out_of_workspace",
          });
          continue;
        }

        const existingDedupe = await ctx.db
          .query("notificationDedupeKeys")
          .withIndex("by_dedupe_key", (q) => q.eq("dedupeKey", dedupeKey))
          .first();
        if (existingDedupe) {
          await recordSuppressed({
            dedupeKey,
            recipientType: "visitor",
            visitorId,
            reason: "duplicate_event_recipient_channel",
          });
          continue;
        }

        const tokens = (
          await ctx.db
            .query("visitorPushTokens")
            .withIndex("by_visitor", (q) => q.eq("visitorId", visitorId))
            .collect()
        )
          .filter((token) => token.notificationsEnabled !== false)
          .map((token) => token.token);
        if (tokens.length === 0) {
          await recordSuppressed({
            dedupeKey,
            recipientType: "visitor",
            visitorId,
            reason: "missing_push_token",
          });
          continue;
        }

        await ctx.db.insert("notificationDedupeKeys", {
          dedupeKey,
          eventId,
          eventKey,
          workspaceId: args.workspaceId,
          channel: "push",
          recipientType: "visitor",
          visitorId,
          createdAt: Date.now(),
        });
        attempts.push({
          dedupeKey,
          recipientType: "visitor",
          visitorId,
          tokens,
        });
      }
    }

    if (attempts.length > 0) {
      await ctx.scheduler.runAfter(0, internal.notifications.dispatchPushAttempts, {
        workspaceId: args.workspaceId,
        eventId,
        eventKey,
        title: args.title,
        body: args.body,
        data: args.data,
        attempts,
      });
    }

    return {
      eventId,
      eventKey,
      scheduled: attempts.length,
      suppressed,
    };
  },
});

const ADMIN_WEB_APP_BASE_URL =
  process.env.OPENCOM_WEB_APP_URL ?? process.env.NEXT_PUBLIC_OPENCOM_WEB_APP_URL ?? "";
const EMAIL_DEBOUNCE_MS = 60_000;
const MAX_BATCH_MESSAGES = 8;
const MAX_THREAD_MESSAGES = 12;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeHttpUrl(value: string | null | undefined): string | null {
  const rawValue = value?.trim();
  if (!rawValue) {
    return null;
  }

  try {
    const url = new URL(rawValue);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function buildAdminConversationInboxUrl(conversationId: Id<"conversations">): string | null {
  const normalizedBaseUrl = normalizeHttpUrl(ADMIN_WEB_APP_BASE_URL);
  if (!normalizedBaseUrl) {
    return null;
  }

  try {
    const url = new URL(normalizedBaseUrl);
    url.pathname = "/inbox";
    url.search = "";
    url.searchParams.set("conversationId", conversationId);
    return url.toString();
  } catch {
    return null;
  }
}

function formatEmailTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, " UTC");
}

function renderMetadataList(
  metadata: Array<{ label: string; value: string | null | undefined }>
): string {
  const items = metadata
    .filter((entry) => entry.value && entry.value.trim().length > 0)
    .map(
      (entry) => `<li><strong>${escapeHtml(entry.label)}:</strong> ${escapeHtml(entry.value!)}</li>`
    );

  if (items.length === 0) {
    return "";
  }

  return `<ul>${items.join("")}</ul>`;
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function formatMessageContentForEmail(content: string): string {
  return escapeHtml(truncateText(content, 600)).replace(/\n/g, "<br />");
}

function getSupportSenderLabel(
  message: Doc<"messages">,
  supportSenderLabels: Map<string, string>
): string {
  if (message.senderType === "bot") {
    return "Support bot";
  }
  if (message.senderType === "agent" || message.senderType === "user") {
    return supportSenderLabels.get(message.senderId) ?? "Support";
  }
  return "Support";
}

async function resolveSupportSenderLabels(
  ctx: any,
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

function renderConversationThreadHtml(args: {
  messages: Doc<"messages">[];
  newMessageIds: Set<Id<"messages">>;
  visitorLabel: string;
  supportSenderLabels: Map<string, string>;
}): string {
  if (args.messages.length === 0) {
    return "<p>No message content available.</p>";
  }

  const items = args.messages.map((message) => {
    const visitorSide = message.senderType === "visitor";
    const senderLabel = visitorSide
      ? args.visitorLabel
      : getSupportSenderLabel(message, args.supportSenderLabels);
    const createdAt = formatEmailTimestamp(message.createdAt);
    const content = formatMessageContentForEmail(message.content);
    const isNewMessage = args.newMessageIds.has(message._id);
    const bubbleBg = visitorSide ? "#eef2ff" : "#111827";
    const bubbleFg = visitorSide ? "#1f2937" : "#ffffff";

    return `
      <tr>
        <td align="${visitorSide ? "left" : "right"}" style="padding:0 0 10px 0;">
          <div style="display:inline-block;max-width:88%;padding:10px 12px;border-radius:12px;background:${bubbleBg};color:${bubbleFg};">
            <p style="margin:0 0 6px 0;font-size:12px;opacity:0.8;">
              <strong>${escapeHtml(senderLabel)}</strong> · ${escapeHtml(createdAt)}${isNewMessage ? " · New" : ""}
            </p>
            <p style="margin:0;font-size:14px;line-height:1.4;">${content}</p>
          </div>
        </td>
      </tr>
    `;
  });

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${items.join(
    ""
  )}</table>`;
}

type NotifyNewMessageMode = "send_member_email" | "send_visitor_email";

function isSupportSenderType(senderType: string): boolean {
  return senderType === "agent" || senderType === "bot";
}

function isRelevantMessageForMode(message: Doc<"messages">, mode: NotifyNewMessageMode): boolean {
  if (mode === "send_member_email") {
    return message.senderType === "visitor";
  }

  return isSupportSenderType(message.senderType);
}

function buildDebouncedEmailBatch(args: {
  recentMessagesDesc: Doc<"messages">[];
  mode: NotifyNewMessageMode;
  triggerMessageId: Id<"messages"> | undefined;
  triggerSentAt: number;
}): Doc<"messages">[] {
  const latestRelevant = args.recentMessagesDesc.find((message) =>
    isRelevantMessageForMode(message, args.mode)
  );

  if (!latestRelevant) {
    return [];
  }

  if (args.triggerMessageId) {
    if (latestRelevant._id !== args.triggerMessageId) {
      return [];
    }
  } else if (latestRelevant.createdAt > args.triggerSentAt) {
    return [];
  }

  const batchDesc: Doc<"messages">[] = [];
  let collecting = false;

  for (const message of args.recentMessagesDesc) {
    if (!collecting) {
      if (message._id !== latestRelevant._id) {
        continue;
      }
      collecting = true;
    }

    if (!isRelevantMessageForMode(message, args.mode)) {
      break;
    }

    if (batchDesc.length > 0) {
      const previousMessage = batchDesc[batchDesc.length - 1];
      if (previousMessage.createdAt - message.createdAt > EMAIL_DEBOUNCE_MS) {
        break;
      }
    }

    batchDesc.push(message);

    if (batchDesc.length >= MAX_BATCH_MESSAGES) {
      break;
    }
  }

  return batchDesc.reverse();
}

function buildVisitorWebsiteUrl(visitor: Doc<"visitors"> | null): string | null {
  return normalizeHttpUrl(visitor?.currentUrl);
}

async function resolveSupportSender(
  ctx: any,
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
        ? args.messageContent.slice(0, 100) + "..."
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

    // If message is from visitor, notify agents
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

    // If message is from agent/bot, notify visitor via Mobile SDK push and email
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

export const notifyTicketCreated = internalMutation({
  args: {
    ticketId: v.id("tickets"),
  },
  handler: async (ctx, args) => {
    const ticket = (await ctx.db.get(args.ticketId)) as Doc<"tickets"> | null;
    if (!ticket) return;

    let visitorInfo = "A customer";
    if (ticket.visitorId) {
      const visitor = (await ctx.db.get(ticket.visitorId)) as Doc<"visitors"> | null;
      if (visitor?.name) {
        visitorInfo = visitor.name;
      } else if (visitor?.email) {
        visitorInfo = visitor.email;
      }
    }

    await ctx.scheduler.runAfter(0, internal.notifications.routeEvent, {
      eventType: "ticket_created",
      domain: "ticket",
      audience: "agent",
      workspaceId: ticket.workspaceId,
      actorType: ticket.visitorId ? "visitor" : "system",
      actorVisitorId: ticket.visitorId ?? undefined,
      ticketId: args.ticketId,
      title: "New ticket created",
      body: `${visitorInfo} submitted: ${ticket.subject}`,
      data: {
        ticketId: args.ticketId,
        type: "ticket_created",
      },
      eventKey: `ticket_created:${args.ticketId}`,
    });
  },
});

export const notifyTicketStatusChanged = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    oldStatus: v.string(),
    newStatus: v.string(),
    actorUserId: v.optional(v.id("users")),
    changedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const ticket = (await ctx.db.get(args.ticketId)) as Doc<"tickets"> | null;
    if (!ticket || !ticket.visitorId) return;

    await ctx.scheduler.runAfter(0, internal.notifications.routeEvent, {
      eventType: "ticket_status_changed",
      domain: "ticket",
      audience: "visitor",
      workspaceId: ticket.workspaceId,
      actorType: args.actorUserId ? "agent" : "system",
      actorUserId: args.actorUserId,
      ticketId: args.ticketId,
      title: "Ticket update",
      body: `Your ticket \"${ticket.subject}\" moved to ${args.newStatus.replaceAll("_", " ")}.`,
      data: {
        ticketId: args.ticketId,
        type: "ticket_status_changed",
        oldStatus: args.oldStatus,
        newStatus: args.newStatus,
      },
      recipientVisitorIds: [ticket.visitorId],
      eventKey: `ticket_status_changed:${args.ticketId}:${args.newStatus}:${args.changedAt ?? Date.now()}`,
    });
  },
});

export const notifyTicketAssigned = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    assigneeId: v.id("users"),
    actorUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const ticket = (await ctx.db.get(args.ticketId)) as Doc<"tickets"> | null;
    if (!ticket) return;

    let visitorInfo = "a customer";
    if (ticket.visitorId) {
      const visitor = (await ctx.db.get(ticket.visitorId)) as Doc<"visitors"> | null;
      if (visitor?.name) {
        visitorInfo = visitor.name;
      } else if (visitor?.email) {
        visitorInfo = visitor.email;
      }
    }

    await ctx.scheduler.runAfter(0, internal.notifications.routeEvent, {
      eventType: "ticket_assigned",
      domain: "ticket",
      audience: "agent",
      workspaceId: ticket.workspaceId,
      actorType: args.actorUserId ? "agent" : "system",
      actorUserId: args.actorUserId,
      ticketId: args.ticketId,
      title: "Ticket assigned",
      body: `You've been assigned a ticket from ${visitorInfo}: ${ticket.subject}`,
      data: {
        ticketId: args.ticketId,
        type: "ticket_assigned",
      },
      recipientUserIds: [args.assigneeId],
      eventKey: `ticket_assigned:${args.ticketId}:${args.assigneeId}`,
    });
  },
});

export const notifyTicketComment = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    commentId: v.id("ticketComments"),
    actorUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const ticket = (await ctx.db.get(args.ticketId)) as Doc<"tickets"> | null;
    if (!ticket || !ticket.visitorId) return;

    const comment = (await ctx.db.get(args.commentId)) as Doc<"ticketComments"> | null;
    if (!comment) return;

    await ctx.scheduler.runAfter(0, internal.notifications.routeEvent, {
      eventType: "ticket_comment",
      domain: "ticket",
      audience: "visitor",
      workspaceId: ticket.workspaceId,
      actorType: args.actorUserId ? "agent" : "system",
      actorUserId: args.actorUserId,
      ticketId: args.ticketId,
      title: "Ticket update",
      body: truncatePreview(comment.content, 120),
      data: {
        ticketId: args.ticketId,
        type: "ticket_comment",
        commentId: args.commentId,
      },
      recipientVisitorIds: [ticket.visitorId],
      eventKey: `ticket_comment:${args.commentId}`,
    });
  },
});

export const notifyTicketCustomerReply = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    assigneeId: v.id("users"),
    commentId: v.optional(v.id("ticketComments")),
  },
  handler: async (ctx, args) => {
    const ticket = (await ctx.db.get(args.ticketId)) as Doc<"tickets"> | null;
    if (!ticket) return;

    let visitorInfo = "Customer";
    if (ticket.visitorId) {
      const visitor = (await ctx.db.get(ticket.visitorId)) as Doc<"visitors"> | null;
      if (visitor?.name) {
        visitorInfo = visitor.name;
      } else if (visitor?.email) {
        visitorInfo = visitor.email;
      }
    }

    await ctx.scheduler.runAfter(0, internal.notifications.routeEvent, {
      eventType: "ticket_customer_reply",
      domain: "ticket",
      audience: "agent",
      workspaceId: ticket.workspaceId,
      actorType: "visitor",
      actorVisitorId: ticket.visitorId ?? undefined,
      ticketId: args.ticketId,
      title: "Customer replied to ticket",
      body: `${visitorInfo} replied to: ${ticket.subject}`,
      data: {
        ticketId: args.ticketId,
        type: "ticket_customer_reply",
        ...(args.commentId ? { commentId: args.commentId } : {}),
      },
      recipientUserIds: [args.assigneeId],
      eventKey: args.commentId
        ? `ticket_customer_reply:${args.commentId}`
        : `ticket_customer_reply:${args.ticketId}:${args.assigneeId}`,
    });
  },
});

export const notifyTicketResolved = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    resolutionSummary: v.optional(v.string()),
    actorUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const ticket = (await ctx.db.get(args.ticketId)) as Doc<"tickets"> | null;
    if (!ticket || !ticket.visitorId) return;

    await ctx.scheduler.runAfter(0, internal.notifications.routeEvent, {
      eventType: "ticket_resolved",
      domain: "ticket",
      audience: "visitor",
      workspaceId: ticket.workspaceId,
      actorType: args.actorUserId ? "agent" : "system",
      actorUserId: args.actorUserId,
      ticketId: args.ticketId,
      title: "Ticket resolved",
      body: args.resolutionSummary
        ? truncatePreview(args.resolutionSummary, 140)
        : `Your ticket \"${ticket.subject}\" was resolved.`,
      data: {
        ticketId: args.ticketId,
        type: "ticket_resolved",
      },
      recipientVisitorIds: [ticket.visitorId],
      eventKey: `ticket_resolved:${args.ticketId}`,
    });
  },
});
