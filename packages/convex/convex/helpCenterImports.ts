import { v } from "convex/values";
import { authMutation, authQuery } from "./lib/authWrappers";
import { runExportMarkdown } from "./helpCenterImports/exportPipeline";
import { runRestoreRun } from "./helpCenterImports/restorePipeline";
import { runListHistory, runListSources } from "./helpCenterImports/sourceQueries";
import { runSyncMarkdownFolder } from "./helpCenterImports/syncPipeline";

const markdownFileValidator = v.object({
  relativePath: v.string(),
  content: v.string(),
});

const importAssetValidator = v.object({
  relativePath: v.string(),
  storageId: v.optional(v.id("_storage")),
  mimeType: v.optional(v.string()),
  size: v.optional(v.number()),
});

export const syncMarkdownFolder = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    sourceKey: v.optional(v.string()),
    sourceName: v.string(),
    rootCollectionId: v.optional(v.id("collections")),
    files: v.array(markdownFileValidator),
    assets: v.optional(v.array(importAssetValidator)),
    publishByDefault: v.optional(v.boolean()),
    dryRun: v.optional(v.boolean()),
  },
  permission: "articles.create",
  handler: runSyncMarkdownFolder,
});

export const listSources = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  permission: "articles.read",
  handler: runListSources,
});

export const listHistory = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    sourceId: v.optional(v.id("helpCenterImportSources")),
    limit: v.optional(v.number()),
  },
  permission: "articles.read",
  handler: runListHistory,
});

export const exportMarkdown = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    sourceId: v.optional(v.id("helpCenterImportSources")),
    rootCollectionId: v.optional(v.id("collections")),
    includeDrafts: v.optional(v.boolean()),
  },
  permission: "data.export",
  handler: runExportMarkdown,
});

export const restoreRun = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    sourceId: v.id("helpCenterImportSources"),
    importRunId: v.string(),
  },
  permission: "articles.create",
  handler: runRestoreRun,
});
