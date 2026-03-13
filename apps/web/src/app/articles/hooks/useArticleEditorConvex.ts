"use client";

import type { Id } from "@opencom/convex/dataModel";
import {
  useWebMutation,
  useWebQuery,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";
import type { InlineAudienceRule } from "@/lib/audienceRules";
import type { ArticleEditorId } from "../articlesAdminTypes";

type ArticleArgs = {
  id: ArticleEditorId;
};

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type ArticleAssetsArgs = WorkspaceArgs & {
  articleId: ArticleEditorId;
};

type ArticleRecord = {
  slug?: string;
  title: string;
  content: string;
  collectionId?: Id<"collections">;
  visibility?: "public" | "internal";
  tags?: string[];
  audienceRules?: unknown;
  status?: "draft" | "published" | "archived";
} | null;

type ArticleAssetRecord = {
  _id: Id<"articleAssets">;
  reference: string;
  fileName?: string;
};

type ArticleCollectionOption = {
  _id: Id<"collections">;
  name: string;
};

type UpdateArticleArgs = {
  id: ArticleEditorId;
  title: string;
  content: string;
  collectionId?: Id<"collections">;
  visibility: "public" | "internal";
  tags: string[];
  audienceRules?: InlineAudienceRule;
};

type PublishArticleArgs = {
  id: ArticleEditorId;
};

type GenerateAssetUploadUrlArgs = WorkspaceArgs;

type SaveAssetArgs = WorkspaceArgs & {
  articleId: ArticleEditorId;
  storageId: Id<"_storage">;
  fileName?: string;
};

type SaveAssetResult = {
  reference: string;
  fileName?: string;
};

type DeleteAssetArgs = WorkspaceArgs & {
  assetId: Id<"articleAssets">;
};

const ARTICLE_QUERY_REF = webQueryRef<ArticleArgs, ArticleRecord>("articles:get");
const ARTICLE_ASSETS_QUERY_REF = webQueryRef<ArticleAssetsArgs, ArticleAssetRecord[]>(
  "articles:listAssets"
);
const COLLECTIONS_QUERY_REF = webQueryRef<WorkspaceArgs, ArticleCollectionOption[]>(
  "collections:listHierarchy"
);

const UPDATE_ARTICLE_REF = webMutationRef<UpdateArticleArgs, null>("articles:update");
const PUBLISH_ARTICLE_REF = webMutationRef<PublishArticleArgs, null>("articles:publish");
const UNPUBLISH_ARTICLE_REF = webMutationRef<PublishArticleArgs, null>("articles:unpublish");
const ARCHIVE_ARTICLE_REF = webMutationRef<PublishArticleArgs, null>("articles:archive");
const GENERATE_ASSET_UPLOAD_URL_REF = webMutationRef<GenerateAssetUploadUrlArgs, string>(
  "articles:generateAssetUploadUrl"
);
const SAVE_ASSET_REF = webMutationRef<SaveAssetArgs, SaveAssetResult>("articles:saveAsset");
const DELETE_ASSET_REF = webMutationRef<DeleteAssetArgs, null>("articles:deleteAsset");

type UseArticleEditorConvexOptions = {
  articleId: ArticleEditorId;
  workspaceId?: Id<"workspaces"> | null;
};

export function useArticleEditorConvex({
  articleId,
  workspaceId,
}: UseArticleEditorConvexOptions) {
  return {
    archiveArticle: useWebMutation(ARCHIVE_ARTICLE_REF),
    article: useWebQuery(ARTICLE_QUERY_REF, { id: articleId }),
    articleAssets: useWebQuery(
      ARTICLE_ASSETS_QUERY_REF,
      workspaceId ? { workspaceId, articleId } : "skip"
    ),
    collections: useWebQuery(COLLECTIONS_QUERY_REF, workspaceId ? { workspaceId } : "skip"),
    deleteAsset: useWebMutation(DELETE_ASSET_REF),
    generateAssetUploadUrl: useWebMutation(GENERATE_ASSET_UPLOAD_URL_REF),
    publishArticle: useWebMutation(PUBLISH_ARTICLE_REF),
    saveAsset: useWebMutation(SAVE_ASSET_REF),
    unpublishArticle: useWebMutation(UNPUBLISH_ARTICLE_REF),
    updateArticle: useWebMutation(UPDATE_ARTICLE_REF),
  };
}
