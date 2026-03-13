import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { ensureUniqueSlug, generateSlug } from "../utils/strings";
import {
  getDirectoryPath,
  getNextArticleOrder,
  getNextCollectionOrder,
  getParentPath,
  humanizeName,
  pathDepth,
} from "./pathUtils";

interface RestoreRunArgs {
  workspaceId: Id<"workspaces">;
  sourceId: Id<"helpCenterImportSources">;
  importRunId: string;
}

export async function runRestoreRun(ctx: MutationCtx, args: RestoreRunArgs) {
  const source = await ctx.db.get(args.sourceId);
  if (!source || source.workspaceId !== args.workspaceId) {
    throw new Error("Import source not found");
  }

  const allEntries = await ctx.db
    .query("helpCenterImportArchives")
    .withIndex("by_workspace_source_run", (q) =>
      q
        .eq("workspaceId", args.workspaceId)
        .eq("sourceId", args.sourceId)
        .eq("importRunId", args.importRunId)
    )
    .collect();

  const entries = allEntries.filter((entry) => !entry.restoredAt);
  if (entries.length === 0) {
    return {
      restoredCollections: 0,
      restoredArticles: 0,
    };
  }

  const now = Date.now();
  const existingCollections = await ctx.db
    .query("collections")
    .withIndex("by_workspace_import_source", (q) =>
      q.eq("workspaceId", args.workspaceId).eq("importSourceId", args.sourceId)
    )
    .collect();
  const existingArticles = await ctx.db
    .query("articles")
    .withIndex("by_workspace_import_source", (q) =>
      q.eq("workspaceId", args.workspaceId).eq("importSourceId", args.sourceId)
    )
    .collect();

  const collectionPathToId = new Map<string, Id<"collections">>();
  for (const collection of existingCollections) {
    if (collection.importPath) {
      collectionPathToId.set(collection.importPath, collection._id);
    }
  }

  const articlePathToDoc = new Map(
    existingArticles
      .filter((article) => article.importPath)
      .map((article) => [article.importPath!, article] as const)
  );

  const collectionEntries = entries
    .filter((entry) => entry.entityType === "collection")
    .sort((a, b) => pathDepth(a.importPath) - pathDepth(b.importPath));
  const collectionArchiveByPath = new Map(
    collectionEntries.map((entry) => [entry.importPath, entry] as const)
  );

  const ensureCollectionPath = async (collectionPath: string): Promise<Id<"collections">> => {
    const existingId = collectionPathToId.get(collectionPath);
    if (existingId) {
      return existingId;
    }

    const archiveEntry = collectionArchiveByPath.get(collectionPath);
    const parentPath = archiveEntry?.parentPath ?? getParentPath(collectionPath);
    const parentId = parentPath
      ? await ensureCollectionPath(parentPath)
      : source.rootCollectionId;
    const collectionName =
      archiveEntry?.name ?? humanizeName(collectionPath.split("/").pop() ?? "");
    const slug = await ensureUniqueSlug(
      ctx.db,
      "collections",
      args.workspaceId,
      generateSlug(collectionName)
    );
    const order = await getNextCollectionOrder(ctx, args.workspaceId, parentId);

    const collectionId = await ctx.db.insert("collections", {
      workspaceId: args.workspaceId,
      name: collectionName,
      slug,
      description: archiveEntry?.description,
      icon: archiveEntry?.icon,
      parentId,
      order,
      importSourceId: args.sourceId,
      importPath: collectionPath,
      createdAt: now,
      updatedAt: now,
    });
    collectionPathToId.set(collectionPath, collectionId);
    return collectionId;
  };

  let restoredCollections = 0;
  for (const entry of collectionEntries) {
    if (collectionPathToId.has(entry.importPath)) {
      continue;
    }
    await ensureCollectionPath(entry.importPath);
    restoredCollections += 1;
  }

  let restoredArticles = 0;
  const articleEntries = entries
    .filter((entry) => entry.entityType === "article")
    .sort((a, b) => a.importPath.localeCompare(b.importPath));
  for (const entry of articleEntries) {
    const collectionPath = entry.parentPath ?? getDirectoryPath(entry.importPath);
    const collectionId = collectionPath
      ? await ensureCollectionPath(collectionPath)
      : source.rootCollectionId;
    const existingArticle = articlePathToDoc.get(entry.importPath);

    if (existingArticle) {
      const updates: {
        title?: string;
        slug?: string;
        content?: string;
        status?: "draft" | "published" | "archived";
        collectionId?: Id<"collections">;
        publishedAt?: number;
        updatedAt?: number;
      } = {};

      if (existingArticle.title !== entry.name) {
        updates.title = entry.name;
        updates.slug = await ensureUniqueSlug(
          ctx.db,
          "articles",
          args.workspaceId,
          generateSlug(entry.name),
          existingArticle._id
        );
      }
      if (entry.content !== undefined && existingArticle.content !== entry.content) {
        updates.content = entry.content;
      }
      if (existingArticle.collectionId !== collectionId) {
        updates.collectionId = collectionId;
      }
      if (entry.status && existingArticle.status !== entry.status) {
        updates.status = entry.status;
        if (entry.status === "published") {
          updates.publishedAt = now;
        } else {
          updates.publishedAt = undefined;
        }
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = now;
        await ctx.db.patch(existingArticle._id, updates);
        restoredArticles += 1;
      }
      continue;
    }

    const slug = await ensureUniqueSlug(
      ctx.db,
      "articles",
      args.workspaceId,
      generateSlug(entry.name)
    );
    const order = await getNextArticleOrder(ctx, collectionId);
    await ctx.db.insert("articles", {
      workspaceId: args.workspaceId,
      collectionId,
      title: entry.name,
      slug,
      content: entry.content ?? "",
      status: entry.status ?? "published",
      order,
      importSourceId: args.sourceId,
      importPath: entry.importPath,
      createdAt: now,
      updatedAt: now,
      publishedAt: (entry.status ?? "published") === "published" ? now : undefined,
    });
    restoredArticles += 1;
  }

  for (const entry of entries) {
    await ctx.db.patch(entry._id, {
      restoredAt: now,
    });
  }

  await ctx.db.patch(args.sourceId, {
    updatedAt: now,
  });

  return {
    restoredCollections,
    restoredArticles,
  };
}
