import { defineTable } from "convex/server";
import { v } from "convex/values";

export const operationsWorkflowTables = {
  automationSettings: defineTable({
    workspaceId: v.id("workspaces"),
    suggestArticlesEnabled: v.boolean(),
    showReplyTimeEnabled: v.boolean(),
    collectEmailEnabled: v.boolean(),
    askForRatingEnabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  assignmentRules: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    priority: v.number(),
    enabled: v.boolean(),
    conditions: v.array(
      v.object({
        field: v.union(
          v.literal("visitor.email"),
          v.literal("visitor.name"),
          v.literal("visitor.country"),
          v.literal("visitor.customAttributes"),
          v.literal("conversation.channel"),
          v.literal("conversation.source"),
          v.literal("message.content")
        ),
        operator: v.union(
          v.literal("equals"),
          v.literal("not_equals"),
          v.literal("contains"),
          v.literal("not_contains"),
          v.literal("starts_with"),
          v.literal("ends_with"),
          v.literal("is_set"),
          v.literal("is_not_set")
        ),
        value: v.optional(v.string()),
        attributeKey: v.optional(v.string()),
      })
    ),
    action: v.object({
      type: v.union(v.literal("assign_user"), v.literal("assign_team")),
      userId: v.optional(v.id("users")),
      teamId: v.optional(v.string()),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_priority", ["workspaceId", "priority"]),

  tags: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    color: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_name", ["workspaceId", "name"]),

  conversationTags: defineTable({
    conversationId: v.id("conversations"),
    tagId: v.id("tags"),
    appliedBy: v.optional(v.union(v.literal("manual"), v.literal("auto"))),
    appliedByUserId: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_tag", ["tagId"])
    .index("by_conversation_tag", ["conversationId", "tagId"]),

  autoTagRules: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    enabled: v.boolean(),
    conditions: v.array(
      v.object({
        field: v.union(
          v.literal("visitor.email"),
          v.literal("visitor.name"),
          v.literal("visitor.country"),
          v.literal("visitor.customAttributes"),
          v.literal("conversation.channel"),
          v.literal("message.content")
        ),
        operator: v.union(
          v.literal("equals"),
          v.literal("not_equals"),
          v.literal("contains"),
          v.literal("not_contains"),
          v.literal("starts_with"),
          v.literal("ends_with"),
          v.literal("is_set"),
          v.literal("is_not_set")
        ),
        value: v.optional(v.string()),
        attributeKey: v.optional(v.string()),
      })
    ),
    tagId: v.id("tags"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  commonIssueButtons: defineTable({
    workspaceId: v.id("workspaces"),
    label: v.string(),
    action: v.union(v.literal("article"), v.literal("start_conversation")),
    articleId: v.optional(v.id("articles")),
    conversationStarter: v.optional(v.string()),
    order: v.number(),
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_order", ["workspaceId", "order"]),

  officeHours: defineTable({
    workspaceId: v.id("workspaces"),
    timezone: v.string(),
    schedule: v.array(
      v.object({
        day: v.union(
          v.literal("monday"),
          v.literal("tuesday"),
          v.literal("wednesday"),
          v.literal("thursday"),
          v.literal("friday"),
          v.literal("saturday"),
          v.literal("sunday")
        ),
        enabled: v.boolean(),
        startTime: v.string(),
        endTime: v.string(),
      })
    ),
    offlineMessage: v.optional(v.string()),
    expectedReplyTimeMinutes: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),
};
