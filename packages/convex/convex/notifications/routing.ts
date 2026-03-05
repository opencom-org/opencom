import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { jsonRecordValidator } from "../validators";
import {
  resolveMemberNewVisitorMessagePreference,
  resolveWorkspaceNewVisitorMessageDefaults,
} from "../lib/notificationPreferences";
import {
  notificationActorTypeValidator,
  notificationAudienceValidator,
  notificationDomainValidator,
  notificationEventTypeValidator,
  NotificationPushAttempt,
} from "./contracts";
import { buildDefaultEventKey, truncatePreview } from "./helpers";
import { resolveDefaultVisitorRecipients } from "./recipients";

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
