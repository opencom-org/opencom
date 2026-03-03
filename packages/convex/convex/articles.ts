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
import { authMutation, authQuery } from "./lib/authWrappers";
import { requirePermission } from "./permissions";
import { resolveVisitorFromSession } from "./widgetSessions";
import { generateSlug, ensureUniqueSlug } from "./utils/strings";
import { throwNotAuthenticated, createError } from "./utils/errors";
import { audienceRulesValidator } from "./validators";

type HelpCenterAccessPolicy = "public" | "restricted";

const ASSET_REFERENCE_PREFIX = "oc-asset://";
const ASSET_REFERENCE_REGEX = /oc-asset:\/\/([A-Za-z0-9_-]+)/g;
const MAX_ARTICLE_ASSET_BYTES = 5 * 1024 * 1024;
const SUPPORTED_ARTICLE_ASSET_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
]);

function normalizeAssetFileName(rawFileName: string | undefined): string {
  const candidate = (rawFileName ?? "").trim();
  if (!candidate) {
    return `article-image-${Date.now()}`;
  }

  const sanitized = candidate
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized || `article-image-${Date.now()}`;
}

function getAssetReferenceIds(markdown: string): string[] {
  const ids = new Set<string>();
  const matches = markdown.matchAll(ASSET_REFERENCE_REGEX);
  for (const match of matches) {
    const id = match[1];
    if (id) {
      ids.add(id);
    }
  }
  return Array.from(ids);
}

async function resolveAssetReferencesInContent(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  content: string
): Promise<string> {
  const ids = getAssetReferenceIds(content);
  if (ids.length === 0) {
    return content;
  }

  const resolvedUrls = new Map<string, string>();
  for (const id of ids) {
    const asset = await ctx.db.get(id as Id<"articleAssets">);
    if (!asset || asset.workspaceId !== workspaceId) {
      continue;
    }
    const url = await ctx.storage.getUrl(asset.storageId);
    if (url) {
      resolvedUrls.set(id, url);
    }
  }

  if (resolvedUrls.size === 0) {
    return content;
  }

  return content.replace(ASSET_REFERENCE_REGEX, (fullMatch, id) => {
    const replacement = resolvedUrls.get(id);
    return replacement ?? fullMatch;
  });
}

async function withRenderedContent(ctx: QueryCtx, article: Doc<"articles">) {
  return {
    ...article,
    renderedContent: await resolveAssetReferencesInContent(ctx, article.workspaceId, article.content),
  };
}

async function canReadHelpCenterArticles(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  userId?: Id<"users">
) {
  // TODO(help-center): Replace workspace-wide policy with per-article visibility controls.
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
      widgetLargeScreen: false,
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
    widgetLargeScreen: v.optional(v.boolean()),
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

    if (args.widgetLargeScreen !== undefined) {
      updates.widgetLargeScreen = args.widgetLargeScreen;
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
      const articleWithContent = await withRenderedContent(ctx, articleById);
      if (authUser) {
        return articleWithContent;
      }
      return articleById.status === "published" ? articleWithContent : null;
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
      const articleWithContent = await withRenderedContent(ctx, article);
      if (authUser) {
        return articleWithContent;
      }
      return article.status === "published" ? articleWithContent : null;
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

export const generateAssetUploadUrl = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  permission: "articles.create",
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw createError("NOT_FOUND", "Workspace not found");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveAsset = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    articleId: v.optional(v.id("articles")),
    importSourceId: v.optional(v.id("helpCenterImportSources")),
    importPath: v.optional(v.string()),
    storageId: v.id("_storage"),
    fileName: v.optional(v.string()),
  },
  permission: "articles.create",
  handler: async (ctx, args) => {
    if (args.articleId) {
      const article = await ctx.db.get(args.articleId);
      if (!article || article.workspaceId !== args.workspaceId) {
        throw createError("NOT_FOUND", "Article not found");
      }
    }

    if (args.importSourceId) {
      const source = await ctx.db.get(args.importSourceId);
      if (!source || source.workspaceId !== args.workspaceId) {
        throw createError("NOT_FOUND", "Import source not found");
      }
    }

    const metadata = await ctx.storage.getMetadata(args.storageId);
    if (!metadata) {
      throw createError("NOT_FOUND", "Uploaded file not found");
    }

    const mimeType = metadata.contentType ?? "";
    if (!SUPPORTED_ARTICLE_ASSET_MIME_TYPES.has(mimeType)) {
      throw createError(
        "INVALID_INPUT",
        "Unsupported image type. Allowed: PNG, JPEG, GIF, WEBP, AVIF."
      );
    }
    if (metadata.size > MAX_ARTICLE_ASSET_BYTES) {
      throw createError("INVALID_INPUT", "Image exceeds 5MB maximum size.");
    }

    const now = Date.now();
    const fileName = normalizeAssetFileName(args.fileName);

    let assetId: Id<"articleAssets">;
    if (args.importSourceId && args.importPath) {
      const existingAsset = await ctx.db
        .query("articleAssets")
        .withIndex("by_import_source_path", (q) =>
          q.eq("importSourceId", args.importSourceId!).eq("importPath", args.importPath!)
        )
        .first();

      if (existingAsset) {
        if (existingAsset.storageId !== args.storageId) {
          await ctx.storage.delete(existingAsset.storageId);
        }
        await ctx.db.patch(existingAsset._id, {
          articleId: args.articleId,
          storageId: args.storageId,
          fileName,
          mimeType,
          size: metadata.size,
          updatedAt: now,
        });
        assetId = existingAsset._id;
      } else {
        assetId = await ctx.db.insert("articleAssets", {
          workspaceId: args.workspaceId,
          articleId: args.articleId,
          importSourceId: args.importSourceId,
          importPath: args.importPath,
          storageId: args.storageId,
          fileName,
          mimeType,
          size: metadata.size,
          createdBy: ctx.user._id,
          createdAt: now,
          updatedAt: now,
        });
      }
    } else {
      assetId = await ctx.db.insert("articleAssets", {
        workspaceId: args.workspaceId,
        articleId: args.articleId,
        importSourceId: args.importSourceId,
        importPath: args.importPath,
        storageId: args.storageId,
        fileName,
        mimeType,
        size: metadata.size,
        createdBy: ctx.user._id,
        createdAt: now,
        updatedAt: now,
      });
    }

    const url = await ctx.storage.getUrl(args.storageId);
    return {
      assetId,
      reference: `${ASSET_REFERENCE_PREFIX}${assetId}`,
      url,
      fileName,
      mimeType,
      size: metadata.size,
    };
  },
});

export const listAssets = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    articleId: v.optional(v.id("articles")),
  },
  permission: "articles.read",
  handler: async (ctx, args) => {
    if (args.articleId) {
      const article = await ctx.db.get(args.articleId);
      if (!article || article.workspaceId !== args.workspaceId) {
        throw createError("NOT_FOUND", "Article not found");
      }
    }

    const assets = await ctx.db
      .query("articleAssets")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const filteredAssets = args.articleId
      ? assets.filter((asset) => asset.articleId === args.articleId)
      : assets;

    const mappedAssets = await Promise.all(
      filteredAssets.map(async (asset) => ({
        ...asset,
        reference: `${ASSET_REFERENCE_PREFIX}${asset._id}`,
        url: await ctx.storage.getUrl(asset.storageId),
      }))
    );

    return mappedAssets.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const deleteAsset = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    assetId: v.id("articleAssets"),
  },
  permission: "articles.delete",
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);
    if (!asset || asset.workspaceId !== args.workspaceId) {
      throw createError("NOT_FOUND", "Asset not found");
    }

    const reference = `${ASSET_REFERENCE_PREFIX}${args.assetId}`;
    const workspaceArticles = await ctx.db
      .query("articles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const referencingArticles = workspaceArticles.filter((article) =>
      article.content.includes(reference)
    );

    if (referencingArticles.length > 0) {
      const sampleTitles = referencingArticles
        .slice(0, 3)
        .map((article) => article.title)
        .join(", ");
      throw createError(
        "INVALID_INPUT",
        `Asset is still referenced by ${referencingArticles.length} article(s): ${sampleTitles}`
      );
    }

    await ctx.storage.delete(asset.storageId);
    await ctx.db.delete(args.assetId);
    return { success: true };
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
    const sortedArticles = filteredArticles.sort((a, b) => a.order - b.order);
    return await Promise.all(sortedArticles.map((article) => withRenderedContent(ctx, article)));
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
    const limitedArticles = filteredArticles.slice(0, 20);
    return await Promise.all(limitedArticles.map((article) => withRenderedContent(ctx, article)));
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
