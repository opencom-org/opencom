import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthenticatedUserFromSession } from "./auth";
import { authMutation } from "./lib/authWrappers";
import { evaluateRule, type AudienceRule } from "./audienceRules";
import { isPublicArticle } from "./lib/unifiedArticles";
import { requirePermission } from "./permissions";
import { resolveVisitorFromSession } from "./widgetSessions";
import {
  createCollectionCore,
  updateCollectionCore,
  deleteCollectionCore,
} from "./lib/collectionWriteHelpers";

type HelpCenterAccessPolicy = "public" | "restricted";

async function canReadHelpCenterCollections(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  userId?: Id<"users">
) {
  if (userId) {
    await requirePermission(ctx, userId, workspaceId, "articles.read");
    return true;
  }

  const workspace = await ctx.db.get(workspaceId);
  if (!workspace) {
    return false;
  }

  const policy =
    (workspace.helpCenterAccessPolicy as HelpCenterAccessPolicy | undefined) ?? "public";
  return policy === "public";
}

function articleIsReadableOnVisitorSurface(
  article: Pick<Doc<"articles">, "visibility" | "status">
) {
  return isPublicArticle(article) && article.status === "published";
}

async function resolveWidgetHelpCenterVisitor(
  ctx: QueryCtx,
  args: {
    workspaceId: Id<"workspaces">;
    visitorId?: Id<"visitors">;
    sessionToken?: string;
  }
): Promise<Doc<"visitors"> | null> {
  const authUser = await getAuthenticatedUserFromSession(ctx);
  let resolvedVisitorId = args.visitorId;

  if (authUser) {
    await requirePermission(ctx, authUser._id, args.workspaceId, "articles.read");
    if (!resolvedVisitorId) {
      return null;
    }
  } else {
    const resolved = await resolveVisitorFromSession(ctx, {
      sessionToken: args.sessionToken,
      workspaceId: args.workspaceId,
    });
    if (args.visitorId && args.visitorId !== resolved.visitorId) {
      throw new Error("Not authorized to list collections for this visitor");
    }
    resolvedVisitorId = resolved.visitorId;
  }

  if (!resolvedVisitorId) {
    return null;
  }

  const visitor = await ctx.db.get(resolvedVisitorId);
  if (!visitor || visitor.workspaceId !== args.workspaceId) {
    return null;
  }

  return visitor;
}

export const create = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    parentId: v.optional(v.id("collections")),
  },
  permission: "articles.create",
  handler: async (ctx, args) => {
    return await createCollectionCore(ctx, {
      workspaceId: args.workspaceId,
      name: args.name,
      description: args.description,
      icon: args.icon,
      parentId: args.parentId,
    });
  },
});

export const update = authMutation({
  args: {
    id: v.id("collections"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    parentId: v.optional(v.union(v.id("collections"), v.null())),
  },
  permission: "articles.create",
  resolveWorkspaceId: async (ctx, args) => {
    const collection = await ctx.db.get(args.id);
    return collection?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.id);
    if (!collection) {
      throw new Error("Collection not found");
    }

    await updateCollectionCore(ctx, collection, {
      name: args.name,
      description: args.description,
      icon: args.icon,
      parentId: args.parentId,
    });
    return args.id;
  },
});

export const remove = authMutation({
  args: {
    id: v.id("collections"),
  },
  permission: "articles.create",
  resolveWorkspaceId: async (ctx, args) => {
    const collection = await ctx.db.get(args.id);
    return collection?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.id);
    if (!collection) {
      throw new Error("Collection not found");
    }

    await deleteCollectionCore(ctx, collection);
    return { success: true };
  },
});

export const get = query({
  args: {
    id: v.optional(v.id("collections")),
    slug: v.optional(v.string()),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUserFromSession(ctx);
    const collectionById = args.id ? await ctx.db.get(args.id) : null;
    const resolvedWorkspaceId = collectionById?.workspaceId ?? args.workspaceId;

    if (!resolvedWorkspaceId) {
      return null;
    }

    const canRead = await canReadHelpCenterCollections(ctx, resolvedWorkspaceId, authUser?._id);
    if (!canRead) {
      return null;
    }

    if (collectionById) {
      return collectionById;
    }

    const slug = args.slug;
    if (slug) {
      return await ctx.db
        .query("collections")
        .withIndex("by_slug", (q) => q.eq("workspaceId", resolvedWorkspaceId).eq("slug", slug))
        .first();
    }
    return null;
  },
});

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    parentId: v.optional(v.id("collections")),
    publicOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUserFromSession(ctx);
    const canRead = await canReadHelpCenterCollections(ctx, args.workspaceId, authUser?._id);
    if (!canRead) {
      return [];
    }

    const collections = await ctx.db
      .query("collections")
      .withIndex("by_parent", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("parentId", args.parentId)
      )
      .collect();

    const enriched = await Promise.all(
      collections.map(async (collection) => {
        const articles = await ctx.db
          .query("articles")
          .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
          .collect();

        const publishedCount = articles.filter(
          (article) => isPublicArticle(article) && article.status === "published"
        ).length;

        return {
          ...collection,
          articleCount: articles.length,
          publishedArticleCount: publishedCount,
        };
      })
    );

    const sorted = enriched.sort((a, b) => a.order - b.order);
    if (authUser && !args.publicOnly) {
      return sorted;
    }

    return sorted.filter((collection) => collection.publishedArticleCount > 0);
  },
});

export const listHierarchy = query({
  args: {
    workspaceId: v.id("workspaces"),
    publicOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUserFromSession(ctx);
    const canRead = await canReadHelpCenterCollections(ctx, args.workspaceId, authUser?._id);
    if (!canRead) {
      return [];
    }

    const allCollections = await ctx.db
      .query("collections")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const enriched = await Promise.all(
      allCollections.map(async (collection) => {
        const articles = await ctx.db
          .query("articles")
          .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
          .collect();

        const publishedCount = articles.filter(
          (article) => isPublicArticle(article) && article.status === "published"
        ).length;

        return {
          ...collection,
          articleCount: articles.length,
          publishedArticleCount: publishedCount,
        };
      })
    );

    const sorted = enriched.sort((a, b) => a.order - b.order);
    if (authUser && !args.publicOnly) {
      return sorted;
    }

    return sorted.filter((collection) => collection.publishedArticleCount > 0);
  },
});

export const listHierarchyForVisitor = query({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const visitor = await resolveWidgetHelpCenterVisitor(ctx, args);
    if (!visitor) {
      return [];
    }

    const allCollections = await ctx.db
      .query("collections")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const collectionMap = new Map(
      allCollections.map((collection) => [collection._id, collection] as const)
    );

    const publishedArticles = await ctx.db
      .query("articles")
      .withIndex("by_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "published")
      )
      .collect();

    const visibleArticles: Doc<"articles">[] = [];
    for (const article of publishedArticles) {
      if (!articleIsReadableOnVisitorSurface(article)) {
        continue;
      }

      const matches = await evaluateRule(
        ctx,
        article.audienceRules as AudienceRule | undefined,
        visitor
      );
      if (matches) {
        visibleArticles.push(article);
      }
    }

    const directVisibleCollectionIds = new Set(
      visibleArticles
        .map((article) => article.collectionId)
        .filter((value): value is Id<"collections"> => Boolean(value))
    );
    const visibleCollectionIds = new Set<Id<"collections">>();

    for (const collectionId of directVisibleCollectionIds) {
      let cursor: Id<"collections"> | undefined = collectionId;
      while (cursor && !visibleCollectionIds.has(cursor)) {
        visibleCollectionIds.add(cursor);
        cursor = collectionMap.get(cursor)?.parentId;
      }
    }

    return allCollections
      .filter((collection) => visibleCollectionIds.has(collection._id))
      .map((collection) => {
        const visibleArticleCount = visibleArticles.filter(
          (article) => article.collectionId === collection._id
        ).length;
        return {
          ...collection,
          articleCount: visibleArticleCount,
          publishedArticleCount: visibleArticleCount,
        };
      })
      .sort((a, b) => a.order - b.order);
  },
});

export const reorder = authMutation({
  args: {
    id: v.id("collections"),
    newOrder: v.number(),
  },
  permission: "articles.create",
  resolveWorkspaceId: async (ctx, args) => {
    const collection = await ctx.db.get(args.id);
    return collection?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.id);
    if (!collection) {
      throw new Error("Collection not found");
    }

    await ctx.db.patch(args.id, {
      order: args.newOrder,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});
