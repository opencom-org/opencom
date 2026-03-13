import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { ensureUniqueSlug, generateSlug } from "../utils/strings";
import { inferTitle, parseMarkdownImportContent, resolveIncomingCollectionPath } from "./markdownParse";
import {
  ASSET_REFERENCE_PREFIX,
  IMAGE_EXTENSION_REGEX,
  MARKDOWN_EXTENSION_REGEX,
  MAX_IMPORT_IMAGE_BYTES,
  addDirectoryAndParents,
  addMapArrayValue,
  buildArticleSlugMatchKey,
  buildArticleTitleMatchKey,
  buildCollectionNameMatchKey,
  buildDefaultSourceKey,
  detectCommonRootFolder,
  formatSourceLabel,
  getDirectoryPath,
  getFileName,
  getFirstPathSegment,
  getNextArticleOrder,
  getNextCollectionOrder,
  getParentPath,
  humanizeName,
  isSupportedImportMimeType,
  normalizePath,
  normalizeSourceKey,
  pathDepth,
  pushPreviewPath,
  stripFirstPathSegment,
  stripSpecificRootFolder,
  withoutMarkdownExtension,
} from "./pathUtils";
import { rewriteMarkdownImageReferences } from "./referenceRewrite";

type SyncCtx = MutationCtx & { user: { _id: Id<"users"> } };

export interface SyncMarkdownFolderArgs {
  workspaceId: Id<"workspaces">;
  sourceKey?: string;
  sourceName: string;
  rootCollectionId?: Id<"collections">;
  files: Array<{
    relativePath: string;
    content: string;
  }>;
  assets?: Array<{
    relativePath: string;
    storageId?: Id<"_storage">;
    mimeType?: string;
    size?: number;
  }>;
  publishByDefault?: boolean;
  dryRun?: boolean;
}

export async function runSyncMarkdownFolder(
  ctx: SyncCtx,
  args: SyncMarkdownFolderArgs
) {
  const now = Date.now();
  const publishByDefault = args.publishByDefault ?? true;
  const dryRun = args.dryRun ?? false;
  const sourceKey = normalizeSourceKey(
    args.sourceKey ?? buildDefaultSourceKey(args.sourceName, args.rootCollectionId)
  );
  if (!sourceKey) {
    throw new Error("Import source key is required");
  }

  if (args.rootCollectionId) {
    const rootCollection = await ctx.db.get(args.rootCollectionId);
    if (!rootCollection || rootCollection.workspaceId !== args.workspaceId) {
      throw new Error("Target collection not found");
    }
  }

  const rawIncomingFiles = args.files
    .map((file) => {
      const parsedContent = parseMarkdownImportContent(file.content);
      return {
        relativePath: normalizePath(file.relativePath),
        content: parsedContent.body,
        frontmatterTitle: parsedContent.frontmatterTitle,
        frontmatterSlug: parsedContent.frontmatterSlug,
        frontmatterCollectionPath: parsedContent.frontmatterCollectionPath,
      };
    })
    .filter((file) => Boolean(file.relativePath) && MARKDOWN_EXTENSION_REGEX.test(file.relativePath));

  if (rawIncomingFiles.length === 0) {
    throw new Error("No markdown files were found in this upload");
  }

  const rawIncomingAssets = (args.assets ?? [])
    .map((asset) => ({
      relativePath: normalizePath(asset.relativePath),
      storageId: asset.storageId,
      mimeType: asset.mimeType,
      size: asset.size,
    }))
    .filter((asset) => Boolean(asset.relativePath) && IMAGE_EXTENSION_REGEX.test(asset.relativePath));

  const commonRootFolder = detectCommonRootFolder(
    [...rawIncomingFiles.map((file) => file.relativePath), ...rawIncomingAssets.map((asset) => asset.relativePath)]
  );

  const incomingFiles = new Map<
    string,
    {
      relativePath: string;
      originalPath: string;
      content: string;
      frontmatterTitle?: string;
      frontmatterSlug?: string;
      frontmatterCollectionPath?: string | null;
    }
  >();
  for (const file of rawIncomingFiles) {
    const normalizedPath = commonRootFolder
      ? stripSpecificRootFolder(file.relativePath, commonRootFolder)
      : file.relativePath;
    if (!normalizedPath) {
      continue;
    }
    if (incomingFiles.has(normalizedPath)) {
      throw new Error(
        `Import contains duplicate markdown path after root normalization: "${normalizedPath}"`
      );
    }
    incomingFiles.set(normalizedPath, {
      relativePath: normalizedPath,
      originalPath: file.relativePath,
      content: file.content,
      frontmatterTitle: file.frontmatterTitle,
      frontmatterSlug: file.frontmatterSlug,
      frontmatterCollectionPath: file.frontmatterCollectionPath,
    });
  }

  if (incomingFiles.size === 0) {
    throw new Error("No markdown files remained after path normalization");
  }

  const incomingAssets = new Map<
    string,
    {
      relativePath: string;
      originalPath: string;
      storageId?: Id<"_storage">;
      mimeType?: string;
      size?: number;
    }
  >();
  for (const asset of rawIncomingAssets) {
    const normalizedPath = commonRootFolder
      ? stripSpecificRootFolder(asset.relativePath, commonRootFolder)
      : asset.relativePath;
    if (!normalizedPath) {
      continue;
    }
    if (incomingAssets.has(normalizedPath)) {
      throw new Error(
        `Import contains duplicate image path after root normalization: "${normalizedPath}"`
      );
    }
    incomingAssets.set(normalizedPath, {
      relativePath: normalizedPath,
      originalPath: asset.relativePath,
      storageId: asset.storageId,
      mimeType: asset.mimeType,
      size: asset.size,
    });
  }

  const existingSource = await ctx.db
    .query("helpCenterImportSources")
    .withIndex("by_workspace_source_key", (q) =>
      q.eq("workspaceId", args.workspaceId).eq("sourceKey", sourceKey)
    )
    .first();
  let sourceId = existingSource?._id;

  if (!sourceId && !dryRun) {
    sourceId = await ctx.db.insert("helpCenterImportSources", {
      workspaceId: args.workspaceId,
      sourceKey,
      sourceName: args.sourceName,
      rootCollectionId: args.rootCollectionId,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (existingSource && !dryRun) {
    await ctx.db.patch(existingSource._id, {
      sourceName: args.sourceName,
      rootCollectionId: args.rootCollectionId,
      updatedAt: now,
    });
  }

  const existingCollections = sourceId
    ? await ctx.db
        .query("collections")
        .withIndex("by_workspace_import_source", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("importSourceId", sourceId!)
        )
        .collect()
    : [];

  const existingArticles = sourceId
    ? await ctx.db
        .query("articles")
        .withIndex("by_workspace_import_source", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("importSourceId", sourceId!)
        )
        .collect()
    : [];

  const existingAssets = sourceId
    ? await ctx.db
        .query("articleAssets")
        .withIndex("by_import_source", (q) => q.eq("importSourceId", sourceId!))
        .collect()
    : [];
  const existingAssetByPath = new Map(
    existingAssets
      .filter((asset) => asset.importPath)
      .map((asset) => [asset.importPath!, asset] as const)
  );
  const assetReferenceByPath = new Map<string, string>();
  for (const existingAsset of existingAssets) {
    if (!existingAsset.importPath) {
      continue;
    }
    assetReferenceByPath.set(
      existingAsset.importPath,
      `${ASSET_REFERENCE_PREFIX}${existingAsset._id}`
    );
  }

  for (const incomingAsset of incomingAssets.values()) {
    const existingAsset = existingAssetByPath.get(incomingAsset.relativePath);

    if (dryRun) {
      const syntheticReference =
        existingAsset
          ? `${ASSET_REFERENCE_PREFIX}${existingAsset._id}`
          : `${ASSET_REFERENCE_PREFIX}dryrun-${normalizeSourceKey(incomingAsset.relativePath) || "asset"}`;
      assetReferenceByPath.set(incomingAsset.relativePath, syntheticReference);
      continue;
    }

    if (!sourceId) {
      throw new Error("Failed to resolve import source");
    }
    if (!incomingAsset.storageId) {
      throw new Error(
        `Image "${incomingAsset.relativePath}" is missing storageId. Upload assets before applying import.`
      );
    }

    const metadata = await ctx.storage.getMetadata(incomingAsset.storageId);
    if (!metadata) {
      throw new Error(`Uploaded image "${incomingAsset.relativePath}" was not found in storage.`);
    }

    const mimeType = (metadata.contentType ?? incomingAsset.mimeType ?? "").toLowerCase();
    if (!isSupportedImportMimeType(mimeType)) {
      throw new Error(
        `Unsupported image type for "${incomingAsset.relativePath}". Allowed: PNG, JPEG, GIF, WEBP, AVIF.`
      );
    }
    if (metadata.size > MAX_IMPORT_IMAGE_BYTES) {
      throw new Error(`Image "${incomingAsset.relativePath}" exceeds the 5MB upload limit.`);
    }

    const nowTimestamp = Date.now();
    if (existingAsset) {
      if (existingAsset.storageId !== incomingAsset.storageId) {
        await ctx.storage.delete(existingAsset.storageId);
      }
      await ctx.db.patch(existingAsset._id, {
        storageId: incomingAsset.storageId,
        fileName: getFileName(incomingAsset.relativePath),
        mimeType,
        size: metadata.size,
        updatedAt: nowTimestamp,
      });
      assetReferenceByPath.set(
        incomingAsset.relativePath,
        `${ASSET_REFERENCE_PREFIX}${existingAsset._id}`
      );
      continue;
    }

    const createdAssetId = await ctx.db.insert("articleAssets", {
      workspaceId: args.workspaceId,
      importSourceId: sourceId,
      importPath: incomingAsset.relativePath,
      storageId: incomingAsset.storageId,
      fileName: getFileName(incomingAsset.relativePath),
      mimeType,
      size: metadata.size,
      createdBy: ctx.user._id,
      createdAt: nowTimestamp,
      updatedAt: nowTimestamp,
    });
    assetReferenceByPath.set(incomingAsset.relativePath, `${ASSET_REFERENCE_PREFIX}${createdAssetId}`);
  }

  const unresolvedImageReferenceSet = new Set<string>();
  for (const [path, file] of incomingFiles.entries()) {
    const rewritten = rewriteMarkdownImageReferences(file.content, path, assetReferenceByPath);
    for (const unresolved of rewritten.unresolvedReferences) {
      unresolvedImageReferenceSet.add(unresolved);
    }
    incomingFiles.set(path, {
      ...file,
      content: rewritten.content,
    });
  }

  const canMatchImportSource = (
    importSourceId: Id<"helpCenterImportSources"> | undefined
  ): boolean => {
    if (!importSourceId) {
      return true;
    }
    if (!sourceId) {
      return false;
    }
    return importSourceId === sourceId;
  };

  const workspaceCollections = await ctx.db
    .query("collections")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
    .collect();
  const collectionCandidatesByName = new Map<string, (typeof workspaceCollections)[number][]>();
  for (const collection of workspaceCollections) {
    if (!canMatchImportSource(collection.importSourceId)) {
      continue;
    }
    const nameKey = buildCollectionNameMatchKey(collection.parentId, collection.name);
    addMapArrayValue(collectionCandidatesByName, nameKey, collection);
  }

  const workspaceArticles = await ctx.db
    .query("articles")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
    .collect();
  const articleCandidatesByTitle = new Map<string, (typeof workspaceArticles)[number][]>();
  const articleCandidatesBySlug = new Map<string, (typeof workspaceArticles)[number][]>();
  for (const article of workspaceArticles) {
    if (!canMatchImportSource(article.importSourceId)) {
      continue;
    }
    const titleKey = buildArticleTitleMatchKey(article.collectionId, article.title);
    addMapArrayValue(articleCandidatesByTitle, titleKey, article);
    const slugKey = buildArticleSlugMatchKey(article.collectionId, article.slug);
    addMapArrayValue(articleCandidatesBySlug, slugKey, article);
  }

  const incomingTopLevelSegments = new Set(
    Array.from(incomingFiles.keys()).map(getFirstPathSegment).filter(Boolean)
  );

  const existingCollectionByPath = new Map(
    existingCollections
      .filter((collection) => typeof collection.importPath === "string" && collection.importPath)
      .map((collection) => [collection.importPath as string, collection] as const)
  );
  const existingCollectionByStrippedPath = new Map<
    string,
    (typeof existingCollections)[number]
  >();
  for (const collection of existingCollections) {
    if (!collection.importPath) {
      continue;
    }
    const strippedPath = stripFirstPathSegment(collection.importPath);
    if (!strippedPath) {
      continue;
    }
    const firstSegment = getFirstPathSegment(collection.importPath);
    if (incomingTopLevelSegments.has(firstSegment)) {
      continue;
    }
    if (
      !existingCollectionByPath.has(strippedPath) &&
      !existingCollectionByStrippedPath.has(strippedPath)
    ) {
      existingCollectionByStrippedPath.set(strippedPath, collection);
    }
  }

  const existingArticleByPath = new Map(
    existingArticles
      .filter((article) => typeof article.importPath === "string" && article.importPath)
      .map((article) => [article.importPath as string, article] as const)
  );
  const existingArticleByStrippedPath = new Map<string, (typeof existingArticles)[number]>();
  for (const article of existingArticles) {
    if (!article.importPath) {
      continue;
    }
    const strippedPath = stripFirstPathSegment(article.importPath);
    if (!strippedPath) {
      continue;
    }
    const firstSegment = getFirstPathSegment(article.importPath);
    if (incomingTopLevelSegments.has(firstSegment)) {
      continue;
    }
    if (
      !existingArticleByPath.has(strippedPath) &&
      !existingArticleByStrippedPath.has(strippedPath)
    ) {
      existingArticleByStrippedPath.set(strippedPath, article);
    }
  }

  const desiredCollectionPaths = new Set<string>();
  for (const file of incomingFiles.values()) {
    const directoryPath = resolveIncomingCollectionPath(file);
    if (directoryPath) {
      addDirectoryAndParents(desiredCollectionPaths, directoryPath);
    }
  }

  const sortedDesiredCollections = Array.from(desiredCollectionPaths).sort((a, b) => {
    const depthDelta = pathDepth(a) - pathDepth(b);
    if (depthDelta !== 0) {
      return depthDelta;
    }
    return a.localeCompare(b);
  });

  const collectionPathToId = new Map<string, Id<"collections">>();
  for (const [path, collection] of existingCollectionByPath.entries()) {
    collectionPathToId.set(path, collection._id);
  }

  let createdCollections = 0;
  let updatedCollections = 0;
  let createdArticles = 0;
  let updatedArticles = 0;
  let deletedArticles = 0;
  let deletedCollections = 0;
  const createdCollectionPaths: string[] = [];
  const updatedCollectionPaths: string[] = [];
  const deletedCollectionPaths: string[] = [];
  const createdArticlePaths: string[] = [];
  const updatedArticlePaths: string[] = [];
  const deletedArticlePaths: string[] = [];
  const matchedCollectionIds = new Set<Id<"collections">>();
  const matchedArticleIds = new Set<Id<"articles">>();
  const deletedArticleIdsInRun = new Set<Id<"articles">>();
  const deletedCollectionIdsInRun = new Set<Id<"collections">>();

  const rootCollectionPathSentinel = "__root__";
  const existingCollectionPathById = new Map<Id<"collections">, string>();
  for (const collection of existingCollections) {
    if (collection.importPath) {
      existingCollectionPathById.set(collection._id, collection.importPath);
    }
  }
  const getExistingArticleCollectionPath = (
    article: (typeof existingArticles)[number]
  ): string | undefined => {
    if (article.collectionId === args.rootCollectionId) {
      return rootCollectionPathSentinel;
    }
    if (!article.collectionId && !args.rootCollectionId) {
      return rootCollectionPathSentinel;
    }
    if (!article.collectionId) {
      return undefined;
    }
    return existingCollectionPathById.get(article.collectionId);
  };

  for (const collectionPath of sortedDesiredCollections) {
    let existingCollection =
      existingCollectionByPath.get(collectionPath) ??
      existingCollectionByStrippedPath.get(collectionPath);
    const segmentName = collectionPath.split("/").pop() ?? collectionPath;
    const targetName = humanizeName(segmentName);
    const parentPath = getParentPath(collectionPath);
    const expectedParentId = parentPath
      ? collectionPathToId.get(parentPath)
      : args.rootCollectionId;

    if (parentPath && !expectedParentId) {
      throw new Error(`Unable to resolve parent collection for "${collectionPath}"`);
    }

    if (!existingCollection) {
      const matchKey = buildCollectionNameMatchKey(expectedParentId, targetName);
      const nameCandidates =
        collectionCandidatesByName
          .get(matchKey)
          ?.filter((candidate) => !matchedCollectionIds.has(candidate._id)) ?? [];
      if (nameCandidates.length === 1) {
        existingCollection = nameCandidates[0];
      }
    }

    if (existingCollection) {
      const updates: {
        name?: string;
        slug?: string;
        parentId?: Id<"collections">;
        importPath?: string;
        importSourceId?: Id<"helpCenterImportSources">;
        updatedAt?: number;
      } = {};

      if (existingCollection.name !== targetName) {
        updates.name = targetName;
        if (!dryRun) {
          updates.slug = await ensureUniqueSlug(
            ctx.db,
            "collections",
            args.workspaceId,
            generateSlug(targetName),
            existingCollection._id
          );
        }
      }

      if (existingCollection.parentId !== expectedParentId) {
        updates.parentId = expectedParentId;
      }

      if (existingCollection.importPath !== collectionPath) {
        updates.importPath = collectionPath;
      }

      if (sourceId && existingCollection.importSourceId !== sourceId) {
        updates.importSourceId = sourceId;
      }

      if (Object.keys(updates).length > 0) {
        if (!dryRun) {
          updates.updatedAt = now;
          await ctx.db.patch(existingCollection._id, updates);
        }
        updatedCollections += 1;
        pushPreviewPath(updatedCollectionPaths, collectionPath);
      }

      matchedCollectionIds.add(existingCollection._id);
      collectionPathToId.set(collectionPath, existingCollection._id);
      continue;
    }

    if (dryRun) {
      const simulatedCollectionId = `dry-run:${collectionPath}` as unknown as Id<"collections">;
      collectionPathToId.set(collectionPath, simulatedCollectionId);
    } else {
      if (!sourceId) {
        throw new Error("Failed to resolve import source");
      }
      const slug = await ensureUniqueSlug(
        ctx.db,
        "collections",
        args.workspaceId,
        generateSlug(targetName)
      );
      const order = await getNextCollectionOrder(ctx, args.workspaceId, expectedParentId);

      const collectionId = await ctx.db.insert("collections", {
        workspaceId: args.workspaceId,
        name: targetName,
        slug,
        parentId: expectedParentId,
        order,
        importSourceId: sourceId,
        importPath: collectionPath,
        createdAt: now,
        updatedAt: now,
      });

      collectionPathToId.set(collectionPath, collectionId);
      matchedCollectionIds.add(collectionId);
    }
    createdCollections += 1;
    pushPreviewPath(createdCollectionPaths, collectionPath);
  }

  const sortedIncomingFiles = Array.from(incomingFiles.values()).sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath)
  );
  const importRunId = `${now}-${Math.random().toString(36).slice(2, 8)}`;

  for (const file of sortedIncomingFiles) {
    let existingArticle =
      existingArticleByPath.get(file.relativePath) ??
      existingArticleByStrippedPath.get(file.relativePath);
    const collectionPath = resolveIncomingCollectionPath(file);
    const collectionId = collectionPath
      ? collectionPathToId.get(collectionPath)
      : args.rootCollectionId;
    if (collectionPath && !collectionId) {
      throw new Error(`Unable to resolve collection for file "${file.relativePath}"`);
    }

    const title = file.frontmatterTitle ?? inferTitle(file.relativePath, file.content);
    const preferredSlug = file.frontmatterSlug ?? generateSlug(title);
    if (!existingArticle) {
      const titleMatchKey = buildArticleTitleMatchKey(collectionId, title);
      const titleMatches =
        articleCandidatesByTitle
          .get(titleMatchKey)
          ?.filter((candidate) => !matchedArticleIds.has(candidate._id)) ?? [];

      if (titleMatches.length === 1) {
        existingArticle = titleMatches[0];
      } else if (titleMatches.length === 0) {
        const potentialSlugs = new Set<string>([
          generateSlug(title),
          generateSlug(humanizeName(withoutMarkdownExtension(getFileName(file.relativePath)))),
          generateSlug(withoutMarkdownExtension(getFileName(file.relativePath))),
        ]);
        if (file.frontmatterSlug) {
          potentialSlugs.add(file.frontmatterSlug);
        }

        const slugMatches = new Map<Id<"articles">, (typeof workspaceArticles)[number]>();
        for (const slug of potentialSlugs) {
          const slugMatchKey = buildArticleSlugMatchKey(collectionId, slug);
          const slugCandidates =
            articleCandidatesBySlug
              .get(slugMatchKey)
              ?.filter((candidate) => !matchedArticleIds.has(candidate._id)) ?? [];
          for (const candidate of slugCandidates) {
            slugMatches.set(candidate._id, candidate);
          }
        }

        if (slugMatches.size === 1) {
          existingArticle = Array.from(slugMatches.values())[0];
        }
      }
    }

    if (existingArticle) {
      const updates: {
        title?: string;
        slug?: string;
        content?: string;
        collectionId?: Id<"collections">;
        status?: "draft" | "published";
        publishedAt?: number;
        importPath?: string;
        importSourceId?: Id<"helpCenterImportSources">;
        updatedAt?: number;
      } = {};

      if (existingArticle.title !== title) {
        updates.title = title;
        if (!dryRun) {
          updates.slug = await ensureUniqueSlug(
            ctx.db,
            "articles",
            args.workspaceId,
            preferredSlug,
            existingArticle._id
          );
        }
      }

      if (existingArticle.content !== file.content) {
        updates.content = file.content;
      }

      const targetCollectionPath = collectionPath ?? rootCollectionPathSentinel;
      const existingArticleCollectionPath = getExistingArticleCollectionPath(existingArticle);
      if (existingArticleCollectionPath !== targetCollectionPath) {
        updates.collectionId = collectionId;
      }

      if (publishByDefault && existingArticle.status !== "published") {
        updates.status = "published";
        updates.publishedAt = now;
      }

      if (existingArticle.importPath !== file.relativePath) {
        updates.importPath = file.relativePath;
      }

      if (sourceId && existingArticle.importSourceId !== sourceId) {
        updates.importSourceId = sourceId;
      }

      if (Object.keys(updates).length > 0) {
        if (!dryRun) {
          updates.updatedAt = now;
          await ctx.db.patch(existingArticle._id, updates);
        }
        updatedArticles += 1;
        pushPreviewPath(updatedArticlePaths, file.relativePath);
      }
      matchedArticleIds.add(existingArticle._id);
      continue;
    }

    if (!dryRun) {
      if (!sourceId) {
        throw new Error("Failed to resolve import source");
      }
      const order = await getNextArticleOrder(ctx, collectionId);
      const slug = await ensureUniqueSlug(
        ctx.db,
        "articles",
        args.workspaceId,
        preferredSlug
      );
      const articleId = await ctx.db.insert("articles", {
        workspaceId: args.workspaceId,
        collectionId,
        title,
        slug,
        content: file.content,
        status: publishByDefault ? "published" : "draft",
        order,
        importSourceId: sourceId,
        importPath: file.relativePath,
        createdAt: now,
        updatedAt: now,
        publishedAt: publishByDefault ? now : undefined,
      });
      matchedArticleIds.add(articleId);
    }
    createdArticles += 1;
    pushPreviewPath(createdArticlePaths, file.relativePath);
  }

  for (const article of existingArticles) {
    if (matchedArticleIds.has(article._id)) {
      continue;
    }
    if (!article.importPath) {
      continue;
    }

    if (!dryRun) {
      if (!sourceId) {
        throw new Error("Failed to resolve import source");
      }
      await ctx.db.insert("helpCenterImportArchives", {
        workspaceId: args.workspaceId,
        sourceId,
        importRunId,
        entityType: "article",
        importPath: article.importPath,
        parentPath: getDirectoryPath(article.importPath),
        name: article.title,
        content: article.content,
        status: article.status,
        deletedAt: now,
      });
      await ctx.db.delete(article._id);
    }
    deletedArticles += 1;
    deletedArticleIdsInRun.add(article._id);
    pushPreviewPath(deletedArticlePaths, article.importPath);
  }

  const collectionsToDelete = existingCollections
    .filter((collection) => collection.importPath && !matchedCollectionIds.has(collection._id))
    .sort((a, b) => pathDepth(b.importPath!) - pathDepth(a.importPath!));

  for (const collection of collectionsToDelete) {
    const childCollections = await ctx.db
      .query("collections")
      .withIndex("by_parent", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("parentId", collection._id)
      )
      .collect();
    const effectiveChildCollections = childCollections.filter(
      (child) => !deletedCollectionIdsInRun.has(child._id)
    );
    const childArticles = await ctx.db
      .query("articles")
      .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
      .collect();
    const effectiveChildArticles = childArticles.filter(
      (child) => !deletedArticleIdsInRun.has(child._id)
    );

    if (effectiveChildCollections.length > 0 || effectiveChildArticles.length > 0) {
      continue;
    }

    if (!dryRun) {
      if (!sourceId) {
        throw new Error("Failed to resolve import source");
      }
      await ctx.db.insert("helpCenterImportArchives", {
        workspaceId: args.workspaceId,
        sourceId,
        importRunId,
        entityType: "collection",
        importPath: collection.importPath!,
        parentPath: getParentPath(collection.importPath!),
        name: collection.name,
        description: collection.description,
        icon: collection.icon,
        deletedAt: now,
      });
      await ctx.db.delete(collection._id);
    }
    deletedCollections += 1;
    deletedCollectionIdsInRun.add(collection._id);
    pushPreviewPath(deletedCollectionPaths, collection.importPath!);
  }

  if (!dryRun) {
    if (!sourceId) {
      throw new Error("Failed to resolve import source");
    }
    await ctx.db.patch(sourceId, {
      sourceName: args.sourceName,
      rootCollectionId: args.rootCollectionId,
      updatedAt: now,
      lastImportedAt: now,
      lastImportRunId: importRunId,
      lastImportedFileCount: incomingFiles.size + incomingAssets.size,
      lastImportedCollectionCount: desiredCollectionPaths.size,
    });
  }

  const sortPaths = (paths: string[]) => paths.slice().sort((a, b) => a.localeCompare(b));

  return {
    sourceId,
    sourceKey,
    sourceLabel: formatSourceLabel(args.sourceName, args.rootCollectionId),
    importRunId,
    dryRun,
    createdCollections,
    updatedCollections,
    createdArticles,
    updatedArticles,
    deletedArticles,
    deletedCollections,
    totalFiles: incomingFiles.size,
    totalAssets: incomingAssets.size,
    totalCollections: desiredCollectionPaths.size,
    strippedRootFolder: commonRootFolder ?? undefined,
    unresolvedImageReferences: Array.from(unresolvedImageReferenceSet).sort((a, b) =>
      a.localeCompare(b)
    ),
    preview: {
      collections: {
        create: sortPaths(createdCollectionPaths),
        update: sortPaths(updatedCollectionPaths),
        delete: sortPaths(deletedCollectionPaths),
      },
      articles: {
        create: sortPaths(createdArticlePaths),
        update: sortPaths(updatedArticlePaths),
        delete: sortPaths(deletedArticlePaths),
      },
    },
  };
}
