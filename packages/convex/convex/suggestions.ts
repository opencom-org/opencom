import { v } from "convex/values";
import { action, internalAction, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { authAction, authMutation, authQuery } from "./lib/authWrappers";

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const FEEDBACK_STATS_DEFAULT_LIMIT = 5000;
const FEEDBACK_STATS_MAX_LIMIT = 20000;
const WIDGET_QUERY_MAX_LENGTH = 500;

type SuggestionResult = {
  id: string;
  type: "article" | "internalArticle" | "snippet";
  title: string;
  snippet: string;
  score: number;
};

type SuggestionResultWithContent = SuggestionResult & { content: string };

type WidgetSuggestionResult = {
  id: string;
  title: string;
  snippet: string;
  score: number;
};

export const searchSimilar = authAction({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    contentTypes: v.optional(
      v.array(v.union(v.literal("article"), v.literal("internalArticle"), v.literal("snippet")))
    ),
    limit: v.optional(v.number()),
    model: v.optional(v.string()),
  },
  permission: "articles.read",
  handler: async (ctx, args): Promise<SuggestionResult[]> => {
    const limit = args.limit || 10;
    const modelName = args.model || DEFAULT_EMBEDDING_MODEL;

    const { embedding } = await embed({
      model: openai.embedding(modelName),
      value: args.query,
    });

    const results = await ctx.vectorSearch("contentEmbeddings", "by_embedding", {
      vector: embedding,
      limit: limit * 2,
      filter: (q) => q.eq("workspaceId", args.workspaceId),
    });

    let filteredResults = results;
    if (args.contentTypes && args.contentTypes.length > 0) {
      const contentTypeSet = new Set(args.contentTypes);
      filteredResults = results.filter((r: { _id: Id<"contentEmbeddings">; _score: number }) => {
        const doc = r as unknown as { contentType: string };
        return contentTypeSet.has(doc.contentType as "article" | "internalArticle" | "snippet");
      });
    }

    const topResults = filteredResults.slice(0, limit);

    const enrichedResults: (SuggestionResult | null)[] = await Promise.all(
      topResults.map(
        async (result: {
          _id: Id<"contentEmbeddings">;
          _score: number;
        }): Promise<SuggestionResult | null> => {
          const doc: Doc<"contentEmbeddings"> | null = await ctx.runQuery(
            internal.suggestions.getEmbeddingById,
            {
              id: result._id,
            }
          );
          if (!doc) return null;
          return {
            id: doc.contentId,
            type: doc.contentType,
            title: doc.title,
            snippet: doc.snippet,
            score: result._score,
          };
        }
      )
    );

    return enrichedResults.filter((r): r is SuggestionResult => r !== null);
  },
});

export const getForConversation = authAction({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SuggestionResultWithContent[]> => {
    const limit = args.limit || 5;

    const conversation: Doc<"conversations"> | null = await ctx.runQuery(
      internal.suggestions.getConversation,
      {
        conversationId: args.conversationId,
      }
    );

    if (!conversation) {
      return [];
    }

    await ctx.runQuery(internal.permissions.requirePermissionForAction, {
      userId: ctx.user._id,
      workspaceId: conversation.workspaceId,
      permission: "articles.read",
    });

    const settings: Doc<"aiAgentSettings"> | null = await ctx.runQuery(
      internal.suggestions.getAiSettings,
      {
        workspaceId: conversation.workspaceId,
      }
    );

    if (!settings?.suggestionsEnabled) {
      return [];
    }

    const messages: Doc<"messages">[] = await ctx.runQuery(internal.suggestions.getRecentMessages, {
      conversationId: args.conversationId,
      limit: 5,
    });

    if (messages.length === 0) {
      return [];
    }

    const contextText: string = messages.map((m: Doc<"messages">) => m.content).join("\n\n");

    const results: SuggestionResultWithContent[] = await ctx.runAction(
      internal.suggestions.searchSimilarInternal,
      {
        workspaceId: conversation.workspaceId,
        query: contextText,
        contentTypes: settings.knowledgeSources as unknown as
          | ("article" | "internalArticle" | "snippet")[]
          | undefined,
        limit,
        model: settings.embeddingModel,
      }
    );

    return results;
  },
});

export const searchSimilarInternal = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    contentTypes: v.optional(
      v.array(v.union(v.literal("article"), v.literal("internalArticle"), v.literal("snippet")))
    ),
    limit: v.optional(v.number()),
    model: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    Array<{
      id: string;
      type: "article" | "internalArticle" | "snippet";
      title: string;
      snippet: string;
      content: string;
      score: number;
    }>
  > => {
    const limit = args.limit || 10;
    const modelName = args.model || DEFAULT_EMBEDDING_MODEL;

    const { embedding } = await embed({
      model: openai.embedding(modelName),
      value: args.query,
    });

    const results = await ctx.vectorSearch("contentEmbeddings", "by_embedding", {
      vector: embedding,
      limit: limit * 2,
      filter: (q) => q.eq("workspaceId", args.workspaceId),
    });

    let filteredResults = results;
    if (args.contentTypes && args.contentTypes.length > 0) {
      const contentTypeSet = new Set(args.contentTypes);
      filteredResults = results.filter((r: { _id: Id<"contentEmbeddings">; _score: number }) => {
        const doc = r as unknown as { contentType: string };
        return contentTypeSet.has(doc.contentType as "article" | "internalArticle" | "snippet");
      });
    }

    const topResults = filteredResults.slice(0, limit);

    type EnrichedResult = {
      id: string;
      type: "article" | "internalArticle" | "snippet";
      title: string;
      snippet: string;
      content: string;
      score: number;
    } | null;

    const enrichedResults: EnrichedResult[] = await Promise.all(
      topResults.map(
        async (result: {
          _id: Id<"contentEmbeddings">;
          _score: number;
        }): Promise<EnrichedResult> => {
          const doc: {
            contentType: "article" | "internalArticle" | "snippet";
            contentId: string;
            title: string;
            snippet: string;
          } | null = await ctx.runQuery(internal.suggestions.getEmbeddingById, {
            id: result._id,
          });
          if (!doc) return null;

          const content = await ctx.runQuery(internal.suggestions.getContentById, {
            contentType: doc.contentType,
            contentId: doc.contentId,
          });

          return {
            id: doc.contentId,
            type: doc.contentType,
            title: doc.title,
            snippet: doc.snippet,
            content: content?.content || "",
            score: result._score,
          };
        }
      )
    );

    return enrichedResults.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

export const trackUsage = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    contentType: v.union(v.literal("article"), v.literal("internalArticle"), v.literal("snippet")),
    contentId: v.string(),
  },
  permission: "conversations.read",
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    if (conversation.workspaceId !== args.workspaceId) {
      throw new Error("Conversation does not belong to workspace");
    }

    return await ctx.db.insert("suggestionFeedback", {
      workspaceId: args.workspaceId,
      userId: ctx.user._id,
      conversationId: args.conversationId,
      contentType: args.contentType,
      contentId: args.contentId,
      action: "used",
      createdAt: Date.now(),
    });
  },
});

export const trackDismissal = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    contentType: v.union(v.literal("article"), v.literal("internalArticle"), v.literal("snippet")),
    contentId: v.string(),
  },
  permission: "conversations.read",
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    if (conversation.workspaceId !== args.workspaceId) {
      throw new Error("Conversation does not belong to workspace");
    }

    return await ctx.db.insert("suggestionFeedback", {
      workspaceId: args.workspaceId,
      userId: ctx.user._id,
      conversationId: args.conversationId,
      contentType: args.contentType,
      contentId: args.contentId,
      action: "dismissed",
      createdAt: Date.now(),
    });
  },
});

export const getFeedbackStats = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  permission: "conversations.read",
  handler: async (ctx, args) => {
    const startDate = args.startDate || Date.now() - 30 * 24 * 60 * 60 * 1000;
    const endDate = args.endDate || Date.now();
    const limit = Math.max(
      1,
      Math.min(args.limit ?? FEEDBACK_STATS_DEFAULT_LIMIT, FEEDBACK_STATS_MAX_LIMIT)
    );

    if (endDate < startDate) {
      throw new Error("Invalid date range");
    }

    const feedback = (await ctx.db
      .query("suggestionFeedback")
      .withIndex("by_workspace_created_at", (q) =>
        q.eq("workspaceId", args.workspaceId).gte("createdAt", startDate).lte("createdAt", endDate)
      )
      .take(limit + 1)) as Doc<"suggestionFeedback">[];

    const filteredFeedback = feedback.slice(0, limit);

    const used = filteredFeedback.filter((f) => f.action === "used").length;
    const dismissed = filteredFeedback.filter((f) => f.action === "dismissed").length;

    return {
      total: filteredFeedback.length,
      used,
      dismissed,
      usageRate: filteredFeedback.length > 0 ? used / filteredFeedback.length : 0,
      truncated: feedback.length > limit,
    };
  },
});

export const getEmbeddingById = internalQuery({
  args: {
    id: v.id("contentEmbeddings"),
  },
  handler: async (ctx, args) => {
    return (await ctx.db.get(args.id)) as Doc<"contentEmbeddings"> | null;
  },
});

export const getConversation = internalQuery({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    return (await ctx.db.get(args.conversationId)) as Doc<"conversations"> | null;
  },
});

export const getAiSettings = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiAgentSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
  },
});

export const getRecentMessages = internalQuery({
  args: {
    conversationId: v.id("conversations"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const messages = (await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .take(args.limit)) as Doc<"messages">[];

    return messages.reverse();
  },
});

export const getContentById = internalQuery({
  args: {
    contentType: v.union(v.literal("article"), v.literal("internalArticle"), v.literal("snippet")),
    contentId: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.contentType === "article") {
      const article = (await ctx.db.get(
        args.contentId as Id<"articles">
      )) as Doc<"articles"> | null;
      if (article) {
        return { content: article.content, title: article.title };
      }
    } else if (args.contentType === "internalArticle") {
      const article = (await ctx.db.get(
        args.contentId as Id<"internalArticles">
      )) as Doc<"internalArticles"> | null;
      if (article) {
        return { content: article.content, title: article.title };
      }
    } else if (args.contentType === "snippet") {
      const snippet = (await ctx.db.get(
        args.contentId as Id<"snippets">
      )) as Doc<"snippets"> | null;
      if (snippet) {
        return { content: snippet.content, title: snippet.name };
      }
    }
    return null;
  },
});

export const searchForWidget = action({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.id("visitors"),
    sessionToken: v.string(),
    origin: v.optional(v.string()),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<WidgetSuggestionResult[]> => {
    const normalizedQuery = args.query.trim();

    if (normalizedQuery.length < 2) {
      return [];
    }

    if (normalizedQuery.length > WIDGET_QUERY_MAX_LENGTH) {
      throw new Error("Query exceeds max length");
    }

    const sessionValidation = await ctx.runQuery(api.widgetSessions.validateSessionToken, {
      workspaceId: args.workspaceId,
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
    });

    if (!sessionValidation.valid) {
      throw new Error(sessionValidation.reason || "Session token validation failed");
    }

    const originValidation = await ctx.runQuery(api.workspaces.validateOrigin, {
      workspaceId: args.workspaceId,
      origin: args.origin ?? "",
    });
    if (!originValidation.valid) {
      throw new Error(`Origin validation failed: ${originValidation.reason}`);
    }

    const limit = Math.max(1, Math.min(args.limit || 3, 5));

    const automationSettings: Doc<"automationSettings"> | null = await ctx.runQuery(
      internal.suggestions.getAutomationSettings,
      {
        workspaceId: args.workspaceId,
      }
    );

    if (!automationSettings?.suggestArticlesEnabled) {
      return [];
    }

    const { embedding } = await embed({
      model: openai.embedding(DEFAULT_EMBEDDING_MODEL),
      value: normalizedQuery,
    });

    const results = await ctx.vectorSearch("contentEmbeddings", "by_embedding", {
      vector: embedding,
      limit: limit * 2,
      filter: (q) => q.eq("workspaceId", args.workspaceId),
    });

    const articleResults = results.filter((r: { _id: Id<"contentEmbeddings">; _score: number }) => {
      const doc = r as unknown as { contentType: string };
      return doc.contentType === "article";
    });

    const topResults = articleResults.slice(0, limit);

    const enrichedResults: (WidgetSuggestionResult | null)[] = await Promise.all(
      topResults.map(
        async (result: {
          _id: Id<"contentEmbeddings">;
          _score: number;
        }): Promise<WidgetSuggestionResult | null> => {
          const doc: Doc<"contentEmbeddings"> | null = await ctx.runQuery(
            internal.suggestions.getEmbeddingById,
            {
              id: result._id,
            }
          );
          if (!doc) return null;

          return {
            id: doc.contentId,
            title: doc.title,
            snippet: doc.snippet,
            score: result._score,
          };
        }
      )
    );

    return enrichedResults.filter((r): r is WidgetSuggestionResult => r !== null);
  },
});

export const getAutomationSettings = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("automationSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();
  },
});
