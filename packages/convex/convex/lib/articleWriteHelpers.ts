import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { generateSlug, ensureUniqueSlug } from "../utils/strings";
import {
  generateInternalEmbeddingRef,
  getShallowRunAfter,
  removeEmbeddingRef,
} from "../embeddings/functionRefs";
import {
  getArticleContentType,
  getArticleVisibility,
  type UnifiedArticleVisibility,
} from "./unifiedArticles";

// ── createArticleCore ───────────────────────────────────────────────

export async function createArticleCore(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    title: string;
    content: string;
    collectionId?: Id<"collections">;
    visibility?: UnifiedArticleVisibility;
    tags?: string[];
    authorId?: Id<"users">;
  }
): Promise<Id<"articles">> {
  // Validate collection ownership
  if (args.collectionId) {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection || collection.workspaceId !== args.workspaceId) {
      throw new Error("Collection not found");
    }
  }

  const now = Date.now();
  const baseSlug = generateSlug(args.title);
  const slug = await ensureUniqueSlug(ctx.db, "articles", args.workspaceId, baseSlug);

  const articles = await ctx.db
    .query("articles")
    .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
    .collect();
  const maxOrder = articles.reduce((max, a) => Math.max(max, a.order), 0);

  const articleId = await ctx.db.insert("articles", {
    workspaceId: args.workspaceId,
    collectionId: args.collectionId,
    folderId: undefined,
    title: args.title,
    slug,
    content: args.content,
    widgetLargeScreen: false,
    visibility: args.visibility ?? "public",
    status: "draft",
    order: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
    tags: args.tags,
    authorId: args.authorId,
  });

  return articleId;
}

// ── updateArticleCore ───────────────────────────────────────────────

export async function updateArticleCore(
  ctx: MutationCtx,
  article: Doc<"articles">,
  args: {
    title?: string;
    content?: string;
    collectionId?: Id<"collections">;
    visibility?: UnifiedArticleVisibility;
    tags?: string[];
    status?: "draft" | "published" | "archived";
  }
): Promise<void> {
  // Validate collection ownership
  if (args.collectionId !== undefined) {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection || collection.workspaceId !== article.workspaceId) {
      throw new Error("Collection not found");
    }
  }

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
      article._id
    );
  }

  if (args.content !== undefined) {
    updates.content = args.content;
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

  // Handle status transitions
  const statusChanged = args.status !== undefined && args.status !== article.status;
  if (statusChanged) {
    updates.status = args.status;
    if (args.status === "published") {
      updates.publishedAt = Date.now();
    } else if (args.status === "draft" && article.status === "published") {
      // Only clear publishedAt when unpublishing to draft (matches unpublishArticleCore).
      // Archiving preserves publishedAt (matches archiveArticleCore).
      updates.publishedAt = undefined;
    }
  }

  await ctx.db.patch(article._id, updates);

  // Determine the effective status after the update
  const effectiveStatus = args.status ?? article.status;
  const becamePublished = statusChanged && args.status === "published";
  const wasPublished = article.status === "published";
  const contentChanged =
    args.title !== undefined || args.content !== undefined || args.visibility !== undefined;

  // Handle embedding side effects
  const previousContentType = getArticleContentType(article);
  const nextContentType =
    (args.visibility ?? getArticleVisibility(article)) === "internal"
      ? "internalArticle"
      : "article";

  // Remove old embedding when visibility type changes on a published article
  if (effectiveStatus === "published" && previousContentType !== nextContentType) {
    const runAfter = getShallowRunAfter(ctx);
    await runAfter(0, removeEmbeddingRef, {
      contentType: previousContentType,
      contentId: article._id,
    });
  }

  // Generate embedding when newly published OR when content/visibility changes on an already-published article
  if (effectiveStatus === "published" && (becamePublished || contentChanged)) {
    const runAfter = getShallowRunAfter(ctx);
    await runAfter(0, generateInternalEmbeddingRef, {
      workspaceId: article.workspaceId,
      contentType: nextContentType,
      contentId: article._id,
      title: args.title ?? article.title,
      content: args.content ?? article.content,
    });
  }

  // Remove embedding when status changes away from published
  if (statusChanged && args.status !== "published" && wasPublished) {
    const runAfter = getShallowRunAfter(ctx);
    await runAfter(0, removeEmbeddingRef, {
      contentType: previousContentType,
      contentId: article._id,
    });
  }
}

// ── deleteArticleCore ───────────────────────────────────────────────

export async function deleteArticleCore(
  ctx: MutationCtx,
  article: Doc<"articles">
): Promise<void> {
  await ctx.db.delete(article._id);
  const runAfter = getShallowRunAfter(ctx);
  await runAfter(0, removeEmbeddingRef, {
    contentType: getArticleContentType(article),
    contentId: article._id,
  });
}

// ── publishArticleCore ──────────────────────────────────────────────

export async function publishArticleCore(
  ctx: MutationCtx,
  article: Doc<"articles">
): Promise<void> {
  await ctx.db.patch(article._id, {
    status: "published",
    publishedAt: Date.now(),
    updatedAt: Date.now(),
  });

  const runAfter = getShallowRunAfter(ctx);
  await runAfter(0, generateInternalEmbeddingRef, {
    workspaceId: article.workspaceId,
    contentType: getArticleContentType(article),
    contentId: article._id,
    title: article.title,
    content: article.content,
  });
}

// ── unpublishArticleCore ────────────────────────────────────────────

export async function unpublishArticleCore(
  ctx: MutationCtx,
  article: Doc<"articles">
): Promise<void> {
  await ctx.db.patch(article._id, {
    status: "draft",
    publishedAt: undefined,
    updatedAt: Date.now(),
  });

  const runAfter = getShallowRunAfter(ctx);
  await runAfter(0, removeEmbeddingRef, {
    contentType: getArticleContentType(article),
    contentId: article._id,
  });
}

// ── archiveArticleCore ──────────────────────────────────────────────

export async function archiveArticleCore(
  ctx: MutationCtx,
  article: Doc<"articles">
): Promise<void> {
  await ctx.db.patch(article._id, {
    status: "archived",
    updatedAt: Date.now(),
  });

  const runAfter = getShallowRunAfter(ctx);
  await runAfter(0, removeEmbeddingRef, {
    contentType: getArticleContentType(article),
    contentId: article._id,
  });
}
