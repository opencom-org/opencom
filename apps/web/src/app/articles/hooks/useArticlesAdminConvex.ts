"use client";

import type { Id } from "@opencom/convex/dataModel";
import {
  useWebAction,
  useWebMutation,
  useWebQuery,
  webActionRef,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";
import type {
  ArticleEditorId,
  ArticleListItem,
  CollectionListItem,
  ImportHistoryListItem,
  ImportSourceListItem,
  MarkdownExportPayload,
  MarkdownImportPreview,
} from "../articlesAdminTypes";

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type ImportHistoryArgs = WorkspaceArgs & {
  limit: number;
};

type ExportMarkdownArgs = WorkspaceArgs & {
  sourceId: Id<"helpCenterImportSources"> | undefined;
  includeDrafts: boolean;
};

type CreateArticleArgs = WorkspaceArgs & {
  title: string;
  content: string;
  visibility: "public" | "internal";
};

type DeleteArticleArgs = {
  id: ArticleEditorId;
};

type SyncMarkdownFilePayload = {
  relativePath: string;
  content: string;
};

type SyncMarkdownAssetPayload = {
  relativePath: string;
  storageId?: Id<"_storage">;
  mimeType?: string;
  size?: number;
};

type SyncMarkdownFolderArgs = WorkspaceArgs & {
  sourceName: string;
  rootCollectionId?: Id<"collections">;
  files: SyncMarkdownFilePayload[];
  assets: SyncMarkdownAssetPayload[];
  publishByDefault: boolean;
  dryRun?: boolean;
};

type RestoreImportRunArgs = WorkspaceArgs & {
  sourceId: Id<"helpCenterImportSources">;
  importRunId: string;
};

type RestoreImportRunResult = {
  restoredArticles: number;
  restoredCollections: number;
  sourceName?: string;
};

type GenerateAssetUploadUrlArgs = WorkspaceArgs;

type LogExportArgs = WorkspaceArgs & {
  exportType: "helpCenterMarkdown";
  recordCount: number;
};

type BackfillEmbeddingsArgs = WorkspaceArgs & {
  contentTypes?: ("article" | "internalArticle" | "snippet")[];
};

type BackfillEmbeddingsResult = {
  total: number;
  processed: number;
  skipped: number;
};

const ARTICLES_LIST_QUERY_REF = webQueryRef<WorkspaceArgs, ArticleListItem[]>("articles:list");
const COLLECTIONS_LIST_HIERARCHY_QUERY_REF = webQueryRef<WorkspaceArgs, CollectionListItem[]>(
  "collections:listHierarchy"
);
const IMPORT_SOURCES_QUERY_REF = webQueryRef<WorkspaceArgs, ImportSourceListItem[]>(
  "helpCenterImports:listSources"
);
const IMPORT_HISTORY_QUERY_REF = webQueryRef<ImportHistoryArgs, ImportHistoryListItem[]>(
  "helpCenterImports:listHistory"
);
const EXPORT_MARKDOWN_QUERY_REF = webQueryRef<ExportMarkdownArgs, MarkdownExportPayload>(
  "helpCenterImports:exportMarkdown"
);

const CREATE_ARTICLE_REF = webMutationRef<CreateArticleArgs, ArticleEditorId>("articles:create");
const DELETE_ARTICLE_REF = webMutationRef<DeleteArticleArgs, null>("articles:remove");
const PUBLISH_ARTICLE_REF = webMutationRef<DeleteArticleArgs, null>("articles:publish");
const UNPUBLISH_ARTICLE_REF = webMutationRef<DeleteArticleArgs, null>("articles:unpublish");
const SYNC_MARKDOWN_FOLDER_REF = webMutationRef<SyncMarkdownFolderArgs, MarkdownImportPreview>(
  "helpCenterImports:syncMarkdownFolder"
);
const RESTORE_IMPORT_RUN_REF = webMutationRef<RestoreImportRunArgs, RestoreImportRunResult>(
  "helpCenterImports:restoreRun"
);
const GENERATE_ASSET_UPLOAD_URL_REF = webMutationRef<GenerateAssetUploadUrlArgs, string>(
  "articles:generateAssetUploadUrl"
);
const LOG_EXPORT_REF = webMutationRef<LogExportArgs, null>("auditLogs:logExport");
const BACKFILL_EMBEDDINGS_REF = webActionRef<BackfillEmbeddingsArgs, BackfillEmbeddingsResult>(
  "embeddings:backfillExisting"
);

type UseArticlesAdminConvexOptions = {
  workspaceId?: Id<"workspaces"> | null;
  isExporting: boolean;
  exportSourceId?: Id<"helpCenterImportSources">;
};

export function useArticlesAdminConvex({
  workspaceId,
  isExporting,
  exportSourceId,
}: UseArticlesAdminConvexOptions) {
  return {
    articles: useWebQuery(ARTICLES_LIST_QUERY_REF, workspaceId ? { workspaceId } : "skip"),
    collections: useWebQuery(
      COLLECTIONS_LIST_HIERARCHY_QUERY_REF,
      workspaceId ? { workspaceId } : "skip"
    ),
    createArticle: useWebMutation(CREATE_ARTICLE_REF),
    deleteArticle: useWebMutation(DELETE_ARTICLE_REF),
    generateAssetUploadUrl: useWebMutation(GENERATE_ASSET_UPLOAD_URL_REF),
    importHistory: useWebQuery(
      IMPORT_HISTORY_QUERY_REF,
      workspaceId ? { workspaceId, limit: 10 } : "skip"
    ),
    importSources: useWebQuery(IMPORT_SOURCES_QUERY_REF, workspaceId ? { workspaceId } : "skip"),
    logExport: useWebMutation(LOG_EXPORT_REF),
    markdownExport: useWebQuery(
      EXPORT_MARKDOWN_QUERY_REF,
      isExporting && workspaceId
        ? {
            workspaceId,
            sourceId: exportSourceId,
            includeDrafts: true,
          }
        : "skip"
    ),
    publishArticle: useWebMutation(PUBLISH_ARTICLE_REF),
    restoreImportRun: useWebMutation(RESTORE_IMPORT_RUN_REF),
    syncMarkdownFolder: useWebMutation(SYNC_MARKDOWN_FOLDER_REF),
    unpublishArticle: useWebMutation(UNPUBLISH_ARTICLE_REF),
    backfillEmbeddings: useWebAction(BACKFILL_EMBEDDINGS_REF),
  };
}
