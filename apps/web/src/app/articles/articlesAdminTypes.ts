"use client";

import type { Id } from "@opencom/convex/dataModel";

export type ImportSelectionItem = {
  file: File;
  relativePath: string;
};

export type ImportAssetPayload = {
  relativePath: string;
  storageId: Id<"_storage">;
  mimeType?: string;
  size?: number;
};

export type MarkdownImportPreview = {
  dryRun: boolean;
  createdCollections: number;
  updatedCollections: number;
  createdArticles: number;
  updatedArticles: number;
  deletedArticles: number;
  deletedCollections: number;
  totalFiles: number;
  totalAssets?: number;
  strippedRootFolder?: string;
  unresolvedImageReferences?: string[];
  preview: {
    collections: {
      create: string[];
      update: string[];
      delete: string[];
    };
    articles: {
      create: string[];
      update: string[];
      delete: string[];
    };
  };
};

export type DeleteArticleTarget = {
  id: Id<"articles">;
  title: string;
};

export const ALL_COLLECTION_FILTER = "all";
export const GENERAL_COLLECTION_FILTER = "general";

export type CollectionFilter =
  | typeof ALL_COLLECTION_FILTER
  | typeof GENERAL_COLLECTION_FILTER
  | Id<"collections">;

export type CollectionFilterItem = {
  id: CollectionFilter;
  label: string;
  count: number;
};

export type ArticleListItem = {
  _id: Id<"articles">;
  title: string;
  status: string;
  updatedAt: number;
  collectionId?: Id<"collections">;
};

export type CollectionListItem = {
  _id: Id<"collections">;
  name: string;
  parentId?: Id<"collections">;
};

export type ImportSourceListItem = {
  _id: Id<"helpCenterImportSources">;
  sourceName: string;
  rootCollectionName?: string;
  lastImportedFileCount?: number;
};

export type ImportHistoryListItem = {
  sourceId: Id<"helpCenterImportSources">;
  importRunId: string;
  sourceName: string;
  deletedArticles: number;
  deletedCollections: number;
  restorableEntries: number;
};

export type MarkdownExportFile =
  | {
      type: "asset";
      path: string;
      assetUrl?: string;
    }
  | {
      type: "markdown";
      path: string;
      content?: string;
    };

export type MarkdownExportPayload = {
  count: number;
  fileName: string;
  files: MarkdownExportFile[];
};
