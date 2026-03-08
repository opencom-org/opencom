import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { authMutation, authQuery } from "./lib/authWrappers";
import {
  articleOrLegacyInternalArticleIdValidator,
  articleStatusValidator,
  getUnifiedArticleByIdOrLegacyInternalId,
  listUnifiedArticlesWithLegacyFallback,
  toCompatibilityArticle,
  type CompatibilityArticle,
} from "./lib/unifiedArticles";
import { createError } from "./utils/errors";
import { ensureUniqueSlug, generateSlug } from "./utils/strings";

type InternalArticleId = Id<"articles"> | Id<"internalArticles">;
type ArticleContext = QueryCtx | MutationCtx;

function isInternalArticleRecord(article: CompatibilityArticle): boolean {
  return article.visibility === "internal";
}

function toInternalArticleCompatibility(article: CompatibilityArticle) {
  return {
    ...article,
    folderId: article.legacyFolderId,
  };
}

async function resolveInternalArticle(
  ctx: Pick<ArticleContext, "db">,
  id: InternalArticleId
): Promise<
  | { kind: "article"; article: Doc<"articles"> }
  | { kind: "legacyInternal"; article: Doc<"internalArticles"> }
  | null
> {
  const article = await getUnifiedArticleByIdOrLegacyInternalId(ctx.db, id);
  if (article && article.visibility === "internal") {
    return { kind: "article", article };
  }

  const legacyArticle = (await ctx.db.get(id as Id<"internalArticles">)) as Doc<"internalArticles"> | null;
  if (legacyArticle) {
    return { kind: "legacyInternal", article: legacyArticle };
  }

  return null;
}

async function listInternalArticlesForWorkspace(
  db: ArticleContext["db"],
  workspaceId: Id<"workspaces">
) {
  const records = await listUnifiedArticlesWithLegacyFallback(db, workspaceId);
  return records.filter(isInternalArticleRecord);
}

export const create = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    content: v.string(),
    folderId: v.optional(v.id("contentFolders")),
    tags: v.optional(v.array(v.string())),
    authorId: v.optional(v.id("users")),
  },
  permission: "articles.create",
  handler: async (ctx, args) => {
    const now = Date.now();
    const baseSlug = generateSlug(args.title);
    const slug = await ensureUniqueSlug(ctx.db, "articles", args.workspaceId, baseSlug);

    const rootArticles = (await ctx.db
      .query("articles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect()) as Doc<"articles">[];
    const maxOrder = rootArticles
      .filter((article) => !article.collectionId)
      .reduce((max, article) => Math.max(max, article.order), 0);

    return await ctx.db.insert("articles", {
      workspaceId: args.workspaceId,
      collectionId: undefined,
      folderId: undefined,
      title: args.title,
      slug,
      content: args.content,
      widgetLargeScreen: false,
      visibility: "internal",
      status: "draft",
      order: maxOrder + 1,
      createdAt: now,
      updatedAt: now,
      authorId: args.authorId,
      tags: args.tags,
      legacyFolderId: args.folderId,
    });
  },
});

export const update = authMutation({
  args: {
    id: articleOrLegacyInternalArticleIdValidator,
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    folderId: v.optional(v.id("contentFolders")),
    tags: v.optional(v.array(v.string())),
  },
  permission: "articles.create",
  resolveWorkspaceId: async (ctx, args) => {
    const article = await resolveInternalArticle(ctx, args.id);
    return article?.article.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const article = await resolveInternalArticle(ctx, args.id);
    if (!article) {
      throw createError("NOT_FOUND", "Article not found");
    }

    if (article.kind === "legacyInternal") {
      await ctx.db.patch(article.article._id, {
        title: args.title ?? article.article.title,
        content: args.content ?? article.article.content,
        tags: args.tags ?? article.article.tags,
        folderId: args.folderId ?? article.article.folderId,
        updatedAt: Date.now(),
      });

      if (
        article.article.status === "published" &&
        (args.title !== undefined || args.content !== undefined)
      ) {
        // @ts-ignore Convex generated type graph can exceed TS instantiation depth.
        await ctx.scheduler.runAfter(0, internal.embeddings.generateInternal, {
          workspaceId: article.article.workspaceId,
          contentType: "internalArticle",
          contentId: article.article._id,
          title: args.title ?? article.article.title,
          content: args.content ?? article.article.content,
        });
      }

      return article.article._id;
    }

    const updates: Partial<Doc<"articles">> & { updatedAt: number } = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined && args.title !== article.article.title) {
      updates.title = args.title;
      updates.slug = await ensureUniqueSlug(
        ctx.db,
        "articles",
        article.article.workspaceId,
        generateSlug(args.title),
        article.article._id
      );
    }
    if (args.content !== undefined) {
      updates.content = args.content;
    }
    if (args.tags !== undefined) {
      updates.tags = args.tags;
    }
    if (args.folderId !== undefined) {
      updates.legacyFolderId = args.folderId;
      updates.folderId = undefined;
    }

    await ctx.db.patch(article.article._id, updates);

    if (
      article.article.status === "published" &&
      (args.title !== undefined || args.content !== undefined)
    ) {
      // @ts-ignore Convex generated type graph can exceed TS instantiation depth.
      await ctx.scheduler.runAfter(0, internal.embeddings.generateInternal, {
        workspaceId: article.article.workspaceId,
        contentType: "internalArticle",
        contentId: article.article._id,
        title: args.title ?? article.article.title,
        content: args.content ?? article.article.content,
      });
    }

    return article.article._id;
  },
});

export const remove = authMutation({
  args: {
    id: articleOrLegacyInternalArticleIdValidator,
  },
  permission: "articles.delete",
  resolveWorkspaceId: async (ctx, args) => {
    const article = await resolveInternalArticle(ctx, args.id);
    return article?.article.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const article = await resolveInternalArticle(ctx, args.id);
    if (!article) {
      throw createError("NOT_FOUND", "Article not found");
    }

    await ctx.db.delete(article.article._id);
    // @ts-ignore Convex generated type graph can exceed TS instantiation depth.
    await ctx.scheduler.runAfter(0, internal.embeddings.remove, {
      contentType: "internalArticle",
      contentId: article.article._id,
    });
    return { success: true };
  },
});

export const get = authQuery({
  args: {
    id: articleOrLegacyInternalArticleIdValidator,
  },
  permission: "articles.read",
  allowMissingWorkspace: true,
  resolveWorkspaceId: async (ctx, args) => {
    const article = await resolveInternalArticle(ctx, args.id);
    return article?.article.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const article = await resolveInternalArticle(ctx, args.id);
    if (!article) {
      return null;
    }

    if (article.kind === "legacyInternal") {
      return toInternalArticleCompatibility(toCompatibilityArticle(article.article));
    }

    return toInternalArticleCompatibility({
      ...article.article,
      folderId: article.article.legacyFolderId,
    });
  },
});

export const list = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(articleStatusValidator),
    folderId: v.optional(v.id("contentFolders")),
    tags: v.optional(v.array(v.string())),
  },
  permission: "articles.read",
  handler: async (ctx, args) => {
    let articles = await listInternalArticlesForWorkspace(ctx.db, args.workspaceId);

    if (args.status) {
      articles = articles.filter((article) => article.status === args.status);
    }

    if (args.folderId) {
      articles = articles.filter((article) => article.legacyFolderId === args.folderId);
    }

    if (args.tags && args.tags.length > 0) {
      articles = articles.filter(
        (article) => article.tags && args.tags!.some((tag) => article.tags!.includes(tag))
      );
    }

    return [...articles]
      .map((article) => toInternalArticleCompatibility(article))
      .sort((left, right) => right.updatedAt - left.updatedAt);
  },
});

export const publish = authMutation({
  args: {
    id: articleOrLegacyInternalArticleIdValidator,
  },
  permission: "articles.publish",
  resolveWorkspaceId: async (ctx, args) => {
    const article = await resolveInternalArticle(ctx, args.id);
    return article?.article.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const article = await resolveInternalArticle(ctx, args.id);
    if (!article) {
      throw createError("NOT_FOUND", "Article not found");
    }

    await ctx.db.patch(article.article._id, {
      status: "published",
      publishedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // @ts-ignore Convex generated type graph can exceed TS instantiation depth.
    await ctx.scheduler.runAfter(0, internal.embeddings.generateInternal, {
      workspaceId: article.article.workspaceId,
      contentType: "internalArticle",
      contentId: article.article._id,
      title: article.article.title,
      content: article.article.content,
    });

    return article.article._id;
  },
});

export const unpublish = authMutation({
  args: {
    id: articleOrLegacyInternalArticleIdValidator,
  },
  permission: "articles.publish",
  resolveWorkspaceId: async (ctx, args) => {
    const article = await resolveInternalArticle(ctx, args.id);
    return article?.article.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const article = await resolveInternalArticle(ctx, args.id);
    if (!article) {
      throw createError("NOT_FOUND", "Article not found");
    }

    await ctx.db.patch(article.article._id, {
      status: "draft",
      publishedAt: undefined,
      updatedAt: Date.now(),
    });

    // @ts-ignore Convex generated type graph can exceed TS instantiation depth.
    await ctx.scheduler.runAfter(0, internal.embeddings.remove, {
      contentType: "internalArticle",
      contentId: article.article._id,
    });

    return article.article._id;
  },
});

export const archive = authMutation({
  args: {
    id: articleOrLegacyInternalArticleIdValidator,
  },
  permission: "articles.publish",
  resolveWorkspaceId: async (ctx, args) => {
    const article = await resolveInternalArticle(ctx, args.id);
    return article?.article.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const article = await resolveInternalArticle(ctx, args.id);
    if (!article) {
      throw createError("NOT_FOUND", "Article not found");
    }

    await ctx.db.patch(article.article._id, {
      status: "archived",
      updatedAt: Date.now(),
    });

    // @ts-ignore Convex generated type graph can exceed TS instantiation depth.
    await ctx.scheduler.runAfter(0, internal.embeddings.remove, {
      contentType: "internalArticle",
      contentId: article.article._id,
    });

    return article.article._id;
  },
});

export const search = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    publishedOnly: v.optional(v.boolean()),
  },
  permission: "articles.read",
  handler: async (ctx, args) => {
    const searchTerm = args.query.toLowerCase();
    let articles = await listInternalArticlesForWorkspace(ctx.db, args.workspaceId);

    articles = args.publishedOnly
      ? articles.filter((article) => article.status === "published")
      : articles.filter((article) => article.status !== "archived");

    return articles
      .filter(
        (article) =>
          article.title.toLowerCase().includes(searchTerm) ||
          article.content.toLowerCase().includes(searchTerm) ||
          (article.tags && article.tags.some((tag) => tag.toLowerCase().includes(searchTerm)))
      )
      .map((article) => toInternalArticleCompatibility(article))
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, 20);
  },
});

export const getAllTags = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  permission: "articles.read",
  handler: async (ctx, args) => {
    const articles = await listInternalArticlesForWorkspace(ctx.db, args.workspaceId);

    const tagSet = new Set<string>();
    for (const article of articles) {
      for (const tag of article.tags ?? []) {
        tagSet.add(tag);
      }
    }

    return Array.from(tagSet).sort();
  },
});
