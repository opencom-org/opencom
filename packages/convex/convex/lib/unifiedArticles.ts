import type { GenericDatabaseReader } from "convex/server";
import { v } from "convex/values";
import type { DataModel, Doc, Id } from "../_generated/dataModel";

export const articleVisibilityValidator = v.union(v.literal("public"), v.literal("internal"));
export const articleStatusValidator = v.union(
  v.literal("draft"),
  v.literal("published"),
  v.literal("archived")
);
export const articleOrLegacyInternalArticleIdValidator = v.union(
  v.id("articles"),
  v.id("internalArticles")
);

export type UnifiedArticleVisibility = "public" | "internal";
export type UnifiedArticleStatus = "draft" | "published" | "archived";
export type UnifiedArticleContentType = "article" | "internalArticle";

type Reader = GenericDatabaseReader<DataModel>;

export type CompatibilityArticle = Omit<Doc<"articles">, "_id" | "_creationTime"> & {
  _id: Id<"articles"> | Id<"internalArticles">;
  _creationTime: number;
};

const LEGACY_INTERNAL_SLUG_PREFIX = "legacy-internal";

export function getArticleVisibility(
  article: Pick<Doc<"articles">, "visibility">
): UnifiedArticleVisibility {
  return article.visibility ?? "public";
}

export function getArticleContentType(
  article: Pick<Doc<"articles">, "visibility">
): UnifiedArticleContentType {
  return getArticleVisibility(article) === "internal" ? "internalArticle" : "article";
}

export function isPublishedArticle(article: Pick<Doc<"articles">, "status">): boolean {
  return article.status === "published";
}

export function isPublicArticle(article: Pick<Doc<"articles">, "visibility">): boolean {
  return getArticleVisibility(article) === "public";
}

export function isInternalArticle(article: Pick<Doc<"articles">, "visibility">): boolean {
  return getArticleVisibility(article) === "internal";
}

export function toCompatibilityArticle(
  article: Doc<"internalArticles">
): CompatibilityArticle {
  return {
    _id: article._id,
    _creationTime: article._creationTime,
    workspaceId: article.workspaceId,
    collectionId: undefined,
    folderId: undefined,
    title: article.title,
    slug: `${LEGACY_INTERNAL_SLUG_PREFIX}-${article._id}`,
    content: article.content,
    widgetLargeScreen: false,
    visibility: "internal",
    status: article.status,
    order: article.updatedAt,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    publishedAt: article.publishedAt,
    authorId: article.authorId,
    audienceRules: undefined,
    importSourceId: undefined,
    importPath: undefined,
    tags: article.tags,
    legacyInternalArticleId: article._id,
    legacyFolderId: article.folderId,
  };
}

export async function getUnifiedArticleByIdOrLegacyInternalId(
  db: Reader,
  id: Id<"articles"> | Id<"internalArticles">
): Promise<Doc<"articles"> | null> {
  const directArticle = (await db.get(id as Id<"articles">)) as Doc<"articles"> | null;
  if (directArticle) {
    return directArticle;
  }

  const migratedByIndex = await db
    .query("articles")
    .withIndex("by_legacy_internal_article", (q) =>
      q.eq("legacyInternalArticleId", id as Id<"internalArticles">)
    )
    .first();
  if (migratedByIndex) {
    return migratedByIndex;
  }

  const legacyArticle = (await db.get(id as Id<"internalArticles">)) as Doc<"internalArticles"> | null;
  if (!legacyArticle) {
    return null;
  }

  // Fallback for compatibility reads keyed by legacy ids, such as recent-content records.
  const workspaceArticles = (await db
    .query("articles")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", legacyArticle.workspaceId))
    .collect()) as Doc<"articles">[];

  return (
    workspaceArticles.find((article) => article.legacyInternalArticleId === legacyArticle._id) ?? null
  );
}

export async function listUnmigratedLegacyInternalArticles(
  db: Reader,
  workspaceId: Id<"workspaces">,
  unifiedArticles?: Doc<"articles">[]
): Promise<Doc<"internalArticles">[]> {
  const articles =
    unifiedArticles ??
    ((await db
      .query("articles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect()) as Doc<"articles">[]);

  const migratedLegacyIds = new Set(
    articles
      .map((article) => article.legacyInternalArticleId)
      .filter((value): value is Id<"internalArticles"> => Boolean(value))
  );

  const legacyArticles = (await db
    .query("internalArticles")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect()) as Doc<"internalArticles">[];

  return legacyArticles.filter((article) => !migratedLegacyIds.has(article._id));
}

export async function listUnifiedArticlesWithLegacyFallback(
  db: Reader,
  workspaceId: Id<"workspaces">
): Promise<CompatibilityArticle[]> {
  const unifiedArticles = (await db
    .query("articles")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect()) as Doc<"articles">[];

  const legacyArticles = await listUnmigratedLegacyInternalArticles(db, workspaceId, unifiedArticles);

  return [
    ...unifiedArticles,
    ...legacyArticles.map((legacyArticle) => toCompatibilityArticle(legacyArticle)),
  ];
}
