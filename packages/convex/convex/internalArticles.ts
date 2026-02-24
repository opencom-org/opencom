import { v } from "convex/values";
import { internal } from "./_generated/api";
import { authMutation, authQuery } from "./lib/authWrappers";

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

    // Validate folder exists if provided
    if (args.folderId) {
      const folder = await ctx.db.get(args.folderId);
      if (!folder || folder.workspaceId !== args.workspaceId) {
        throw new Error("Folder not found");
      }
    }

    const articleId = await ctx.db.insert("internalArticles", {
      workspaceId: args.workspaceId,
      folderId: args.folderId,
      title: args.title,
      content: args.content,
      tags: args.tags,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      authorId: args.authorId,
    });

    return articleId;
  },
});

export const update = authMutation({
  args: {
    id: v.id("internalArticles"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    folderId: v.optional(v.id("contentFolders")),
    tags: v.optional(v.array(v.string())),
  },
  permission: "articles.create",
  resolveWorkspaceId: async (ctx, args) => {
    const article = await ctx.db.get(args.id);
    return article?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const article = await ctx.db.get(args.id);
    if (!article) {
      throw new Error("Article not found");
    }

    const updates: {
      title?: string;
      content?: string;
      folderId?: typeof args.folderId;
      tags?: string[];
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined) {
      updates.title = args.title;
    }
    if (args.content !== undefined) {
      updates.content = args.content;
    }
    if (args.folderId !== undefined) {
      updates.folderId = args.folderId;
    }
    if (args.tags !== undefined) {
      updates.tags = args.tags;
    }

    await ctx.db.patch(args.id, updates);

    if (
      article.status === "published" &&
      (args.title !== undefined || args.content !== undefined)
    ) {
      await ctx.scheduler.runAfter(0, internal.embeddings.generateInternal, {
        workspaceId: article.workspaceId,
        contentType: "internalArticle",
        contentId: args.id,
        title: args.title ?? article.title,
        content: args.content ?? article.content,
      });
    }

    return args.id;
  },
});

export const remove = authMutation({
  args: {
    id: v.id("internalArticles"),
  },
  permission: "articles.delete",
  resolveWorkspaceId: async (ctx, args) => {
    const article = await ctx.db.get(args.id);
    return article?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const article = await ctx.db.get(args.id);
    if (!article) {
      throw new Error("Article not found");
    }
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const get = authQuery({
  args: {
    id: v.id("internalArticles"),
  },
  permission: "articles.read",
  allowMissingWorkspace: true,
  resolveWorkspaceId: async (ctx, args) => {
    const article = await ctx.db.get(args.id);
    return article?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const list = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(v.union(v.literal("draft"), v.literal("published"), v.literal("archived"))),
    folderId: v.optional(v.id("contentFolders")),
    tags: v.optional(v.array(v.string())),
  },
  permission: "articles.read",
  handler: async (ctx, args) => {
    let articles;

    if (args.folderId) {
      articles = await ctx.db
        .query("internalArticles")
        .withIndex("by_folder", (q) => q.eq("folderId", args.folderId))
        .collect();
      // Filter by workspace
      articles = articles.filter((a) => a.workspaceId === args.workspaceId);
    } else if (args.status) {
      articles = await ctx.db
        .query("internalArticles")
        .withIndex("by_status", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("status", args.status as "draft" | "published" | "archived")
        )
        .collect();
    } else {
      articles = await ctx.db
        .query("internalArticles")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect();
    }

    // Filter by status if folderId was used
    if (args.folderId && args.status) {
      articles = articles.filter((a) => a.status === args.status);
    }

    // Filter by tags if provided
    if (args.tags && args.tags.length > 0) {
      articles = articles.filter((a) => a.tags && args.tags!.some((tag) => a.tags!.includes(tag)));
    }

    return articles.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const publish = authMutation({
  args: {
    id: v.id("internalArticles"),
  },
  permission: "articles.publish",
  resolveWorkspaceId: async (ctx, args) => {
    const article = await ctx.db.get(args.id);
    return article?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const article = await ctx.db.get(args.id);
    if (!article) {
      throw new Error("Article not found");
    }

    await ctx.db.patch(args.id, {
      status: "published",
      publishedAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.embeddings.generateInternal, {
      workspaceId: article.workspaceId,
      contentType: "internalArticle",
      contentId: args.id,
      title: article.title,
      content: article.content,
    });

    return args.id;
  },
});

export const unpublish = authMutation({
  args: {
    id: v.id("internalArticles"),
  },
  permission: "articles.publish",
  resolveWorkspaceId: async (ctx, args) => {
    const article = await ctx.db.get(args.id);
    return article?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const article = await ctx.db.get(args.id);
    if (!article) {
      throw new Error("Article not found");
    }

    await ctx.db.patch(args.id, {
      status: "draft",
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

export const archive = authMutation({
  args: {
    id: v.id("internalArticles"),
  },
  permission: "articles.publish",
  resolveWorkspaceId: async (ctx, args) => {
    const article = await ctx.db.get(args.id);
    return article?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const article = await ctx.db.get(args.id);
    if (!article) {
      throw new Error("Article not found");
    }

    await ctx.db.patch(args.id, {
      status: "archived",
      updatedAt: Date.now(),
    });

    return args.id;
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

    let articles = await ctx.db
      .query("internalArticles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    if (args.publishedOnly) {
      articles = articles.filter((a) => a.status === "published");
    } else {
      // Exclude archived by default
      articles = articles.filter((a) => a.status !== "archived");
    }

    return articles
      .filter(
        (article) =>
          article.title.toLowerCase().includes(searchTerm) ||
          article.content.toLowerCase().includes(searchTerm) ||
          (article.tags && article.tags.some((tag) => tag.toLowerCase().includes(searchTerm)))
      )
      .slice(0, 20);
  },
});

export const getAllTags = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  permission: "articles.read",
  handler: async (ctx, args) => {
    const articles = await ctx.db
      .query("internalArticles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const tagSet = new Set<string>();
    for (const article of articles) {
      if (article.tags) {
        for (const tag of article.tags) {
          tagSet.add(tag);
        }
      }
    }

    return Array.from(tagSet).sort();
  },
});
