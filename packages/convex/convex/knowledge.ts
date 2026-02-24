import { v } from "convex/values";
import { authMutation, authQuery } from "./lib/authWrappers";
import { Id } from "./_generated/dataModel";

const contentTypeValidator = v.union(
  v.literal("article"),
  v.literal("internalArticle"),
  v.literal("snippet")
);

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

    type SearchResult = {
      id: string;
      type: "article" | "internalArticle" | "snippet";
      title: string;
      content: string;
      snippet: string;
      folderId?: string;
      tags?: string[];
      relevanceScore: number;
      updatedAt: number;
    };

    const results: SearchResult[] = [];

    // Helper to create snippet from content
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

    // Helper to calculate relevance score
    const calculateScore = (title: string, content: string, term: string): number => {
      let score = 0;
      const lowerTitle = title.toLowerCase();
      const lowerContent = content.toLowerCase();

      // Title match is worth more
      if (lowerTitle.includes(term)) {
        score += 10;
        if (lowerTitle.startsWith(term)) score += 5;
        if (lowerTitle === term) score += 10;
      }

      // Content matches
      const contentMatches = (lowerContent.match(new RegExp(term, "g")) || []).length;
      score += Math.min(contentMatches, 5);

      return score;
    };

    // Search public articles
    if (contentTypes.includes("article")) {
      let articles = await ctx.db
        .query("articles")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect();

      // Filter published only for public articles
      articles = articles.filter((a) => a.status === "published");

      // Filter by folder if specified
      if (args.folderId) {
        articles = articles.filter((a) => a.folderId === args.folderId);
      }

      for (const article of articles) {
        if (
          article.title.toLowerCase().includes(searchTerm) ||
          article.content.toLowerCase().includes(searchTerm)
        ) {
          results.push({
            id: article._id,
            type: "article",
            title: article.title,
            content: article.content,
            snippet: createSnippet(article.content, searchTerm),
            folderId: article.folderId,
            relevanceScore: calculateScore(article.title, article.content, searchTerm),
            updatedAt: article.updatedAt,
          });
        }
      }
    }

    // Search internal articles
    if (contentTypes.includes("internalArticle")) {
      let internalArticles = await ctx.db
        .query("internalArticles")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect();

      // Filter out archived
      internalArticles = internalArticles.filter((a) => a.status !== "archived");

      // Filter by folder if specified
      if (args.folderId) {
        internalArticles = internalArticles.filter((a) => a.folderId === args.folderId);
      }

      // Filter by tags if specified
      if (args.tags && args.tags.length > 0) {
        internalArticles = internalArticles.filter(
          (a) => a.tags && args.tags!.some((tag: string) => a.tags!.includes(tag))
        );
      }

      for (const article of internalArticles) {
        const matchesSearch =
          article.title.toLowerCase().includes(searchTerm) ||
          article.content.toLowerCase().includes(searchTerm) ||
          (article.tags && article.tags.some((tag) => tag.toLowerCase().includes(searchTerm)));

        if (matchesSearch) {
          results.push({
            id: article._id,
            type: "internalArticle",
            title: article.title,
            content: article.content,
            snippet: createSnippet(article.content, searchTerm),
            folderId: article.folderId,
            tags: article.tags,
            relevanceScore: calculateScore(article.title, article.content, searchTerm),
            updatedAt: article.updatedAt,
          });
        }
      }
    }

    // Search snippets
    if (contentTypes.includes("snippet")) {
      let snippets = await ctx.db
        .query("snippets")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect();

      // Filter by folder if specified
      if (args.folderId) {
        snippets = snippets.filter((s) => s.folderId === args.folderId);
      }

      for (const snippet of snippets) {
        if (
          snippet.name.toLowerCase().includes(searchTerm) ||
          snippet.content.toLowerCase().includes(searchTerm) ||
          (snippet.shortcut && snippet.shortcut.toLowerCase().includes(searchTerm))
        ) {
          results.push({
            id: snippet._id,
            type: "snippet",
            title: snippet.name,
            content: snippet.content,
            snippet: createSnippet(snippet.content, searchTerm),
            folderId: snippet.folderId,
            relevanceScore: calculateScore(snippet.name, snippet.content, searchTerm),
            updatedAt: snippet.updatedAt,
          });
        }
      }
    }

    // Sort by relevance score (descending), then by updated date
    results.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return b.updatedAt - a.updatedAt;
    });

    return results.slice(0, limit);
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

    // Check if there's an existing access record
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
      // Update the access time
      await ctx.db.patch(existing._id, { accessedAt: now });
      return existing._id;
    }

    // Create new access record
    const accessId = await ctx.db.insert("recentContentAccess", {
      userId: args.userId,
      workspaceId: args.workspaceId,
      contentType: args.contentType,
      contentId: args.contentId,
      accessedAt: now,
    });

    // Clean up old records (keep only last 50)
    const allAccess = await ctx.db
      .query("recentContentAccess")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", args.userId).eq("workspaceId", args.workspaceId)
      )
      .collect();

    if (allAccess.length > 50) {
      const sorted = allAccess.sort((a, b) => b.accessedAt - a.accessedAt);
      const toDelete = sorted.slice(50);
      for (const record of toDelete) {
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

    // Sort by access time
    const sorted = accessRecords.sort((a, b) => b.accessedAt - a.accessedAt);
    const recent = sorted.slice(0, limit);

    // Fetch the actual content
    type RecentItem = {
      id: string;
      type: "article" | "internalArticle" | "snippet";
      title: string;
      content: string;
      accessedAt: number;
    };

    const results: RecentItem[] = [];

    for (const record of recent) {
      if (record.contentType === "article") {
        const article = await ctx.db.get(record.contentId as Id<"articles">);
        if (article) {
          results.push({
            id: record.contentId,
            type: "article",
            title: article.title,
            content: article.content,
            accessedAt: record.accessedAt,
          });
        }
      } else if (record.contentType === "internalArticle") {
        const article = await ctx.db.get(record.contentId as Id<"internalArticles">);
        if (article) {
          results.push({
            id: record.contentId,
            type: "internalArticle",
            title: article.title,
            content: article.content,
            accessedAt: record.accessedAt,
          });
        }
      } else if (record.contentType === "snippet") {
        const snippet = await ctx.db.get(record.contentId as Id<"snippets">);
        if (snippet) {
          results.push({
            id: record.contentId,
            type: "snippet",
            title: snippet.name,
            content: snippet.content,
            accessedAt: record.accessedAt,
          });
        }
      }
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

    // Count accesses per content item
    const accessCounts = new Map<
      string,
      { count: number; type: "article" | "internalArticle" | "snippet"; lastAccess: number }
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

    // Sort by count, then by last access
    const sorted = Array.from(accessCounts.entries())
      .sort((a, b) => {
        if (b[1].count !== a[1].count) {
          return b[1].count - a[1].count;
        }
        return b[1].lastAccess - a[1].lastAccess;
      })
      .slice(0, limit);

    // Fetch the actual content
    type FrequentItem = {
      id: string;
      type: "article" | "internalArticle" | "snippet";
      title: string;
      content: string;
      accessCount: number;
    };

    const results: FrequentItem[] = [];

    for (const [key, data] of sorted) {
      const [type, id] = key.split(":");
      if (type === "article") {
        const article = await ctx.db.get(id as Id<"articles">);
        if (article) {
          results.push({
            id,
            type: "article",
            title: article.title,
            content: article.content,
            accessCount: data.count,
          });
        }
      } else if (type === "internalArticle") {
        const article = await ctx.db.get(id as Id<"internalArticles">);
        if (article) {
          results.push({
            id,
            type: "internalArticle",
            title: article.title,
            content: article.content,
            accessCount: data.count,
          });
        }
      } else if (type === "snippet") {
        const snippet = await ctx.db.get(id as Id<"snippets">);
        if (snippet) {
          results.push({
            id,
            type: "snippet",
            title: snippet.name,
            content: snippet.content,
            accessCount: data.count,
          });
        }
      }
    }

    return results;
  },
});
