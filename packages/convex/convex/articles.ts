import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  evaluateRule,
  countMatchingVisitors,
  AudienceRule,
  validateAudienceRule,
} from "./audienceRules";
import { Doc, Id } from "./_generated/dataModel";
import { getAuthenticatedUserFromSession } from "./auth";
import { authMutation, authQuery } from "./lib/authWrappers";
import {
  generateInternalEmbeddingRef,
  getShallowRunAfter,
  removeEmbeddingRef,
} from "./embeddings/functionRefs";
import { requirePermission } from "./permissions";
import { resolveVisitorFromSession } from "./widgetSessions";
import { generateSlug, ensureUniqueSlug } from "./utils/strings";
import { throwNotAuthenticated, createError } from "./utils/errors";
import {
  createArticleCore,
  deleteArticleCore,
  publishArticleCore,
  unpublishArticleCore,
  archiveArticleCore,
} from "./lib/articleWriteHelpers";
import {
  articleOrLegacyInternalArticleIdValidator,
  articleStatusValidator,
  articleVisibilityValidator,
  getArticleContentType,
  getArticleVisibility,
  getUnifiedArticleByIdOrLegacyInternalId,
  isPublicArticle,
  listUnifiedArticlesWithLegacyFallback,
  toCompatibilityArticle,
  type CompatibilityArticle,
  type UnifiedArticleVisibility,
} from "./lib/unifiedArticles";
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
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      if (
        char === "<" ||
        char === ">" ||
        char === ":" ||
        char === '"' ||
        char === "/" ||
        char === "\\" ||
        char === "|" ||
        char === "?" ||
        char === "*" ||
        code <= 31
      ) {
        return "-";
      }
      return char;
    })
    .join("")
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
      throw new Error("Not authorized to read articles for this visitor");
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

type ArticleIdentifier = Id<"articles"> | Id<"internalArticles">;
type ArticleRecord = CompatibilityArticle;
type ResolvedArticleRecord =
  | { kind: "article"; article: Doc<"articles"> }
  | { kind: "legacyInternal"; article: Doc<"internalArticles"> };

function articleMatchesVisibility(
  article: Pick<Doc<"articles">, "visibility">,
  visibility?: UnifiedArticleVisibility
) {
  return visibility ? getArticleVisibility(article) === visibility : true;
}

function articleIsReadableOnVisitorSurface(article: Pick<Doc<"articles">, "visibility" | "status">) {
  return isPublicArticle(article) && article.status === "published";
}

function articleMatchesSearch(article: Pick<ArticleRecord, "title" | "content">, searchTerm: string) {
  return (
    article.title.toLowerCase().includes(searchTerm) ||
    article.content.toLowerCase().includes(searchTerm)
  );
}

async function resolveArticleRecord(
  ctx: QueryCtx | MutationCtx,
  id: ArticleIdentifier
): Promise<ResolvedArticleRecord | null> {
  const article = await getUnifiedArticleByIdOrLegacyInternalId(ctx.db, id);
  if (article) {
    return { kind: "article", article };
  }

  const legacyArticle = (await ctx.db.get(id as Id<"internalArticles">)) as Doc<"internalArticles"> | null;
  if (legacyArticle) {
    return { kind: "legacyInternal", article: legacyArticle };
  }

  return null;
}

async function listArticleRecords(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">
): Promise<ArticleRecord[]> {
  return await listUnifiedArticlesWithLegacyFallback(ctx.db, workspaceId);
}

function sortArticleRecordsForAdmin(records: ArticleRecord[]) {
  return [...records].sort((left, right) => {
    if (right.updatedAt !== left.updatedAt) {
      return right.updatedAt - left.updatedAt;
    }
    return left.title.localeCompare(right.title);
  });
}

async function backfillLegacyInternalArticles(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">
) {
  const existingArticles = (await ctx.db
    .query("articles")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect()) as Doc<"articles">[];

  const migratedLegacyIds = new Set(
    existingArticles
      .map((article) => article.legacyInternalArticleId)
      .filter((value): value is Id<"internalArticles"> => Boolean(value))
  );

  const legacyArticles = (await ctx.db
    .query("internalArticles")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect()) as Doc<"internalArticles">[];

  const rootArticles = existingArticles.filter((article) => !article.collectionId);
  let nextRootOrder = rootArticles.reduce((max, article) => Math.max(max, article.order), 0);

  const migrated: Array<{ legacyId: Id<"internalArticles">; articleId: Id<"articles"> }> = [];

  for (const legacyArticle of legacyArticles) {
    if (migratedLegacyIds.has(legacyArticle._id)) {
      continue;
    }

    const baseSlug = generateSlug(legacyArticle.title);
    const slug = await ensureUniqueSlug(ctx.db, "articles", workspaceId, baseSlug);

    const articleId = await ctx.db.insert("articles", {
      workspaceId,
      collectionId: undefined,
      folderId: undefined,
      title: legacyArticle.title,
      slug,
      content: legacyArticle.content,
      widgetLargeScreen: false,
      visibility: "internal",
      status: legacyArticle.status,
      order: ++nextRootOrder,
      createdAt: legacyArticle.createdAt,
      updatedAt: legacyArticle.updatedAt,
      publishedAt: legacyArticle.publishedAt,
      authorId: legacyArticle.authorId,
      tags: legacyArticle.tags,
      legacyInternalArticleId: legacyArticle._id,
      legacyFolderId: legacyArticle.folderId,
    });

    migrated.push({ legacyId: legacyArticle._id, articleId });
  }

  const folderBackedArticles = existingArticles.filter((article) => article.folderId);
  for (const article of folderBackedArticles) {
    await ctx.db.patch(article._id, {
      folderId: undefined,
      legacyFolderId: article.legacyFolderId ?? article.folderId,
      updatedAt: article.updatedAt,
    });
  }

  return {
    migratedCount: migrated.length,
    migrated,
    normalizedFolderBackedArticleCount: folderBackedArticles.length,
  };
}

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    content: v.string(),
    collectionId: v.optional(v.id("collections")),
    visibility: v.optional(articleVisibilityValidator),
    tags: v.optional(v.array(v.string())),
    authorId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throwNotAuthenticated();
    }
    await requirePermission(ctx, user._id, args.workspaceId, "articles.create");

    return await createArticleCore(ctx, {
      workspaceId: args.workspaceId,
      title: args.title,
      content: args.content,
      collectionId: args.collectionId,
      visibility: args.visibility,
      tags: args.tags,
      authorId: args.authorId,
    });
  },
});

export const update = mutation({
  args: {
    id: articleOrLegacyInternalArticleIdValidator,
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    widgetLargeScreen: v.optional(v.boolean()),
    collectionId: v.optional(v.id("collections")),
    folderId: v.optional(v.id("contentFolders")),
    visibility: v.optional(articleVisibilityValidator),
    tags: v.optional(v.array(v.string())),
    audienceRules: v.optional(audienceRulesValidator),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throwNotAuthenticated();
    }

    const resolved = await resolveArticleRecord(ctx, args.id);
    if (!resolved) {
      throw createError("NOT_FOUND", "Article not found");
    }

    await requirePermission(ctx, user._id, resolved.article.workspaceId, "articles.create");

    if (resolved.kind === "legacyInternal") {
      const legacyUpdates: Partial<Doc<"internalArticles">> & { updatedAt: number } = {
        updatedAt: Date.now(),
      };

      if (args.title !== undefined) {
        legacyUpdates.title = args.title;
      }
      if (args.content !== undefined) {
        legacyUpdates.content = args.content;
      }
      if (args.tags !== undefined) {
        legacyUpdates.tags = args.tags;
      }

      await ctx.db.patch(resolved.article._id, legacyUpdates);

      if (
        resolved.article.status === "published" &&
        (args.title !== undefined || args.content !== undefined)
      ) {
        const runAfter = getShallowRunAfter(ctx);
        await runAfter(0, generateInternalEmbeddingRef, {
          workspaceId: resolved.article.workspaceId,
          contentType: "internalArticle",
          contentId: resolved.article._id,
          title: args.title ?? resolved.article.title,
          content: args.content ?? resolved.article.content,
        });
      }

      return resolved.article._id;
    }

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.title !== undefined && args.title !== resolved.article.title) {
      updates.title = args.title;
      const baseSlug = generateSlug(args.title);
      updates.slug = await ensureUniqueSlug(
        ctx.db,
        "articles",
        resolved.article.workspaceId,
        baseSlug,
        resolved.article._id
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

    if (args.visibility !== undefined) {
      updates.visibility = args.visibility;
    }

    if (args.tags !== undefined) {
      updates.tags = args.tags;
    }

    if (args.folderId !== undefined) {
      updates.legacyFolderId = args.folderId;
      updates.folderId = undefined;
    }

    if (args.audienceRules !== undefined) {
      if (!validateAudienceRule(args.audienceRules)) {
        throw createError("INVALID_INPUT", "Invalid audience rules");
      }
      updates.audienceRules = args.audienceRules;
    } else if (args.visibility === "internal") {
      updates.audienceRules = undefined;
    }

    await ctx.db.patch(resolved.article._id, updates);

    const previousContentType = getArticleContentType(resolved.article);
    const nextContentType =
      (args.visibility ?? getArticleVisibility(resolved.article)) === "internal"
        ? "internalArticle"
        : "article";

    if (resolved.article.status === "published" && previousContentType !== nextContentType) {
      const runAfter = getShallowRunAfter(ctx);
      await runAfter(0, removeEmbeddingRef, {
        contentType: previousContentType,
        contentId: resolved.article._id,
      });
    }

    if (
      resolved.article.status === "published" &&
      (args.title !== undefined || args.content !== undefined || args.visibility !== undefined)
    ) {
      const runAfter = getShallowRunAfter(ctx);
      await runAfter(0, generateInternalEmbeddingRef, {
        workspaceId: resolved.article.workspaceId,
        contentType: nextContentType,
        contentId: resolved.article._id,
        title: args.title ?? resolved.article.title,
        content: args.content ?? resolved.article.content,
      });
    }

    return resolved.article._id;
  },
});

export const remove = mutation({
  args: {
    id: articleOrLegacyInternalArticleIdValidator,
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throwNotAuthenticated();
    }

    const resolved = await resolveArticleRecord(ctx, args.id);
    if (!resolved) {
      throw createError("NOT_FOUND", "Article not found");
    }

    await requirePermission(ctx, user._id, resolved.article.workspaceId, "articles.delete");

    if (resolved.kind === "legacyInternal") {
      await ctx.db.delete(resolved.article._id);
      const runAfter = getShallowRunAfter(ctx);
      await runAfter(0, removeEmbeddingRef, {
        contentType: "internalArticle",
        contentId: resolved.article._id,
      });
      return { success: true };
    }

    await deleteArticleCore(ctx, resolved.article);
    return { success: true };
  },
});

export const get = query({
  args: {
    id: v.optional(articleOrLegacyInternalArticleIdValidator),
    slug: v.optional(v.string()),
    workspaceId: v.optional(v.id("workspaces")),
    visibility: v.optional(articleVisibilityValidator),
  },
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUserFromSession(ctx);
    const resolvedRecord = args.id ? await resolveArticleRecord(ctx, args.id) : null;
    const resolvedWorkspaceId = resolvedRecord?.article.workspaceId ?? args.workspaceId;

    if (!resolvedWorkspaceId) {
      return null;
    }

    const canRead = await canReadHelpCenterArticles(ctx, resolvedWorkspaceId, authUser?._id);
    if (!canRead) {
      return null;
    }

    if (resolvedRecord) {
      const articleRecord =
        resolvedRecord.kind === "article"
          ? resolvedRecord.article
          : toCompatibilityArticle(resolvedRecord.article);

      if (!articleMatchesVisibility(articleRecord, args.visibility)) {
        return null;
      }

      if (!authUser && !articleIsReadableOnVisitorSurface(articleRecord)) {
        return null;
      }

      const articleWithContent: CompatibilityArticle & { renderedContent: string } =
        resolvedRecord.kind === "article"
          ? await withRenderedContent(ctx, resolvedRecord.article)
          : {
              ...articleRecord,
              renderedContent: articleRecord.content,
            };

      return articleWithContent;
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
      if (!articleMatchesVisibility(article, args.visibility)) {
        return null;
      }
      const articleWithContent = await withRenderedContent(ctx, article);
      if (authUser) {
        return articleWithContent;
      }
      return articleIsReadableOnVisitorSurface(article) ? articleWithContent : null;
    }

    return null;
  },
});

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(articleStatusValidator),
    collectionId: v.optional(v.id("collections")),
    visibility: v.optional(articleVisibilityValidator),
  },
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUserFromSession(ctx);
    const canRead = await canReadHelpCenterArticles(ctx, args.workspaceId, authUser?._id);
    if (!canRead) {
      return [];
    }

    let articles = await listArticleRecords(ctx, args.workspaceId);

    if (args.collectionId) {
      articles = articles.filter((article) => article.collectionId === args.collectionId);
    }

    if (args.status) {
      articles = articles.filter((article) => article.status === args.status);
    }

    if (args.visibility) {
      articles = articles.filter((article) => articleMatchesVisibility(article, args.visibility));
    }

    if (!authUser) {
      articles = articles.filter((article) => articleIsReadableOnVisitorSurface(article));
    }

    return authUser
      ? sortArticleRecordsForAdmin(articles)
      : [...articles].sort((left, right) => left.order - right.order);
  },
});

export const search = query({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    publishedOnly: v.optional(v.boolean()),
    visibility: v.optional(articleVisibilityValidator),
  },
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUserFromSession(ctx);
    const canRead = await canReadHelpCenterArticles(ctx, args.workspaceId, authUser?._id);
    if (!canRead) {
      return [];
    }

    const searchTerm = args.query.toLowerCase();

    let articles = await listArticleRecords(ctx, args.workspaceId);

    if (args.visibility) {
      articles = articles.filter((article) => articleMatchesVisibility(article, args.visibility));
    }

    if (args.publishedOnly || !authUser) {
      articles = articles.filter((article) => article.status === "published");
    }

    if (!authUser) {
      articles = articles.filter((article) => articleIsReadableOnVisitorSurface(article));
    }

    return articles
      .filter((article) => articleMatchesSearch(article, searchTerm))
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, 20);
  },
});

export const publish = authMutation({
  args: {
    id: articleOrLegacyInternalArticleIdValidator,
  },
  permission: "articles.publish",
  resolveWorkspaceId: async (ctx, args) => {
    const resolved = await resolveArticleRecord(ctx, args.id);
    return resolved?.article.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const resolved = await resolveArticleRecord(ctx, args.id);
    if (!resolved) {
      throw createError("NOT_FOUND", "Article not found");
    }

    if (resolved.kind === "legacyInternal") {
      await ctx.db.patch(resolved.article._id, {
        status: "published",
        publishedAt: Date.now(),
        updatedAt: Date.now(),
      });
      const runAfter = getShallowRunAfter(ctx);
      await runAfter(0, generateInternalEmbeddingRef, {
        workspaceId: resolved.article.workspaceId,
        contentType: "internalArticle",
        contentId: resolved.article._id,
        title: resolved.article.title,
        content: resolved.article.content,
      });
    } else {
      await publishArticleCore(ctx, resolved.article);
    }

    return resolved.article._id;
  },
});

export const unpublish = authMutation({
  args: {
    id: articleOrLegacyInternalArticleIdValidator,
  },
  permission: "articles.publish",
  resolveWorkspaceId: async (ctx, args) => {
    const resolved = await resolveArticleRecord(ctx, args.id);
    return resolved?.article.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const resolved = await resolveArticleRecord(ctx, args.id);
    if (!resolved) {
      throw createError("NOT_FOUND", "Article not found");
    }

    if (resolved.kind === "legacyInternal") {
      await ctx.db.patch(resolved.article._id, {
        status: "draft",
        publishedAt: undefined,
        updatedAt: Date.now(),
      });
      const runAfter = getShallowRunAfter(ctx);
      await runAfter(0, removeEmbeddingRef, {
        contentType: "internalArticle",
        contentId: resolved.article._id,
      });
    } else {
      await unpublishArticleCore(ctx, resolved.article);
    }

    return resolved.article._id;
  },
});

export const archive = authMutation({
  args: {
    id: articleOrLegacyInternalArticleIdValidator,
  },
  permission: "articles.publish",
  resolveWorkspaceId: async (ctx, args) => {
    const resolved = await resolveArticleRecord(ctx, args.id);
    return resolved?.article.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const resolved = await resolveArticleRecord(ctx, args.id);
    if (!resolved) {
      throw createError("NOT_FOUND", "Article not found");
    }

    if (resolved.kind === "legacyInternal") {
      await ctx.db.patch(resolved.article._id, {
        status: "archived",
        updatedAt: Date.now(),
      });
      const runAfter = getShallowRunAfter(ctx);
      await runAfter(0, removeEmbeddingRef, {
        contentType: "internalArticle",
        contentId: resolved.article._id,
      });
    } else {
      await archiveArticleCore(ctx, resolved.article);
    }

    return resolved.article._id;
  },
});

export const migrateLegacyInternalArticles = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  permission: "articles.create",
  handler: async (ctx, args) => {
    return await backfillLegacyInternalArticles(ctx, args.workspaceId);
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
    articleId: v.optional(articleOrLegacyInternalArticleIdValidator),
    importSourceId: v.optional(v.id("helpCenterImportSources")),
    importPath: v.optional(v.string()),
    storageId: v.id("_storage"),
    fileName: v.optional(v.string()),
  },
  permission: "articles.create",
  handler: async (ctx, args) => {
    let resolvedArticleId: Id<"articles"> | undefined;
    if (args.articleId) {
      const resolved = await resolveArticleRecord(ctx, args.articleId);
      if (!resolved || resolved.article.workspaceId !== args.workspaceId) {
        throw createError("NOT_FOUND", "Article not found");
      }
      if (resolved.kind === "legacyInternal") {
        throw createError(
          "INVALID_INPUT",
          "Migrate this legacy internal article before uploading images."
        );
      }
      resolvedArticleId = resolved.article._id;
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
          articleId: resolvedArticleId,
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
          articleId: resolvedArticleId,
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
        articleId: resolvedArticleId,
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
    articleId: v.optional(articleOrLegacyInternalArticleIdValidator),
  },
  permission: "articles.read",
  handler: async (ctx, args) => {
    let resolvedArticleId: Id<"articles"> | undefined;
    if (args.articleId) {
      const resolved = await resolveArticleRecord(ctx, args.articleId);
      if (!resolved || resolved.article.workspaceId !== args.workspaceId) {
        throw createError("NOT_FOUND", "Article not found");
      }
      if (resolved.kind === "legacyInternal") {
        return [];
      }
      resolvedArticleId = resolved.article._id;
    }

    const assets = await ctx.db
      .query("articleAssets")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const filteredAssets = resolvedArticleId
      ? assets.filter((asset) => asset.articleId === resolvedArticleId)
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
    const visitor = await resolveWidgetHelpCenterVisitor(ctx, args);
    if (!visitor) {
      return [];
    }

    let articles;
    if (args.collectionId) {
      articles = await ctx.db
        .query("articles")
        .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
        .collect();
      articles = articles.filter((article) => articleIsReadableOnVisitorSurface(article));
    } else {
      articles = await ctx.db
        .query("articles")
        .withIndex("by_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", "published")
        )
        .collect();
      articles = articles.filter((article) => articleIsReadableOnVisitorSurface(article));
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
    const visitor = await resolveWidgetHelpCenterVisitor(ctx, args);
    if (!visitor) {
      return [];
    }

    const searchTerm = args.query.toLowerCase();

    const articles = await ctx.db
      .query("articles")
      .withIndex("by_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "published")
      )
      .collect();

    const matchingArticles = articles
      .filter((article) => articleIsReadableOnVisitorSurface(article))
      .filter((article) => articleMatchesSearch(article, searchTerm));

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

export const getForVisitor = query({
  args: {
    id: v.id("articles"),
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const visitor = await resolveWidgetHelpCenterVisitor(ctx, args);
    if (!visitor) {
      return null;
    }

    const article = await ctx.db.get(args.id);
    if (!article || article.workspaceId !== args.workspaceId) {
      return null;
    }
    if (!articleIsReadableOnVisitorSurface(article)) {
      return null;
    }

    const matches = await evaluateRule(
      ctx,
      article.audienceRules as AudienceRule | undefined,
      visitor
    );
    if (!matches) {
      return null;
    }

    return await withRenderedContent(ctx, article);
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
