import { defineTable } from "convex/server";
import { v } from "convex/values";
import { CONTENT_EMBEDDING_INDEX_DIMENSIONS } from "../lib/embeddingModels";

export const operationsAiTables = {
  aiAgentSettings: defineTable({
    workspaceId: v.id("workspaces"),
    enabled: v.boolean(),
    knowledgeSources: v.array(
      v.union(v.literal("articles"), v.literal("internalArticles"), v.literal("snippets"))
    ),
    confidenceThreshold: v.number(),
    personality: v.optional(v.string()),
    handoffMessage: v.optional(v.string()),
    workingHours: v.optional(
      v.object({
        start: v.string(),
        end: v.string(),
        timezone: v.string(),
      })
    ),
    model: v.string(),
    suggestionsEnabled: v.optional(v.boolean()),
    embeddingModel: v.optional(v.string()),
    lastConfigError: v.optional(
      v.object({
        code: v.string(),
        message: v.string(),
        provider: v.optional(v.string()),
        model: v.optional(v.string()),
        detectedAt: v.number(),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  contentEmbeddings: defineTable({
    workspaceId: v.id("workspaces"),
    contentType: v.union(v.literal("article"), v.literal("internalArticle"), v.literal("snippet")),
    contentId: v.string(),
    embedding: v.array(v.float64()),
    textHash: v.string(),
    title: v.string(),
    snippet: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_content", ["contentType", "contentId"])
    .index("by_workspace", ["workspaceId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: CONTENT_EMBEDDING_INDEX_DIMENSIONS,
      filterFields: ["workspaceId", "contentType"],
    }),

  suggestionFeedback: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    contentType: v.union(v.literal("article"), v.literal("internalArticle"), v.literal("snippet")),
    contentId: v.string(),
    action: v.union(v.literal("used"), v.literal("dismissed")),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_created_at", ["workspaceId", "createdAt"])
    .index("by_user", ["userId"])
    .index("by_conversation", ["conversationId"])
    .index("by_content", ["contentType", "contentId"]),
};
