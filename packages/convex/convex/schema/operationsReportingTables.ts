import { defineTable } from "convex/server";
import { v } from "convex/values";
import { jsonRecordValidator } from "../validators";

export const operationsReportingTables = {
  aiResponses: defineTable({
    conversationId: v.id("conversations"),
    messageId: v.optional(v.id("messages")),
    query: v.string(),
    response: v.string(),
    generatedCandidateResponse: v.optional(v.string()),
    generatedCandidateSources: v.optional(
      v.array(
        v.object({
          type: v.string(),
          id: v.string(),
          title: v.string(),
          articleId: v.optional(v.string()),
        })
      )
    ),
    generatedCandidateConfidence: v.optional(v.number()),
    sources: v.array(
      v.object({
        type: v.string(),
        id: v.string(),
        title: v.string(),
        articleId: v.optional(v.string()),
      })
    ),
    attemptStatus: v.optional(v.string()),
    confidence: v.number(),
    feedback: v.optional(v.union(v.literal("helpful"), v.literal("not_helpful"))),
    handedOff: v.boolean(),
    handoffReason: v.optional(v.string()),
    generationTimeMs: v.number(),
    tokensUsed: v.optional(v.number()),
    model: v.string(),
    provider: v.string(),
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_message", ["messageId"])
    .index("by_feedback", ["feedback"]),

  csatResponses: defineTable({
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    visitorId: v.optional(v.id("visitors")),
    agentId: v.optional(v.id("users")),
    rating: v.number(),
    feedback: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_conversation", ["conversationId"])
    .index("by_agent", ["workspaceId", "agentId"])
    .index("by_created", ["workspaceId", "createdAt"]),

  reportSnapshots: defineTable({
    workspaceId: v.id("workspaces"),
    reportType: v.union(
      v.literal("conversations"),
      v.literal("agents"),
      v.literal("csat"),
      v.literal("ai_agent")
    ),
    periodStart: v.number(),
    periodEnd: v.number(),
    granularity: v.union(v.literal("day"), v.literal("week"), v.literal("month")),
    metrics: jsonRecordValidator,
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_type", ["workspaceId", "reportType"])
    .index("by_workspace_period", ["workspaceId", "periodStart", "periodEnd"]),

  auditLogs: defineTable({
    workspaceId: v.id("workspaces"),
    actorId: v.optional(v.id("users")),
    actorType: v.union(v.literal("user"), v.literal("system"), v.literal("api")),
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    metadata: v.optional(jsonRecordValidator),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_action", ["workspaceId", "action"])
    .index("by_workspace_timestamp", ["workspaceId", "timestamp"])
    .index("by_actor", ["actorId"]),

  auditLogWriteFailures: defineTable({
    workspaceId: v.id("workspaces"),
    actorId: v.optional(v.id("users")),
    actorType: v.union(v.literal("user"), v.literal("system"), v.literal("api")),
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    metadata: v.optional(jsonRecordValidator),
    error: v.string(),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_created", ["workspaceId", "createdAt"]),

  auditLogSettings: defineTable({
    workspaceId: v.id("workspaces"),
    retentionDays: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),
};
