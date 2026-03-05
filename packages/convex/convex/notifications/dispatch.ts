import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { jsonRecordValidator } from "../validators";
import { sendEmail } from "../email";
import { notificationChannelValidator, notificationRecipientTypeValidator } from "./contracts";

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
