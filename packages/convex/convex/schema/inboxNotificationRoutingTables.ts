import { defineTable } from "convex/server";
import { v } from "convex/values";
import { jsonRecordValidator } from "../validators";

const messageNotificationChannelPreferenceValidator = v.object({
  email: v.optional(v.boolean()),
  push: v.optional(v.boolean()),
});

const messageNotificationEventsValidator = v.object({
  newVisitorMessage: v.optional(messageNotificationChannelPreferenceValidator),
});

export const inboxNotificationRoutingTables = {
  notificationPreferences: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    muted: v.boolean(),
    events: v.optional(messageNotificationEventsValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_workspace", ["userId", "workspaceId"]),

  workspaceNotificationDefaults: defineTable({
    workspaceId: v.id("workspaces"),
    events: v.optional(messageNotificationEventsValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  notificationEvents: defineTable({
    workspaceId: v.id("workspaces"),
    eventKey: v.string(),
    eventType: v.union(
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
    ),
    domain: v.union(
      v.literal("chat"),
      v.literal("ticket"),
      v.literal("outbound"),
      v.literal("campaign")
    ),
    audience: v.union(v.literal("agent"), v.literal("visitor"), v.literal("both")),
    actorType: v.union(
      v.literal("agent"),
      v.literal("visitor"),
      v.literal("bot"),
      v.literal("system")
    ),
    actorUserId: v.optional(v.id("users")),
    actorVisitorId: v.optional(v.id("visitors")),
    conversationId: v.optional(v.id("conversations")),
    ticketId: v.optional(v.id("tickets")),
    outboundMessageId: v.optional(v.id("outboundMessages")),
    campaignId: v.optional(v.id("pushCampaigns")),
    title: v.optional(v.string()),
    bodyPreview: v.optional(v.string()),
    data: v.optional(jsonRecordValidator),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_created_at", ["workspaceId", "createdAt"])
    .index("by_event_key", ["eventKey"]),

  notificationDedupeKeys: defineTable({
    dedupeKey: v.string(),
    eventId: v.id("notificationEvents"),
    eventKey: v.string(),
    workspaceId: v.id("workspaces"),
    channel: v.union(v.literal("push"), v.literal("email"), v.literal("web"), v.literal("widget")),
    recipientType: v.union(v.literal("agent"), v.literal("visitor")),
    userId: v.optional(v.id("users")),
    visitorId: v.optional(v.id("visitors")),
    createdAt: v.number(),
  })
    .index("by_dedupe_key", ["dedupeKey"])
    .index("by_event", ["eventId"])
    .index("by_workspace", ["workspaceId"]),

  notificationDeliveries: defineTable({
    workspaceId: v.id("workspaces"),
    eventId: v.optional(v.id("notificationEvents")),
    eventKey: v.string(),
    dedupeKey: v.string(),
    channel: v.union(v.literal("push"), v.literal("email"), v.literal("web"), v.literal("widget")),
    recipientType: v.union(v.literal("agent"), v.literal("visitor")),
    userId: v.optional(v.id("users")),
    visitorId: v.optional(v.id("visitors")),
    tokenCount: v.optional(v.number()),
    status: v.union(v.literal("delivered"), v.literal("suppressed"), v.literal("failed")),
    reason: v.optional(v.string()),
    error: v.optional(v.string()),
    metadata: v.optional(jsonRecordValidator),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_created_at", ["workspaceId", "createdAt"])
    .index("by_event", ["eventId"])
    .index("by_dedupe_key", ["dedupeKey"]),
};
