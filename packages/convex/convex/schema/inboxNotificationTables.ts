import { defineTable } from "convex/server";
import { v } from "convex/values";
import { customAttributesValidator, jsonRecordValidator } from "../validators";

const messageNotificationChannelPreferenceValidator = v.object({
  email: v.optional(v.boolean()),
  push: v.optional(v.boolean()),
});

const messageNotificationEventsValidator = v.object({
  newVisitorMessage: v.optional(messageNotificationChannelPreferenceValidator),
});

export const inboxNotificationTables = {
  visitors: defineTable({
    sessionId: v.string(),
    userId: v.optional(v.id("users")),
    workspaceId: v.id("workspaces"),
    readableId: v.optional(v.string()),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    externalUserId: v.optional(v.string()),
    location: v.optional(
      v.object({
        city: v.optional(v.string()),
        region: v.optional(v.string()),
        country: v.optional(v.string()),
        countryCode: v.optional(v.string()),
      })
    ),
    device: v.optional(
      v.object({
        browser: v.optional(v.string()),
        os: v.optional(v.string()),
        deviceType: v.optional(v.string()),
        platform: v.optional(v.string()),
      })
    ),
    referrer: v.optional(v.string()),
    currentUrl: v.optional(v.string()),
    customAttributes: v.optional(customAttributesValidator),
    firstSeenAt: v.optional(v.number()),
    lastSeenAt: v.optional(v.number()),
    createdAt: v.number(),
    // Identity verification fields
    identityVerified: v.optional(v.boolean()),
    identityVerifiedAt: v.optional(v.number()),
  })
    .index("by_session", ["sessionId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_last_seen", ["workspaceId", "lastSeenAt"])
    .index("by_workspace_readable_id", ["workspaceId", "readableId"])
    .index("by_email", ["workspaceId", "email"])
    .index("by_external_user_id", ["workspaceId", "externalUserId"])
    .searchIndex("search_visitors", {
      searchField: "name",
      filterFields: ["workspaceId"],
    }),

  // Widget Sessions (signed session tokens for visitor auth)
  widgetSessions: defineTable({
    token: v.string(),
    visitorId: v.id("visitors"),
    workspaceId: v.id("workspaces"),
    identityVerified: v.boolean(),
    clientType: v.optional(v.string()),
    clientVersion: v.optional(v.string()),
    clientIdentifier: v.optional(v.string()),
    origin: v.optional(v.string()),
    currentUrl: v.optional(v.string()),
    devicePlatform: v.optional(v.string()),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_visitor", ["visitorId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_expires", ["expiresAt"]),

  conversations: defineTable({
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    userId: v.optional(v.id("users")),
    assignedAgentId: v.optional(v.id("users")),
    status: v.union(v.literal("open"), v.literal("closed"), v.literal("snoozed")),
    channel: v.optional(v.union(v.literal("chat"), v.literal("email"))),
    subject: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastMessageAt: v.optional(v.number()),
    unreadByAgent: v.optional(v.number()),
    unreadByVisitor: v.optional(v.number()),
    firstResponseAt: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
    csatCompletedAt: v.optional(v.number()),
    csatResponseId: v.optional(v.id("csatResponses")),
    aiWorkflowState: v.optional(
      v.union(v.literal("none"), v.literal("ai_handled"), v.literal("handoff"))
    ),
    aiHandoffReason: v.optional(v.string()),
    aiLastConfidence: v.optional(v.number()),
    aiLastResponseAt: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_visitor", ["visitorId"])
    .index("by_status", ["workspaceId", "status"])
    .index("by_last_message", ["workspaceId", "lastMessageAt"])
    .index("by_channel", ["workspaceId", "channel"])
    .index("by_workspace_ai_state", ["workspaceId", "aiWorkflowState"])
    .index("by_workspace_ai_state_status", ["workspaceId", "aiWorkflowState", "status"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.string(),
    senderType: v.union(
      v.literal("user"),
      v.literal("visitor"),
      v.literal("agent"),
      v.literal("bot")
    ),
    content: v.string(),
    channel: v.optional(v.union(v.literal("chat"), v.literal("email"))),
    emailMetadata: v.optional(
      v.object({
        subject: v.optional(v.string()),
        from: v.optional(v.string()),
        to: v.optional(v.array(v.string())),
        cc: v.optional(v.array(v.string())),
        bcc: v.optional(v.array(v.string())),
        messageId: v.optional(v.string()),
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
      })
    ),
    deliveryStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("sent"),
        v.literal("delivered"),
        v.literal("bounced"),
        v.literal("failed")
      )
    ),
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_email_message_id", ["emailMetadata.messageId"]),

  pushTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    platform: v.union(v.literal("ios"), v.literal("android")),
    notificationsEnabled: v.optional(v.boolean()),
    failureCount: v.optional(v.number()),
    lastFailureAt: v.optional(v.number()),
    lastFailureReason: v.optional(v.string()),
    disabledAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_token", ["token"]),

  // Visitor Push Tokens (for Mobile SDK)
  visitorPushTokens: defineTable({
    visitorId: v.id("visitors"),
    workspaceId: v.id("workspaces"),
    token: v.string(),
    platform: v.union(v.literal("ios"), v.literal("android")),
    deviceId: v.optional(v.string()),
    notificationsEnabled: v.optional(v.boolean()),
    failureCount: v.optional(v.number()),
    lastFailureAt: v.optional(v.number()),
    lastFailureReason: v.optional(v.string()),
    disabledAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_visitor", ["visitorId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_updated_at", ["workspaceId", "updatedAt"])
    .index("by_token", ["token"]),

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
