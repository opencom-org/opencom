import type { Id } from "@opencom/convex/dataModel";
import {
  ALL_COLLECTION_FILTER,
  GENERAL_COLLECTION_FILTER,
  type ArticleListItem,
  type CollectionFilter,
  type CollectionFilterItem,
  type CollectionListItem,
  type ImportSelectionItem,
} from "./articlesAdminTypes";

export const ALL_VISIBILITY_FILTER = "all";
export const ALL_STATUS_FILTER = "all";

export type VisibilityFilter = typeof ALL_VISIBILITY_FILTER | "public" | "internal";
export type StatusFilter = typeof ALL_STATUS_FILTER | ArticleListItem["status"];

export const getRawImportRelativePath = (file: File): string => {
  const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  const fallback = relativePath && relativePath.length > 0 ? relativePath : file.name;
  return fallback
    .replace(/\\/g, "/")
    .trim()
    .replace(/^\/+|\/+$/g, "");
};

export const deriveDefaultSourceName = (paths: string[]): string => {
  if (paths.length === 0) {
    return "docs";
  }
  const firstSegment = paths[0]?.split("/")[0] ?? "docs";
  return firstSegment.replace(/\.(md|markdown)$/i, "") || "docs";
};

export const buildImportSignature = (
  sourceName: string,
  targetCollectionId: Id<"collections"> | undefined,
  markdownItems: ImportSelectionItem[],
  assetItems: ImportSelectionItem[]
): string => {
  const normalizedSourceName = sourceName.trim().toLowerCase();
  const normalizedTarget = targetCollectionId ?? "root";
  const normalizedMarkdownItems = markdownItems
    .map((item) => `${item.relativePath}:${item.file.size}:${item.file.lastModified}`)
    .sort((a, b) => a.localeCompare(b));
  const normalizedAssetItems = assetItems
    .map((item) => `${item.relativePath}:${item.file.size}:${item.file.lastModified}`)
    .sort((a, b) => a.localeCompare(b));

  return [normalizedSourceName, normalizedTarget, ...normalizedMarkdownItems, ...normalizedAssetItems].join(
    "::"
  );
};

export const filterArticles = (
  articles: ArticleListItem[] | undefined,
  searchQuery: string,
  collectionFilter: CollectionFilter,
  visibilityFilter: VisibilityFilter,
  statusFilter: StatusFilter
): ArticleListItem[] => {
  if (!articles) {
    return [];
  }

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  return [...articles]
    .filter((article) => {
      const visibility = article.visibility ?? "public";
      const matchesSearch =
        article.title.toLowerCase().includes(normalizedSearchQuery) ||
        article.slug.toLowerCase().includes(normalizedSearchQuery) ||
        (article.tags ?? []).some((tag) => tag.toLowerCase().includes(normalizedSearchQuery));
      const matchesVisibility =
        visibilityFilter === ALL_VISIBILITY_FILTER ? true : visibility === visibilityFilter;
      const matchesStatus =
        statusFilter === ALL_STATUS_FILTER ? true : article.status === statusFilter;
      const matchesCollection =
        collectionFilter === ALL_COLLECTION_FILTER
          ? true
          : collectionFilter === GENERAL_COLLECTION_FILTER
            ? !article.collectionId
            : article.collectionId === collectionFilter;
      return matchesSearch && matchesVisibility && matchesStatus && matchesCollection;
    })
    .sort((left, right) => right.updatedAt - left.updatedAt);
};

export const getCollectionLabel = (
  collectionId: Id<"collections">,
  collections: CollectionListItem[] | undefined
): string => {
  if (!collections || collections.length === 0) {
    return "";
  }

  const collectionMap = new Map(collections.map((collection) => [collection._id, collection]));
  const seen = new Set<string>();
  const names: string[] = [];
  let cursor: Id<"collections"> | undefined = collectionId;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const collection = collectionMap.get(cursor);
    if (!collection) {
      break;
    }
    names.unshift(collection.name);
    cursor = collection.parentId;
  }
  return names.join(" / ");
};

export const getCollectionName = (
  collectionId: Id<"collections"> | undefined,
  collections: CollectionListItem[] | undefined
): string => {
  if (!collectionId || !collections) {
    return "General";
  }
  const collection = collections.find((item) => item._id === collectionId);
  return collection?.name || "General";
};

export const getArticleCollectionFilter = (
  collectionId: Id<"collections"> | undefined
): CollectionFilter => {
  if (!collectionId) {
    return GENERAL_COLLECTION_FILTER;
  }
  return collectionId;
};

export const buildCollectionFilterItems = (
  articles: ArticleListItem[] | undefined,
  collections: CollectionListItem[] | undefined
): CollectionFilterItem[] => {
  const collectionArticleCounts = new Map<string, number>();
  for (const article of articles ?? []) {
    if (!article.collectionId) {
      continue;
    }
    collectionArticleCounts.set(
      article.collectionId,
      (collectionArticleCounts.get(article.collectionId) ?? 0) + 1
    );
  }

  return [
    {
      id: ALL_COLLECTION_FILTER,
      label: "All",
      count: articles?.length ?? 0,
    },
    {
      id: GENERAL_COLLECTION_FILTER,
      label: "General",
      count: (articles ?? []).filter((article) => !article.collectionId).length,
    },
    ...((collections ?? []).map((collection): CollectionFilterItem => ({
      id: collection._id,
      label: collection.name,
      count: collectionArticleCounts.get(collection._id) ?? 0,
    })) ?? []),
  ];
};

export const formatDate = (timestamp: number): string =>
  new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export const formatPreviewPathSample = (paths: string[]): string => {
  const sample = paths.slice(0, 4);
  if (sample.length === 0) {
    return "";
  }
  const remaining = paths.length - sample.length;
  return remaining > 0 ? `${sample.join(", ")} (+${remaining} more)` : sample.join(", ");
};
