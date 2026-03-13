import { v } from "convex/values";
import { makeFunctionReference, type FunctionReference } from "convex/server";
import { embed } from "ai";
import { authAction, authMutation, authQuery } from "./lib/authWrappers";
import { Id } from "./_generated/dataModel";
import { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { createAIClient } from "./lib/aiGateway";
import {
  getArticleVisibility,
  getUnifiedArticleByIdOrLegacyInternalId,
  isInternalArticle,
  isPublicArticle,
  listUnifiedArticlesWithLegacyFallback,
  type CompatibilityArticle,
} from "./lib/unifiedArticles";

const contentTypeValidator = v.union(
  v.literal("article"),
  v.literal("internalArticle"),
  v.literal("snippet")
);

type KnowledgeContentType = "article" | "internalArticle" | "snippet";
type KnowledgeContext = QueryCtx | MutationCtx;
type KnowledgeSearchResult = {
  id: string;
  type: KnowledgeContentType;
  title: string;
  content: string;
  snippet: string;
  slug?: string;
  tags?: string[];
  relevanceScore: number;
  updatedAt: number;
};

const createSnippet = (content: string, term: string): string => {
  const lowerContent = content.toLowerCase();
  const index = lowerContent.indexOf(term);
  if (index === -1) {
    return content.slice(0, 150) + (content.length > 150 ? "..." : "");
  }
  const start = Math.max(0, index - 50);
  const end = Math.min(content.length, index + term.length + 100);
  let snippet = content.slice(start, end);
  if (start > 0) snippet = "..." + snippet;
  if (end < content.length) snippet = snippet + "...";
  return snippet;
};

const calculateScore = (title: string, content: string, term: string): number => {
  let score = 0;
  const lowerTitle = title.toLowerCase();
  const lowerContent = content.toLowerCase();

  if (lowerTitle.includes(term)) {
    score += 10;
    if (lowerTitle.startsWith(term)) score += 5;
    if (lowerTitle === term) score += 10;
  }

  const contentMatches = (lowerContent.match(new RegExp(term, "g")) || []).length;
  score += Math.min(contentMatches, 5);

  return score;
};

function matchesKnowledgeSearch(
  article: Pick<CompatibilityArticle, "title" | "content" | "tags">,
  searchTerm: string
) {
  return (
    article.title.toLowerCase().includes(searchTerm) ||
    article.content.toLowerCase().includes(searchTerm) ||
    (article.tags && article.tags.some((tag) => tag.toLowerCase().includes(searchTerm)))
  );
}

async function resolveArticleKnowledgeItem(
  ctx: Pick<KnowledgeContext, "db">,
  workspaceId: Id<"workspaces">,
  contentType: "article" | "internalArticle",
  contentId: string
) {
  if (contentType === "internalArticle") {
    const internalArticle = (await listUnifiedArticlesWithLegacyFallback(ctx.db, workspaceId)).find(
      (entry) =>
        isInternalArticle(entry) &&
        (entry._id === (contentId as Id<"articles"> | Id<"internalArticles">) ||
          entry.legacyInternalArticleId === (contentId as Id<"internalArticles">))
    );

    if (internalArticle) {
      return {
        id: internalArticle._id,
        type: "internalArticle" as const,
        title: internalArticle.title,
        content: internalArticle.content,
        slug: internalArticle.slug,
        tags: internalArticle.tags,
      };
    }
  }

  const article = await getUnifiedArticleByIdOrLegacyInternalId(
    ctx.db,
    contentId as Id<"articles"> | Id<"internalArticles">
  );
  if (article) {
    const visibility = getArticleVisibility(article);
    if (
      (contentType === "article" && visibility !== "public") ||
      (contentType === "internalArticle" && visibility !== "internal")
    ) {
      return null;
    }

    return {
      id: article._id,
      type: contentType,
      title: article.title,
      content: article.content,
      slug: article.slug,
      tags: article.tags,
    };
  }

  return null;
}

export const search = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    contentTypes: v.optional(v.array(contentTypeValidator)),
    folderId: v.optional(v.id("contentFolders")),
    tags: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
  },
  permission: "articles.read",
  handler: async (ctx, args) => {
    const searchTerm = args.query.toLowerCase();
    const limit = args.limit ?? 50;
    const contentTypes = args.contentTypes ?? ["article", "internalArticle", "snippet"];

    const unifiedArticles = await listUnifiedArticlesWithLegacyFallback(ctx.db, args.workspaceId);
    const results: KnowledgeSearchResult[] = [];

    if (contentTypes.includes("article")) {
      for (const article of unifiedArticles) {
        if (!isPublicArticle(article) || article.status !== "published") {
          continue;
        }
        if (!matchesKnowledgeSearch(article, searchTerm)) {
          continue;
        }

        results.push({
          id: article._id,
          type: "article",
          title: article.title,
          content: article.content,
          snippet: createSnippet(article.content, searchTerm),
          slug: article.slug,
          relevanceScore: calculateScore(article.title, article.content, searchTerm),
          updatedAt: article.updatedAt,
        });
      }
    }

    if (contentTypes.includes("internalArticle")) {
      for (const article of unifiedArticles) {
        if (!isInternalArticle(article) || article.status !== "published") {
          continue;
        }
        if (args.tags && args.tags.length > 0) {
          const articleTags = article.tags ?? [];
          if (!args.tags.some((tag) => articleTags.includes(tag))) {
            continue;
          }
        }
        if (!matchesKnowledgeSearch(article, searchTerm)) {
          continue;
        }

        results.push({
          id: article._id,
          type: "internalArticle",
          title: article.title,
          content: article.content,
          snippet: createSnippet(article.content, searchTerm),
          slug: article.slug,
          tags: article.tags,
          relevanceScore: calculateScore(article.title, article.content, searchTerm),
          updatedAt: article.updatedAt,
        });
      }
    }

    if (contentTypes.includes("snippet")) {
      const snippets = await ctx.db
        .query("snippets")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect();

      for (const snippet of snippets) {
        if (
          !snippet.name.toLowerCase().includes(searchTerm) &&
          !snippet.content.toLowerCase().includes(searchTerm) &&
          !(snippet.shortcut && snippet.shortcut.toLowerCase().includes(searchTerm))
        ) {
          continue;
        }

        results.push({
          id: snippet._id,
          type: "snippet",
          title: snippet.name,
          content: snippet.content,
          snippet: createSnippet(snippet.content, searchTerm),
          relevanceScore: calculateScore(snippet.name, snippet.content, searchTerm),
          updatedAt: snippet.updatedAt,
        });
      }
    }

    results.sort((left, right) => {
      if (right.relevanceScore !== left.relevanceScore) {
        return right.relevanceScore - left.relevanceScore;
      }
      return right.updatedAt - left.updatedAt;
    });

    return results.slice(0, limit);
  },
});

type EmbeddingQueryRef<Args extends Record<string, unknown>, Return> = FunctionReference<
  "query",
  "public",
  Args,
  Return
>;

const GET_EMBEDDING_BY_ID_REF: EmbeddingQueryRef<
  { id: Id<"contentEmbeddings"> },
  Doc<"contentEmbeddings"> | null
> = makeFunctionReference<
  "query",
  { id: Id<"contentEmbeddings"> },
  Doc<"contentEmbeddings"> | null
>("suggestions:getEmbeddingById");

type ContentRecord = {
  content: string;
  title: string;
} | null;

const GET_CONTENT_BY_ID_REF: EmbeddingQueryRef<
  { contentType: KnowledgeContentType; contentId: string },
  ContentRecord
> = makeFunctionReference<
  "query",
  { contentType: KnowledgeContentType; contentId: string },
  ContentRecord
>("suggestions:getContentById");

function getShallowRunQuery(ctx: { runQuery: unknown }) {
  return ctx.runQuery as unknown as <Args extends Record<string, unknown>, Return>(
    queryRef: EmbeddingQueryRef<Args, Return>,
    queryArgs: Args
  ) => Promise<Return>;
}

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const KNOWLEDGE_SEARCH_DEFAULT_LIMIT = 20;
const KNOWLEDGE_SEARCH_MAX_LIMIT = 50;

export const searchWithEmbeddings = authAction({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    contentTypes: v.optional(v.array(contentTypeValidator)),
    limit: v.optional(v.number()),
  },
  permission: "articles.read",
  handler: async (ctx, args): Promise<KnowledgeSearchResult[]> => {
    const limit = Math.max(
      1,
      Math.min(args.limit ?? KNOWLEDGE_SEARCH_DEFAULT_LIMIT, KNOWLEDGE_SEARCH_MAX_LIMIT)
    );

    const aiClient = createAIClient();
    const runQuery = getShallowRunQuery(ctx);

    const { embedding } = await embed({
      model: aiClient.embedding(DEFAULT_EMBEDDING_MODEL),
      value: args.query,
    });

    const vectorResults = await ctx.vectorSearch("contentEmbeddings", "by_embedding", {
      vector: embedding,
      limit: limit * 8,
      filter: (q) => q.eq("workspaceId", args.workspaceId),
    });

    const contentTypeSet =
      args.contentTypes && args.contentTypes.length > 0 ? new Set(args.contentTypes) : null;

    const embeddingDocs = await Promise.all(
      vectorResults.map((result) =>
        runQuery(GET_EMBEDDING_BY_ID_REF, { id: result._id }).then((doc) =>
          doc ? { ...doc, _score: result._score } : null
        )
      )
    );

    const seen = new Set<string>();
    const dedupedEmbeddingDocs: {
      contentId: string;
      contentType: KnowledgeContentType;
      title: string;
      snippet: string;
      updatedAt: number;
      _score: number;
    }[] = [];

    for (const doc of embeddingDocs) {
      if (!doc) continue;
      if (contentTypeSet && !contentTypeSet.has(doc.contentType)) continue;

      const key = `${doc.contentType}:${doc.contentId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      dedupedEmbeddingDocs.push({
        contentId: doc.contentId,
        contentType: doc.contentType,
        title: doc.title,
        snippet: doc.snippet,
        updatedAt: doc.updatedAt,
        _score: doc._score,
      });

      if (dedupedEmbeddingDocs.length >= limit) break;
    }

    const contentRecords = await Promise.all(
      dedupedEmbeddingDocs.map((doc) =>
        runQuery(GET_CONTENT_BY_ID_REF, {
          contentType: doc.contentType,
          contentId: doc.contentId,
        })
      )
    );

    const results: KnowledgeSearchResult[] = [];
    for (let i = 0; i < dedupedEmbeddingDocs.length; i++) {
      const doc = dedupedEmbeddingDocs[i];
      const content = contentRecords[i];
      if (!doc || !content) continue;

      results.push({
        id: doc.contentId,
        type: doc.contentType,
        title: doc.title,
        content: content.content,
        snippet: doc.snippet,
        relevanceScore: doc._score,
        updatedAt: doc.updatedAt,
      });
    }

    return results;
  },
});

export const trackAccess = authMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    contentType: contentTypeValidator,
    contentId: v.string(),
  },
  permission: "articles.read",
  handler: async (ctx, args) => {
    if (args.userId !== ctx.user._id) {
      throw new Error("Cannot track access for another user");
    }
    const now = Date.now();

    const existing = await ctx.db
      .query("recentContentAccess")
      .withIndex("by_user_content", (q) =>
        q
          .eq("userId", args.userId)
          .eq("contentType", args.contentType)
          .eq("contentId", args.contentId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { accessedAt: now });
      return existing._id;
    }

    const accessId = await ctx.db.insert("recentContentAccess", {
      userId: args.userId,
      workspaceId: args.workspaceId,
      contentType: args.contentType,
      contentId: args.contentId,
      accessedAt: now,
    });

    const allAccess = await ctx.db
      .query("recentContentAccess")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", args.userId).eq("workspaceId", args.workspaceId)
      )
      .collect();

    if (allAccess.length > 50) {
      const sorted = allAccess.sort((a, b) => b.accessedAt - a.accessedAt);
      for (const record of sorted.slice(50)) {
        await ctx.db.delete(record._id);
      }
    }

    return accessId;
  },
});

export const getRecentlyUsed = authQuery({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  permission: "articles.read",
  handler: async (ctx, args) => {
    if (args.userId !== ctx.user._id) {
      throw new Error("Cannot read recent content for another user");
    }
    const limit = args.limit ?? 10;

    const accessRecords = await ctx.db
      .query("recentContentAccess")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", args.userId).eq("workspaceId", args.workspaceId)
      )
      .collect();

    const results: Array<{
      id: string;
      type: KnowledgeContentType;
      title: string;
      content: string;
      slug?: string;
      accessedAt: number;
    }> = [];

    for (const record of accessRecords
      .sort((a, b) => b.accessedAt - a.accessedAt)
      .slice(0, limit)) {
      if (record.contentType === "snippet") {
        const snippet = await ctx.db.get(record.contentId as Id<"snippets">);
        if (!snippet) {
          continue;
        }
        results.push({
          id: snippet._id,
          type: "snippet",
          title: snippet.name,
          content: snippet.content,
          accessedAt: record.accessedAt,
        });
        continue;
      }

      const article = await resolveArticleKnowledgeItem(
        ctx,
        record.workspaceId,
        record.contentType,
        record.contentId
      );
      if (!article) {
        continue;
      }
      results.push({
        ...article,
        accessedAt: record.accessedAt,
      });
    }

    return results;
  },
});

export const getFrequentlyUsed = authQuery({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  permission: "articles.read",
  handler: async (ctx, args) => {
    if (args.userId !== ctx.user._id) {
      throw new Error("Cannot read frequent content for another user");
    }
    const limit = args.limit ?? 10;

    const accessRecords = await ctx.db
      .query("recentContentAccess")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", args.userId).eq("workspaceId", args.workspaceId)
      )
      .collect();

    const accessCounts = new Map<
      string,
      { count: number; type: KnowledgeContentType; lastAccess: number }
    >();

    for (const record of accessRecords) {
      const key = `${record.contentType}:${record.contentId}`;
      const existing = accessCounts.get(key);
      if (existing) {
        existing.count++;
        existing.lastAccess = Math.max(existing.lastAccess, record.accessedAt);
      } else {
        accessCounts.set(key, {
          count: 1,
          type: record.contentType,
          lastAccess: record.accessedAt,
        });
      }
    }

    const results: Array<{
      id: string;
      type: KnowledgeContentType;
      title: string;
      content: string;
      slug?: string;
      accessCount: number;
    }> = [];

    for (const [key, data] of Array.from(accessCounts.entries())
      .sort((left, right) => {
        if (right[1].count !== left[1].count) {
          return right[1].count - left[1].count;
        }
        return right[1].lastAccess - left[1].lastAccess;
      })
      .slice(0, limit)) {
      const [, contentId] = key.split(":");

      if (data.type === "snippet") {
        const snippet = await ctx.db.get(contentId as Id<"snippets">);
        if (!snippet) {
          continue;
        }
        results.push({
          id: snippet._id,
          type: "snippet",
          title: snippet.name,
          content: snippet.content,
          accessCount: data.count,
        });
        continue;
      }

      const article = await resolveArticleKnowledgeItem(
        ctx,
        args.workspaceId,
        data.type,
        contentId
      );
      if (!article) {
        continue;
      }

      results.push({
        ...article,
        accessCount: data.count,
      });
    }

    return results;
  },
});
