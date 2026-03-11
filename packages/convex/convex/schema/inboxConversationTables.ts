import { defineTable } from "convex/server";
import { v } from "convex/values";
import { customAttributesValidator } from "../validators";

export const inboxConversationTables = {
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
};
