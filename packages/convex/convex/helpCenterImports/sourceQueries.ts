import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

interface ListSourcesArgs {
  workspaceId: Id<"workspaces">;
}

interface ListHistoryArgs {
  workspaceId: Id<"workspaces">;
  sourceId?: Id<"helpCenterImportSources">;
  limit?: number;
}

export async function runListSources(ctx: QueryCtx, args: ListSourcesArgs) {
  const sources = await ctx.db
    .query("helpCenterImportSources")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
    .collect();

  const rootCollectionIds = Array.from(
    new Set(
      sources
        .map((source) => source.rootCollectionId)
        .filter((collectionId): collectionId is Id<"collections"> => Boolean(collectionId))
    )
  );

  const rootCollections = new Map<Id<"collections">, string>();
  for (const collectionId of rootCollectionIds) {
    const collection = await ctx.db.get(collectionId);
    if (collection) {
      rootCollections.set(collectionId, collection.name);
    }
  }

  return sources
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((source) => ({
      ...source,
      rootCollectionName: source.rootCollectionId
        ? rootCollections.get(source.rootCollectionId)
        : undefined,
    }));
}

export async function runListHistory(ctx: QueryCtx, args: ListHistoryArgs) {
  const limit = Math.max(1, Math.min(args.limit ?? 25, 100));
  const sourceId = args.sourceId;
  const archives = sourceId
    ? await ctx.db
        .query("helpCenterImportArchives")
        .withIndex("by_workspace_source", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("sourceId", sourceId)
        )
        .collect()
    : await ctx.db
        .query("helpCenterImportArchives")
        .withIndex("by_workspace_deleted_at", (q) => q.eq("workspaceId", args.workspaceId))
        .collect();

  const sourceMap = new Map<string, string>();
  const sourceIds = Array.from(new Set(archives.map((entry) => entry.sourceId)));
  for (const sourceId of sourceIds) {
    const source = await ctx.db.get(sourceId);
    if (source) {
      sourceMap.set(sourceId, source.sourceName);
    }
  }

  const groups = new Map<
    string,
    {
      sourceId: Id<"helpCenterImportSources">;
      sourceName: string;
      importRunId: string;
      deletedAt: number;
      deletedArticles: number;
      deletedCollections: number;
      restoredEntries: number;
      totalEntries: number;
    }
  >();

  for (const entry of archives) {
    const groupKey = `${entry.sourceId}:${entry.importRunId}`;
    const existing = groups.get(groupKey);
    if (!existing) {
      groups.set(groupKey, {
        sourceId: entry.sourceId,
        sourceName: sourceMap.get(entry.sourceId) ?? "Unknown source",
        importRunId: entry.importRunId,
        deletedAt: entry.deletedAt,
        deletedArticles: entry.entityType === "article" ? 1 : 0,
        deletedCollections: entry.entityType === "collection" ? 1 : 0,
        restoredEntries: entry.restoredAt ? 1 : 0,
        totalEntries: 1,
      });
      continue;
    }

    existing.deletedAt = Math.max(existing.deletedAt, entry.deletedAt);
    if (entry.entityType === "article") {
      existing.deletedArticles += 1;
    } else {
      existing.deletedCollections += 1;
    }
    if (entry.restoredAt) {
      existing.restoredEntries += 1;
    }
    existing.totalEntries += 1;
  }

  return Array.from(groups.values())
    .sort((a, b) => b.deletedAt - a.deletedAt)
    .slice(0, limit)
    .map((group) => ({
      ...group,
      restorableEntries: group.totalEntries - group.restoredEntries,
    }));
}
