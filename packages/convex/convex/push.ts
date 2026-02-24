import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { jsonRecordValidator, jsonValueValidator } from "./validators";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_REMOVE_TOKEN_ERRORS = new Set([
  "DeviceNotRegistered",
  "InvalidRegistration",
  "InvalidPushToken",
]);

interface ExpoPushMessage {
  to: string;
  title?: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
  priority?: "default" | "normal" | "high";
  ttl?: number;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoPushReceipt {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

// 5.1: Send push notification via Expo Push API
export const sendPush = internalAction({
  args: {
    tokens: v.array(v.string()),
    title: v.optional(v.string()),
    body: v.string(),
    data: v.optional(jsonRecordValidator),
    badge: v.optional(v.number()),
    sound: v.optional(v.boolean()),
    priority: v.optional(v.union(v.literal("default"), v.literal("normal"), v.literal("high"))),
  },
  handler: async (ctx, args) => {
    if (args.tokens.length === 0) {
      return { success: true, sent: 0, tickets: [] };
    }

    const messages: ExpoPushMessage[] = args.tokens.map((token) => ({
      to: token,
      title: args.title,
      body: args.body,
      data: args.data,
      sound: args.sound !== false ? "default" : null,
      badge: args.badge,
      priority: args.priority || "high",
    }));

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Push] Expo API error:", errorText);
        return { success: false, error: errorText, sent: 0, tickets: [] };
      }

      const result = await response.json();
      const tickets: ExpoPushTicket[] = result.data || [];
      const mappedTickets = tickets.map((ticket, index) => {
        const errorCode = ticket.details?.error;
        const error =
          ticket.status === "error"
            ? errorCode
              ? `${errorCode}${ticket.message ? `: ${ticket.message}` : ""}`
              : (ticket.message ?? "Unknown error")
            : undefined;
        return {
          status: ticket.status,
          id: ticket.id,
          error,
          errorCode,
          token: args.tokens[index],
        };
      });

      // Count successful sends
      const successCount = mappedTickets.filter((t) => t.status === "ok").length;

      // Log errors
      mappedTickets.forEach((ticket) => {
        if (ticket.status === "error") {
          console.error(`[Push] Failed to send to ${ticket.token}:`, ticket.error);
        }
      });

      const failedTickets = mappedTickets.filter((ticket) => ticket.status === "error");
      if (failedTickets.length > 0) {
        await Promise.all(
          failedTickets.map(async (ticket) => {
            const removeToken = ticket.errorCode
              ? EXPO_REMOVE_TOKEN_ERRORS.has(ticket.errorCode)
              : EXPO_REMOVE_TOKEN_ERRORS.has((ticket.error ?? "").split(":")[0] ?? "");

            await Promise.allSettled([
              ctx.runMutation(internal.pushTokens.recordDeliveryFailure, {
                token: ticket.token,
                error: ticket.error ?? "Unknown error",
                removeToken,
              }),
              ctx.runMutation(internal.visitorPushTokens.recordDeliveryFailure, {
                token: ticket.token,
                error: ticket.error ?? "Unknown error",
                removeToken,
              }),
            ]);
          })
        );
      }

      return {
        success: true,
        sent: successCount,
        failed: mappedTickets.length - successCount,
        tickets: mappedTickets,
      };
    } catch (error) {
      console.error("[Push] Failed to send push notifications:", error);
      return { success: false, error: String(error), sent: 0, tickets: [] };
    }
  },
});

// 5.3: Check push receipts for delivery status
export const checkReceipts = internalAction({
  args: {
    ticketIds: v.array(v.string()),
  },
  handler: async (_ctx, args) => {
    if (args.ticketIds.length === 0) {
      return { receipts: [] };
    }

    try {
      const response = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ ids: args.ticketIds }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Push] Failed to get receipts:", errorText);
        return { success: false, error: errorText, receipts: [] };
      }

      const result = await response.json();
      const receipts: Record<string, ExpoPushReceipt> = result.data || {};

      return {
        success: true,
        receipts: Object.entries(receipts).map(([id, receipt]) => ({
          id,
          status: receipt.status,
          error: receipt.message,
        })),
      };
    } catch (error) {
      console.error("[Push] Failed to check receipts:", error);
      return { success: false, error: String(error), receipts: [] };
    }
  },
});

// Send push to specific visitors
export const sendToVisitors = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    visitorIds: v.array(v.id("visitors")),
    title: v.optional(v.string()),
    body: v.string(),
    data: v.optional(jsonRecordValidator),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    sent: number;
    message?: string;
    failed?: number;
    error?: string;
    tickets?: Array<{ status: string; id?: string; error?: string }>;
  }> => {
    // Get tokens for specified visitors
    const tokens: string[] = await ctx.runQuery(internal.push.getTokensForVisitors, {
      workspaceId: args.workspaceId,
      visitorIds: args.visitorIds,
    });

    if (tokens.length === 0) {
      return { success: true, sent: 0, message: "No push tokens found for visitors" };
    }

    return await ctx.runAction(internal.push.sendPush, {
      tokens,
      title: args.title,
      body: args.body,
      data: args.data,
    });
  },
});

// Send push to all visitors in workspace
export const sendToWorkspace = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.optional(v.string()),
    body: v.string(),
    data: v.optional(jsonRecordValidator),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    sent: number;
    message?: string;
    failed?: number;
    error?: string;
    tickets?: Array<{ status: string; id?: string; error?: string }>;
  }> => {
    const tokens: string[] = await ctx.runQuery(internal.push.getTokensForWorkspace, {
      workspaceId: args.workspaceId,
    });

    if (tokens.length === 0) {
      return { success: true, sent: 0, message: "No push tokens found in workspace" };
    }

    return await ctx.runAction(internal.push.sendPush, {
      tokens,
      title: args.title,
      body: args.body,
      data: args.data,
    });
  },
});

// Send push notification for new message
export const notifyNewMessage = internalAction({
  args: {
    conversationId: v.id("conversations"),
    messageBody: v.string(),
    senderName: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    sent?: number;
    message?: string;
    failed?: number;
    error?: string;
    tickets?: Array<{ status: string; id?: string; error?: string }>;
  }> => {
    // Get conversation to find visitor
    const conversation: Doc<"conversations"> | null = await ctx.runQuery(
      internal.push.getConversation,
      {
        conversationId: args.conversationId,
      }
    );

    if (!conversation || !conversation.visitorId) {
      return { success: false, error: "Conversation or visitor not found" };
    }

    // Get visitor's push tokens
    const tokens: string[] = await ctx.runQuery(internal.push.getTokensForVisitor, {
      visitorId: conversation.visitorId,
    });

    if (tokens.length === 0) {
      return { success: true, sent: 0, message: "Visitor has no push tokens" };
    }

    return await ctx.runAction(internal.push.sendPush, {
      tokens,
      title: args.senderName || "New message",
      body: args.messageBody,
      data: {
        type: "new_message",
        conversationId: args.conversationId,
      },
    });
  },
});

// Internal queries for getting tokens
export const getTokensForVisitors = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    visitorIds: v.array(v.id("visitors")),
  },
  handler: async (ctx, args) => {
    const visitorIdSet = new Set(args.visitorIds);
    const allTokens = await ctx.db
      .query("visitorPushTokens")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return allTokens
      .filter((t) => visitorIdSet.has(t.visitorId) && t.notificationsEnabled !== false)
      .map((t) => t.token);
  },
});

export const getTokensForWorkspace = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const tokens = await ctx.db
      .query("visitorPushTokens")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return tokens
      .filter((token) => token.notificationsEnabled !== false)
      .map((token) => token.token);
  },
});

export const getTokensForVisitor = internalQuery({
  args: {
    visitorId: v.id("visitors"),
  },
  handler: async (ctx, args) => {
    const tokens = await ctx.db
      .query("visitorPushTokens")
      .withIndex("by_visitor", (q) => q.eq("visitorId", args.visitorId))
      .collect();

    return tokens
      .filter((token) => token.notificationsEnabled !== false)
      .map((token) => token.token);
  },
});

export const getConversation = internalQuery({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.conversationId);
  },
});

// 5.5: Send push with targeting by user attributes
export const sendWithTargeting = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.optional(v.string()),
    body: v.string(),
    data: v.optional(jsonRecordValidator),
    targeting: v.optional(
      v.object({
        hasEmail: v.optional(v.boolean()),
        hasExternalUserId: v.optional(v.boolean()),
        customAttribute: v.optional(
          v.object({
            key: v.string(),
            value: jsonValueValidator,
          })
        ),
      })
    ),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    sent: number;
    message?: string;
    failed?: number;
    error?: string;
    tickets?: Array<{ status: string; id?: string; error?: string }>;
  }> => {
    // Get all visitors with push tokens in workspace
    const eligibleVisitors: Array<import("./_generated/dataModel").Id<"visitors">> =
      await ctx.runQuery(internal.push.getEligibleVisitors, {
        workspaceId: args.workspaceId,
        targeting: args.targeting,
      });

    if (eligibleVisitors.length === 0) {
      return { success: true, sent: 0, message: "No eligible visitors found" };
    }

    // Get tokens for eligible visitors
    const tokens: string[] = await ctx.runQuery(internal.push.getTokensForVisitors, {
      workspaceId: args.workspaceId,
      visitorIds: eligibleVisitors,
    });

    if (tokens.length === 0) {
      return { success: true, sent: 0, message: "No push tokens found for eligible visitors" };
    }

    return await ctx.runAction(internal.push.sendPush, {
      tokens,
      title: args.title,
      body: args.body,
      data: args.data,
    });
  },
});

export const getEligibleVisitors = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    targeting: v.optional(
      v.object({
        hasEmail: v.optional(v.boolean()),
        hasExternalUserId: v.optional(v.boolean()),
        customAttribute: v.optional(
          v.object({
            key: v.string(),
            value: jsonValueValidator,
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Get all visitors with push tokens
    const pushTokens = await ctx.db
      .query("visitorPushTokens")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const visitorIds = [...new Set(pushTokens.map((t) => t.visitorId))];

    if (!args.targeting) {
      return visitorIds;
    }

    // Filter by targeting criteria
    const eligibleIds: typeof visitorIds = [];

    for (const visitorId of visitorIds) {
      const visitor = (await ctx.db.get(visitorId)) as Doc<"visitors"> | null;
      if (!visitor) continue;

      let matches = true;

      if (args.targeting.hasEmail !== undefined) {
        const hasEmail = !!visitor.email;
        if (args.targeting.hasEmail !== hasEmail) matches = false;
      }

      if (args.targeting.hasExternalUserId !== undefined) {
        const hasExternalId = !!visitor.externalUserId;
        if (args.targeting.hasExternalUserId !== hasExternalId) matches = false;
      }

      if (args.targeting.customAttribute) {
        const attrs = visitor.customAttributes as Record<string, unknown> | undefined;
        const attrValue = attrs?.[args.targeting.customAttribute.key];
        if (attrValue !== args.targeting.customAttribute.value) matches = false;
      }

      if (matches) {
        eligibleIds.push(visitorId);
      }
    }

    return eligibleIds;
  },
});

// Push notification log for tracking
export const logPushNotification = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.optional(v.string()),
    body: v.string(),
    recipientCount: v.number(),
    successCount: v.number(),
    failedCount: v.number(),
    campaignId: v.optional(v.id("campaigns")),
  },
  handler: async (_ctx, args) => {
    // Retain lightweight console logging until a dedicated push log table is
    // introduced with query/reporting requirements.
    console.log("[Push] Notification sent:", {
      workspaceId: args.workspaceId,
      title: args.title,
      body: args.body.substring(0, 50),
      recipients: args.recipientCount,
      success: args.successCount,
      failed: args.failedCount,
    });
  },
});
