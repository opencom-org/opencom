import { defineTable } from "convex/server";
import { v } from "convex/values";

export const automationTables = {
  automationCredentials: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    secretHash: v.string(),
    secretPrefix: v.string(), // first 8 chars for identification
    scopes: v.array(v.string()),
    status: v.union(v.literal("active"), v.literal("disabled"), v.literal("expired")),
    expiresAt: v.optional(v.number()),
    actorName: v.string(),
    lastUsedAt: v.optional(v.number()),
    rateLimitCount: v.optional(v.number()),
    rateLimitWindowStart: v.optional(v.number()),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_secret_hash", ["secretHash"])
    .index("by_workspace_status", ["workspaceId", "status"]),

  automationEvents: defineTable({
    workspaceId: v.id("workspaces"),
    eventType: v.string(),
    resourceType: v.string(),
    resourceId: v.string(),
    data: v.any(),
    timestamp: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_timestamp", ["workspaceId", "timestamp"]),

  automationWebhookSubscriptions: defineTable({
    workspaceId: v.id("workspaces"),
    url: v.string(),
    signingSecret: v.optional(v.string()), // legacy plaintext retained only for backfill compatibility
    signingSecretCiphertext: v.optional(v.string()), // AES-GCM encrypted at rest
    signingSecretPrefix: v.string(),
    eventTypes: v.optional(v.array(v.string())),
    resourceTypes: v.optional(v.array(v.string())),
    channels: v.optional(v.array(v.string())),
    aiWorkflowStates: v.optional(v.array(v.string())),
    status: v.union(v.literal("active"), v.literal("paused"), v.literal("disabled")),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_status", ["workspaceId", "status"]),

  automationWebhookDeliveries: defineTable({
    workspaceId: v.id("workspaces"),
    subscriptionId: v.id("automationWebhookSubscriptions"),
    eventId: v.id("automationEvents"),
    attemptNumber: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("retrying")
    ),
    httpStatus: v.optional(v.number()),
    error: v.optional(v.string()),
    nextRetryAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_subscription", ["subscriptionId"])
    .index("by_subscription_event", ["subscriptionId", "eventId"])
    .index("by_event", ["eventId"])
    .index("by_status", ["status"])
    .index("by_next_retry", ["status", "nextRetryAt"]),

  automationConversationClaims: defineTable({
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    credentialId: v.id("automationCredentials"),
    status: v.union(
      v.literal("active"),
      v.literal("released"),
      v.literal("expired"),
      v.literal("escalated")
    ),
    expiresAt: v.number(),
    releasedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_status", ["conversationId", "status"])
    .index("by_credential", ["credentialId"])
    .index("by_expires", ["status", "expiresAt"]),

  automationIdempotencyKeys: defineTable({
    workspaceId: v.id("workspaces"),
    key: v.string(),
    credentialId: v.id("automationCredentials"),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    responseSnapshot: v.optional(v.any()),
    expiresAt: v.number(),
  })
    .index("by_workspace_key", ["workspaceId", "key"])
    .index("by_expires", ["expiresAt"]),

  automationWorkspaceRateLimits: defineTable({
    workspaceId: v.id("workspaces"),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_workspace", ["workspaceId"]),
};
