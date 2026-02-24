import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  evaluateRule,
  countMatchingVisitors,
  AudienceRule,
  validateAudienceRule,
} from "./audienceRules";
import { Doc, Id } from "./_generated/dataModel";
import { getAuthenticatedUserFromSession } from "./auth";
import { authMutation } from "./lib/authWrappers";
import { requirePermission } from "./permissions";
import { resolveVisitorFromSession } from "./widgetSessions";
import { generateSlug, ensureUniqueSlug } from "./utils/strings";
import { throwNotAuthenticated, createError } from "./utils/errors";
import { audienceRulesValidator } from "./validators";

type HelpCenterAccessPolicy = "public" | "restricted";

async function canReadHelpCenterArticles(
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

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    content: v.string(),
    collectionId: v.optional(v.id("collections")),
    authorId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throwNotAuthenticated();
    }
    await requirePermission(ctx, user._id, args.workspaceId, "articles.create");

    const now = Date.now();
    const baseSlug = generateSlug(args.title);
    const slug = await ensureUniqueSlug(ctx.db, "articles", args.workspaceId, baseSlug);

    // Get max order for the collection
    const articles = await ctx.db
      .query("articles")
      .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
      .collect();
    const maxOrder = articles.reduce((max, a) => Math.max(max, a.order), 0);

    const articleId = await ctx.db.insert("articles", {
      workspaceId: args.workspaceId,
      collectionId: args.collectionId,
      title: args.title,
      slug,
      content: args.content,
      status: "draft",
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
      authorId: args.authorId,
    });

    return articleId;
  },
});

export const update = mutation({
  args: {
    id: v.id("articles"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    collectionId: v.optional(v.id("collections")),
    folderId: v.optional(v.id("contentFolders")),
    audienceRules: v.optional(audienceRulesValidator),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throwNotAuthenticated();
    }

    const article = await ctx.db.get(args.id);
    if (!article) {
      throw createError("NOT_FOUND", "Article not found");
    }

    await requirePermission(ctx, user._id, article.workspaceId, "articles.create");

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined && args.title !== article.title) {
      updates.title = args.title;
      const baseSlug = generateSlug(args.title);
      updates.slug = await ensureUniqueSlug(
        ctx.db,
        "articles",
        article.workspaceId,
        baseSlug,
        args.id
      );
    }

    if (args.content !== undefined) {
      updates.content = args.content;
    }

    if (args.collectionId !== undefined) {
      updates.collectionId = args.collectionId;
    }

    if (args.folderId !== undefined) {
      updates.folderId = args.folderId;
    }

    if (args.audienceRules !== undefined) {
      if (!validateAudienceRule(args.audienceRules)) {
        throw createError("INVALID_INPUT", "Invalid audience rules");
      }
      updates.audienceRules = args.audienceRules;
    }

    await ctx.db.patch(args.id, updates);

    if (
      article.status === "published" &&
      (args.title !== undefined || args.content !== undefined)
    ) {
      await ctx.scheduler.runAfter(0, internal.embeddings.generateInternal, {
        workspaceId: article.workspaceId,
        contentType: "article",
        contentId: args.id,
        title: args.title ?? article.title,
        content: args.content ?? article.content,
      });
    }

    return args.id;
  },
});

export const remove = mutation({
  args: {
    id: v.id("articles"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throwNotAuthenticated();
    }

    const article = await ctx.db.get(args.id);
    if (!article) {
      throw createError("NOT_FOUND", "Article not found");
    }

    await requirePermission(ctx, user._id, article.workspaceId, "articles.delete");

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const get = query({
  args: {
    id: v.optional(v.id("articles")),
    slug: v.optional(v.string()),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUserFromSession(ctx);
    const articleById = args.id ? await ctx.db.get(args.id) : null;
    const resolvedWorkspaceId = articleById?.workspaceId ?? args.workspaceId;

    if (!resolvedWorkspaceId) {
      return null;
    }

    const canRead = await canReadHelpCenterArticles(ctx, resolvedWorkspaceId, authUser?._id);
    if (!canRead) {
      return null;
    }

    if (articleById) {
      if (authUser) {
        return articleById;
      }
      return articleById.status === "published" ? articleById : null;
    }

    const slug = args.slug;
    if (slug) {
      const article = await ctx.db
        .query("articles")
        .withIndex("by_slug", (q) => q.eq("workspaceId", resolvedWorkspaceId).eq("slug", slug))
        .first();

      if (!article) {
        return null;
      }
      if (authUser) {
        return article;
      }
      return article.status === "published" ? article : null;
    }

    return null;
  },
});

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(v.union(v.literal("draft"), v.literal("published"))),
    collectionId: v.optional(v.id("collections")),
  },
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUserFromSession(ctx);
    const canRead = await canReadHelpCenterArticles(ctx, args.workspaceId, authUser?._id);
    if (!canRead) {
      return [];
    }

    let articles;

    if (args.collectionId) {
      articles = await ctx.db
        .query("articles")
        .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
        .collect();
    } else if (args.status) {
      articles = await ctx.db
        .query("articles")
        .withIndex("by_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", args.status as "draft" | "published")
        )
        .collect();
    } else {
      articles = await ctx.db
        .query("articles")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect();
    }

    // Filter by status if collectionId was used
    if (args.collectionId && args.status) {
      articles = articles.filter((a) => a.status === args.status);
    }

    if (args.collectionId) {
      articles = articles.filter((a) => a.workspaceId === args.workspaceId);
    }

    if (!authUser) {
      articles = articles.filter((a) => a.status === "published");
    }

    return articles.sort((a, b) => a.order - b.order);
  },
});

export const search = query({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    publishedOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUserFromSession(ctx);
    const canRead = await canReadHelpCenterArticles(ctx, args.workspaceId, authUser?._id);
    if (!canRead) {
      return [];
    }

    const searchTerm = args.query.toLowerCase();

    let articles = await ctx.db
      .query("articles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    if (args.publishedOnly || !authUser) {
      articles = articles.filter((a) => a.status === "published");
    }

    return articles
      .filter(
        (article) =>
          article.title.toLowerCase().includes(searchTerm) ||
          article.content.toLowerCase().includes(searchTerm)
      )
      .slice(0, 20);
  },
});

export const publish = authMutation({
  args: {
    id: v.id("articles"),
  },
  permission: "articles.publish",
  resolveWorkspaceId: async (ctx, args) => {
    const article = await ctx.db.get(args.id);
    return article?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const article = await ctx.db.get(args.id);
    if (!article) {
      throw createError("NOT_FOUND", "Article not found");
    }

    await ctx.db.patch(args.id, {
      status: "published",
      publishedAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.embeddings.generateInternal, {
      workspaceId: article.workspaceId,
      contentType: "article",
      contentId: args.id,
      title: article.title,
      content: article.content,
    });

    return args.id;
  },
});

export const unpublish = authMutation({
  args: {
    id: v.id("articles"),
  },
  permission: "articles.publish",
  resolveWorkspaceId: async (ctx, args) => {
    const article = await ctx.db.get(args.id);
    return article?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const article = await ctx.db.get(args.id);
    if (!article) {
      throw createError("NOT_FOUND", "Article not found");
    }

    await ctx.db.patch(args.id, {
      status: "draft",
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

export const submitFeedback = mutation({
  args: {
    articleId: v.id("articles"),
    helpful: v.boolean(),
    visitorId: v.optional(v.id("visitors")),
  },
  handler: async (ctx, args) => {
    const feedbackId = await ctx.db.insert("articleFeedback", {
      articleId: args.articleId,
      helpful: args.helpful,
      visitorId: args.visitorId,
      createdAt: Date.now(),
    });
    return feedbackId;
  },
});

export const getFeedbackStats = query({
  args: {
    articleId: v.id("articles"),
  },
  handler: async (ctx, args) => {
    const feedback = await ctx.db
      .query("articleFeedback")
      .withIndex("by_article", (q) => q.eq("articleId", args.articleId))
      .collect();

    const helpful = feedback.filter((f) => f.helpful).length;
    const notHelpful = feedback.filter((f) => !f.helpful).length;

    return {
      helpful,
      notHelpful,
      total: feedback.length,
    };
  },
});

export const listForVisitor = query({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    collectionId: v.optional(v.id("collections")),
  },
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUserFromSession(ctx);
    let resolvedVisitorId = args.visitorId;

    if (authUser) {
      await requirePermission(ctx, authUser._id, args.workspaceId, "articles.read");
      if (!resolvedVisitorId) {
        return [];
      }
    } else {
      const canRead = await canReadHelpCenterArticles(ctx, args.workspaceId);
      if (!canRead) {
        return [];
      }

      const resolved = await resolveVisitorFromSession(ctx, {
        sessionToken: args.sessionToken,
        workspaceId: args.workspaceId,
      });
      if (args.visitorId && args.visitorId !== resolved.visitorId) {
        throw new Error("Not authorized to list articles for this visitor");
      }
      resolvedVisitorId = resolved.visitorId;
    }

    if (!resolvedVisitorId) {
      return [];
    }

    const visitor = await ctx.db.get(resolvedVisitorId);
    if (!visitor || visitor.workspaceId !== args.workspaceId) {
      return [];
    }

    let articles;
    if (args.collectionId) {
      articles = await ctx.db
        .query("articles")
        .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
        .collect();
      articles = articles.filter((a) => a.status === "published");
    } else {
      articles = await ctx.db
        .query("articles")
        .withIndex("by_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", "published")
        )
        .collect();
    }

    const filteredArticles: Doc<"articles">[] = [];
    for (const article of articles) {
      const matches = await evaluateRule(
        ctx,
        article.audienceRules as AudienceRule | undefined,
        visitor
      );
      if (matches) {
        filteredArticles.push(article);
      }
    }

    return filteredArticles.sort((a, b) => a.order - b.order);
  },
});

export const searchForVisitor = query({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUserFromSession(ctx);
    let resolvedVisitorId = args.visitorId;

    if (authUser) {
      await requirePermission(ctx, authUser._id, args.workspaceId, "articles.read");
      if (!resolvedVisitorId) {
        return [];
      }
    } else {
      const canRead = await canReadHelpCenterArticles(ctx, args.workspaceId);
      if (!canRead) {
        return [];
      }

      const resolved = await resolveVisitorFromSession(ctx, {
        sessionToken: args.sessionToken,
        workspaceId: args.workspaceId,
      });
      if (args.visitorId && args.visitorId !== resolved.visitorId) {
        throw new Error("Not authorized to search articles for this visitor");
      }
      resolvedVisitorId = resolved.visitorId;
    }

    if (!resolvedVisitorId) {
      return [];
    }

    const visitor = await ctx.db.get(resolvedVisitorId);
    if (!visitor || visitor.workspaceId !== args.workspaceId) {
      return [];
    }

    const searchTerm = args.query.toLowerCase();

    const articles = await ctx.db
      .query("articles")
      .withIndex("by_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "published")
      )
      .collect();

    const matchingArticles = articles.filter(
      (article) =>
        article.title.toLowerCase().includes(searchTerm) ||
        article.content.toLowerCase().includes(searchTerm)
    );

    const filteredArticles: Doc<"articles">[] = [];
    for (const article of matchingArticles) {
      const matches = await evaluateRule(
        ctx,
        article.audienceRules as AudienceRule | undefined,
        visitor
      );
      if (matches) {
        filteredArticles.push(article);
      }
    }

    return filteredArticles.slice(0, 20);
  },
});

export const previewAudience = query({
  args: {
    workspaceId: v.id("workspaces"),
    audienceRules: v.optional(audienceRulesValidator),
  },
  handler: async (ctx, args) => {
    return await countMatchingVisitors(
      ctx,
      args.workspaceId,
      args.audienceRules as AudienceRule | undefined
    );
  },
});
