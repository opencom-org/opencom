import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  UNCATEGORIZED_COLLECTION_PATH,
  buildFrontmatterContent,
  dedupePath,
  dedupeRelativePath,
  getFileExtension,
  sanitizePathSegment,
  withoutMarkdownExtension,
} from "./pathUtils";
import { extractAssetReferenceIds, rewriteAssetReferencesForExport } from "./referenceRewrite";

export interface ExportMarkdownArgs {
  workspaceId: Id<"workspaces">;
  sourceId?: Id<"helpCenterImportSources">;
  rootCollectionId?: Id<"collections">;
  includeDrafts?: boolean;
}

export async function runExportMarkdown(
  ctx: QueryCtx,
  args: ExportMarkdownArgs
) {
  const includeDrafts = args.includeDrafts ?? true;
  const sourceId = args.sourceId;
  const rootCollectionId = args.rootCollectionId;
  const now = Date.now();

  let sourceName: string | undefined;
  if (sourceId) {
    const source = await ctx.db.get(sourceId);
    if (!source || source.workspaceId !== args.workspaceId) {
      throw new Error("Import source not found");
    }
    sourceName = source.sourceName;
  }

  const allCollections = await ctx.db
    .query("collections")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
    .collect();

  const collectionById = new Map(
    allCollections.map((collection) => [collection._id, collection] as const)
  );
  const childrenByParent = new Map<string, Array<Id<"collections">>>();
  for (const collection of allCollections) {
    const parentKey = collection.parentId ?? "__root__";
    const existingChildren = childrenByParent.get(parentKey) ?? [];
    existingChildren.push(collection._id);
    childrenByParent.set(parentKey, existingChildren);
  }

  const descendantSet = new Set<Id<"collections">>();
  if (rootCollectionId) {
    const rootCollection = collectionById.get(rootCollectionId);
    if (!rootCollection) {
      throw new Error("Export root collection not found");
    }
    const stack: Array<Id<"collections">> = [rootCollectionId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (descendantSet.has(current)) {
        continue;
      }
      descendantSet.add(current);
      const children = childrenByParent.get(current) ?? [];
      for (const child of children) {
        stack.push(child);
      }
    }
  }

  const cachedPathById = new Map<Id<"collections">, string>();
  const buildCollectionPath = (collectionId: Id<"collections">): string => {
    const cached = cachedPathById.get(collectionId);
    if (cached) {
      return cached;
    }
    const collection = collectionById.get(collectionId);
    if (!collection) {
      return "";
    }
    const segment = sanitizePathSegment(collection.name) || "collection";
    const parentPath = collection.parentId ? buildCollectionPath(collection.parentId) : "";
    const fullPath = parentPath ? `${parentPath}/${segment}` : segment;
    cachedPathById.set(collectionId, fullPath);
    return fullPath;
  };

  let articles = await ctx.db
    .query("articles")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
    .collect();

  if (!includeDrafts) {
    articles = articles.filter((article) => article.status === "published");
  }
  if (sourceId) {
    articles = articles.filter((article) => article.importSourceId === sourceId);
  }
  if (rootCollectionId) {
    articles = articles.filter(
      (article) => article.collectionId && descendantSet.has(article.collectionId)
    );
  }

  const usedPaths = new Set<string>();
  const articleExports = articles
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((article) => {
      const hasCollection = Boolean(article.collectionId);
      const collectionPath = hasCollection ? buildCollectionPath(article.collectionId!) : "";
      const frontmatterCollectionPath = hasCollection
        ? collectionPath || undefined
        : UNCATEGORIZED_COLLECTION_PATH;
      const fallbackPathBase = collectionPath
        ? `${collectionPath}/${sanitizePathSegment(article.slug || article.title) || "article"}`
        : sanitizePathSegment(article.slug || article.title) || "article";
      const preferredPath =
        sourceId && article.importPath ? article.importPath : fallbackPathBase;
      const markdownPath = dedupeRelativePath(preferredPath, usedPaths);
      return {
        article,
        markdownPath,
        frontmatterCollectionPath,
      };
    });

  const referencedAssetIds = new Set<string>();
  for (const articleExport of articleExports) {
    const ids = extractAssetReferenceIds(articleExport.article.content);
    for (const id of ids) {
      referencedAssetIds.add(id);
    }
  }

  const assetPathById = new Map<string, string>();
  const assetFiles: Array<{ path: string; assetUrl: string; type: "asset" }> = [];
  for (const assetId of referencedAssetIds) {
    const asset = await ctx.db.get(assetId as Id<"articleAssets">);
    if (!asset || asset.workspaceId !== args.workspaceId) {
      continue;
    }

    const fileNameStem =
      sanitizePathSegment(withoutMarkdownExtension(asset.fileName)) || `image-${asset._id}`;
    const extension = getFileExtension(asset.fileName) || ".bin";
    const preferredAssetPath = asset.importPath
      ? `_assets/${asset.importPath}`
      : `_assets/${fileNameStem}${extension}`;
    const dedupedAssetPath = dedupePath(preferredAssetPath, usedPaths);
    const assetUrl = await ctx.storage.getUrl(asset.storageId);
    if (!assetUrl) {
      continue;
    }

    assetPathById.set(assetId, dedupedAssetPath);
    assetFiles.push({
      path: dedupedAssetPath,
      assetUrl,
      type: "asset",
    });
  }

  const markdownFiles = articleExports.map((articleExport) => {
    const bodyWithPortableAssetRefs = rewriteAssetReferencesForExport(
      articleExport.article.content,
      articleExport.markdownPath,
      assetPathById
    );
    return {
      path: articleExport.markdownPath,
      type: "markdown" as const,
      content: buildFrontmatterContent({
        title: articleExport.article.title,
        slug: articleExport.article.slug,
        status: articleExport.article.status,
        updatedAt: articleExport.article.updatedAt,
        collectionPath: articleExport.frontmatterCollectionPath,
        sourceName,
        body: bodyWithPortableAssetRefs,
      }),
    };
  });

  const files = [...markdownFiles, ...assetFiles];

  const exportNameParts = ["help-center", "markdown"];
  if (sourceName) {
    exportNameParts.push(sanitizePathSegment(sourceName) || "source");
  } else if (rootCollectionId) {
    const rootCollection = collectionById.get(rootCollectionId);
    if (rootCollection) {
      exportNameParts.push(sanitizePathSegment(rootCollection.name) || "collection");
    }
  } else {
    exportNameParts.push("all");
  }
  exportNameParts.push(new Date(now).toISOString().slice(0, 10));

  return {
    exportedAt: now,
    count: files.length,
    fileName: `${exportNameParts.join("-")}.zip`,
    files,
  };
}
