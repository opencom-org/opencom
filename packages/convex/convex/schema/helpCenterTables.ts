import { defineTable } from "convex/server";
import { v } from "convex/values";
import { audienceRulesValidator } from "../validators";

export const helpCenterTables = {
  collections: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    parentId: v.optional(v.id("collections")),
    importSourceId: v.optional(v.id("helpCenterImportSources")),
    importPath: v.optional(v.string()),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_slug", ["workspaceId", "slug"])
    .index("by_parent", ["workspaceId", "parentId"])
    .index("by_workspace_import_source", ["workspaceId", "importSourceId"])
    .index("by_import_source_path", ["importSourceId", "importPath"]),

  // Help Center - Articles
  articles: defineTable({
    workspaceId: v.id("workspaces"),
    collectionId: v.optional(v.id("collections")),
    folderId: v.optional(v.id("contentFolders")),
    title: v.string(),
    slug: v.string(),
    content: v.string(),
    widgetLargeScreen: v.optional(v.boolean()),
    status: v.union(v.literal("draft"), v.literal("published")),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    publishedAt: v.optional(v.number()),
    authorId: v.optional(v.id("users")),
    audienceRules: v.optional(audienceRulesValidator),
    importSourceId: v.optional(v.id("helpCenterImportSources")),
    importPath: v.optional(v.string()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_collection", ["collectionId"])
    .index("by_folder", ["folderId"])
    .index("by_slug", ["workspaceId", "slug"])
    .index("by_status", ["workspaceId", "status"])
    .index("by_workspace_import_source", ["workspaceId", "importSourceId"])
    .index("by_import_source_path", ["importSourceId", "importPath"]),

  // Help Center - Article Assets
  articleAssets: defineTable({
    workspaceId: v.id("workspaces"),
    articleId: v.optional(v.id("articles")),
    importSourceId: v.optional(v.id("helpCenterImportSources")),
    importPath: v.optional(v.string()),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
    createdBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_article", ["articleId"])
    .index("by_workspace_article", ["workspaceId", "articleId"])
    .index("by_import_source", ["importSourceId"])
    .index("by_import_source_path", ["importSourceId", "importPath"]),

  // Help Center - Import Sources
  helpCenterImportSources: defineTable({
    workspaceId: v.id("workspaces"),
    sourceKey: v.string(),
    sourceName: v.string(),
    rootCollectionId: v.optional(v.id("collections")),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastImportedAt: v.optional(v.number()),
    lastImportRunId: v.optional(v.string()),
    lastImportedFileCount: v.optional(v.number()),
    lastImportedCollectionCount: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_source_key", ["workspaceId", "sourceKey"])
    .index("by_workspace_updated_at", ["workspaceId", "updatedAt"]),

  // Help Center - Import Deletion History
  helpCenterImportArchives: defineTable({
    workspaceId: v.id("workspaces"),
    sourceId: v.id("helpCenterImportSources"),
    importRunId: v.string(),
    entityType: v.union(v.literal("article"), v.literal("collection")),
    importPath: v.string(),
    parentPath: v.optional(v.string()),
    name: v.string(),
    content: v.optional(v.string()),
    status: v.optional(v.union(v.literal("draft"), v.literal("published"))),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    deletedAt: v.number(),
    restoredAt: v.optional(v.number()),
  })
    .index("by_workspace_deleted_at", ["workspaceId", "deletedAt"])
    .index("by_workspace_source", ["workspaceId", "sourceId"])
    .index("by_workspace_source_run", ["workspaceId", "sourceId", "importRunId"]),

  // Help Center - Article Feedback
  articleFeedback: defineTable({
    articleId: v.id("articles"),
    helpful: v.boolean(),
    visitorId: v.optional(v.id("visitors")),
    createdAt: v.number(),
  }).index("by_article", ["articleId"]),

  // Snippets (Saved Replies)
  snippets: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    content: v.string(),
    shortcut: v.optional(v.string()),
    folderId: v.optional(v.id("contentFolders")),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.id("users")),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_shortcut", ["workspaceId", "shortcut"])
    .index("by_folder", ["folderId"]),
};
