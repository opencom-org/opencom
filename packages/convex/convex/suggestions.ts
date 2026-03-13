import { v } from "convex/values";
import { makeFunctionReference, type FunctionReference } from "convex/server";
import { action, internalAction, internalQuery } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { embed } from "ai";
import { authAction, authMutation, authQuery } from "./lib/authWrappers";
import { createAIClient } from "./lib/aiGateway";
import { getUnifiedArticleByIdOrLegacyInternalId, isInternalArticle } from "./lib/unifiedArticles";
import type { Permission } from "./permissions";

const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const FEEDBACK_STATS_DEFAULT_LIMIT = 5000;
const FEEDBACK_STATS_MAX_LIMIT = 20000;
const SUGGESTIONS_DEFAULT_LIMIT = 10;
const SUGGESTIONS_MAX_LIMIT = 20;
const WIDGET_QUERY_MAX_LENGTH = 200;

function getShallowRunQuery(ctx: { runQuery: unknown }) {
  return ctx.runQuery as unknown as <Args extends Record<string, unknown>, Return>(
    queryRef: SuggestionQueryRef<Args, Return>,
    queryArgs: Args
  ) => Promise<Return>;
}

function getShallowRunAction(ctx: { runAction: unknown }) {
  return ctx.runAction as unknown as <Args extends Record<string, unknown>, Return>(
    actionRef: SuggestionActionRef<Args, Return>,
    actionArgs: Args
  ) => Promise<Return>;
}

function normalizeSuggestionQuery(query: string): string {
  return query.trim().toLowerCase();
}

type SuggestionContentType = "article" | "internalArticle" | "snippet";

type SuggestionResult = {
  id: string;
  type: SuggestionContentType;
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

type SuggestionQueryRef<Args extends Record<string, unknown>, Return> = FunctionReference<
  "query",
  "public" | "internal",
  Args,
  Return
>;

type SuggestionActionRef<Args extends Record<string, unknown>, Return> = FunctionReference<
  "action",
  "public" | "internal",
  Args,
  Return
>;

type PermissionCheckResult = { ok: true };

type SuggestionContentRecord = {
  content: string;
  title: string;
} | null;

type SessionValidationResult =
  | {
      valid: true;
      visitorId: Id<"visitors">;
      identityVerified: boolean;
    }
  | {
      valid: false;
      reason: string;
    };

type OriginValidationResult = {
  valid: boolean;
  reason: string;
};

const GET_EMBEDDING_BY_ID_REF: SuggestionQueryRef<
  { id: Id<"contentEmbeddings"> },
  Doc<"contentEmbeddings"> | null
> = makeFunctionReference<"query", { id: Id<"contentEmbeddings"> }, Doc<"contentEmbeddings"> | null>(
  "suggestions:getEmbeddingById"
);

const GET_CONVERSATION_REF: SuggestionQueryRef<
  { conversationId: Id<"conversations"> },
  Doc<"conversations"> | null
> = makeFunctionReference<
  "query",
  { conversationId: Id<"conversations"> },
  Doc<"conversations"> | null
>("suggestions:getConversation");

const REQUIRE_PERMISSION_FOR_ACTION_REF: SuggestionQueryRef<
  {
    userId: Id<"users">;
    workspaceId: Id<"workspaces">;
    permission: Permission;
  },
  PermissionCheckResult
> = makeFunctionReference<
  "query",
  {
    userId: Id<"users">;
    workspaceId: Id<"workspaces">;
    permission: Permission;
  },
  PermissionCheckResult
>("permissions:requirePermissionForAction");

const GET_AI_SETTINGS_REF: SuggestionQueryRef<
  { workspaceId: Id<"workspaces"> },
  Doc<"aiAgentSettings"> | null
> = makeFunctionReference<"query", { workspaceId: Id<"workspaces"> }, Doc<"aiAgentSettings"> | null>(
  "suggestions:getAiSettings"
);

const GET_RECENT_MESSAGES_REF: SuggestionQueryRef<
  { conversationId: Id<"conversations">; limit: number },
  Doc<"messages">[]
> = makeFunctionReference<
  "query",
  { conversationId: Id<"conversations">; limit: number },
  Doc<"messages">[]
>("suggestions:getRecentMessages");

const SEARCH_SIMILAR_INTERNAL_REF: SuggestionActionRef<
  {
    workspaceId: Id<"workspaces">;
    query: string;
    contentTypes?: SuggestionContentType[];
    limit?: number;
    model?: string;
  },
  SuggestionResultWithContent[]
> = makeFunctionReference<
  "action",
  {
    workspaceId: Id<"workspaces">;
    query: string;
    contentTypes?: SuggestionContentType[];
    limit?: number;
    model?: string;
  },
  SuggestionResultWithContent[]
>("suggestions:searchSimilarInternal");

const GET_CONTENT_BY_ID_REF: SuggestionQueryRef<
  { contentType: SuggestionContentType; contentId: string },
  SuggestionContentRecord
> = makeFunctionReference<
  "query",
  { contentType: SuggestionContentType; contentId: string },
  SuggestionContentRecord
>("suggestions:getContentById");

const VALIDATE_SESSION_TOKEN_REF: SuggestionQueryRef<
  {
    workspaceId: Id<"workspaces">;
    sessionToken: string;
    visitorId?: Id<"visitors">;
  },
  SessionValidationResult
> = makeFunctionReference<
  "query",
  {
    workspaceId: Id<"workspaces">;
    sessionToken: string;
    visitorId?: Id<"visitors">;
  },
  SessionValidationResult
>("widgetSessions:validateSessionToken");

const VALIDATE_ORIGIN_REF: SuggestionQueryRef<
  { workspaceId: Id<"workspaces">; origin: string },
  OriginValidationResult
> = makeFunctionReference<
  "query",
  { workspaceId: Id<"workspaces">; origin: string },
  OriginValidationResult
>("workspaces:validateOrigin");

const GET_AUTOMATION_SETTINGS_REF: SuggestionQueryRef<
  { workspaceId: Id<"workspaces"> },
  Doc<"automationSettings"> | null
> = makeFunctionReference<
  "query",
  { workspaceId: Id<"workspaces"> },
  Doc<"automationSettings"> | null
>("suggestions:getAutomationSettings");

function normalizeSuggestionContentType(value: string): SuggestionContentType | null {
  switch (value) {
    case "article":
    case "internalArticle":
    case "snippet":
      return value;
    case "articles":
      return "article";
    case "internalArticles":
      return "internalArticle";
    case "snippets":
      return "snippet";
    default:
      return null;
  }
}

function normalizeSuggestionContentTypes(
  values: readonly string[] | undefined
): SuggestionContentType[] | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }

  const normalized = Array.from(
    new Set(values.map(normalizeSuggestionContentType).filter((value): value is SuggestionContentType => Boolean(value)))
  );

  return normalized.length > 0 ? normalized : undefined;
}

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
    const limit = Math.max(
      1,
      Math.min(args.limit ?? SUGGESTIONS_DEFAULT_LIMIT, SUGGESTIONS_MAX_LIMIT)
    );
    const modelName = args.model || DEFAULT_EMBEDDING_MODEL;
    const aiClient = createAIClient();
    const runQuery = getShallowRunQuery(ctx);

    const { embedding } = await embed({
      model: aiClient.embedding(modelName),
      value: args.query,
    });

    const results = await ctx.vectorSearch("contentEmbeddings", "by_embedding", {
      vector: embedding,
      limit: limit * 8,
      filter: (q) => q.eq("workspaceId", args.workspaceId),
    });

    const contentTypeSet =
      args.contentTypes && args.contentTypes.length > 0 ? new Set(args.contentTypes) : null;

    const enrichedResults: (SuggestionResult | null)[] = await Promise.all(
      results.map(
        async (result: {
          _id: Id<"contentEmbeddings">;
          _score: number;
        }): Promise<SuggestionResult | null> => {
          const doc = await runQuery(GET_EMBEDDING_BY_ID_REF, {
            id: result._id,
          });
          if (!doc) return null;
          if (contentTypeSet && !contentTypeSet.has(doc.contentType)) return null;
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

    const filtered = enrichedResults.filter((r): r is SuggestionResult => r !== null);
    const deduped: SuggestionResult[] = [];
    const seen = new Set<string>();
    for (const result of filtered) {
      const key = `${result.type}:${result.id}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduped.push(result);
      if (deduped.length >= limit) {
        break;
      }
    }

    return deduped;
  },
});

export const getForConversation = authAction({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SuggestionResultWithContent[]> => {
    const limit = args.limit || 5;

    const runQuery = getShallowRunQuery(ctx);
    const runAction = getShallowRunAction(ctx);

    const conversation = await runQuery(GET_CONVERSATION_REF, {
      conversationId: args.conversationId,
    });

    if (!conversation) {
      return [];
    }

    await runQuery(REQUIRE_PERMISSION_FOR_ACTION_REF, {
      userId: ctx.user._id,
      workspaceId: conversation.workspaceId,
      permission: "articles.read",
    });

    const settings = await runQuery(GET_AI_SETTINGS_REF, {
      workspaceId: conversation.workspaceId,
    });

    if (!settings?.suggestionsEnabled) {
      return [];
    }

    const messages = await runQuery(GET_RECENT_MESSAGES_REF, {
      conversationId: args.conversationId,
      limit: 5,
    });

    if (messages.length === 0) {
      return [];
    }

    const contextText: string = messages.map((m: Doc<"messages">) => m.content).join("\n\n");
    const normalizedContentTypes = normalizeSuggestionContentTypes(
      settings.knowledgeSources as unknown as string[] | undefined
    );

    const results = await runAction(SEARCH_SIMILAR_INTERNAL_REF, {
      workspaceId: conversation.workspaceId,
      query: contextText,
      contentTypes: normalizedContentTypes,
      limit,
      model: settings.embeddingModel,
    });

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
    const limit = Math.max(
      1,
      Math.min(args.limit ?? SUGGESTIONS_DEFAULT_LIMIT, SUGGESTIONS_MAX_LIMIT)
    );
    const modelName = args.model || DEFAULT_EMBEDDING_MODEL;
    const aiClient = createAIClient();
    const runQuery = getShallowRunQuery(ctx);

    const { embedding } = await embed({
      model: aiClient.embedding(modelName),
      value: args.query,
    });

    const results = await ctx.vectorSearch("contentEmbeddings", "by_embedding", {
      vector: embedding,
      limit: limit * 8,
      filter: (q) => q.eq("workspaceId", args.workspaceId),
    });

    const contentTypeSet =
      args.contentTypes && args.contentTypes.length > 0 ? new Set(args.contentTypes) : null;

    type EnrichedResult = {
      id: string;
      type: "article" | "internalArticle" | "snippet";
      title: string;
      snippet: string;
      content: string;
      score: number;
    } | null;

    const enrichedResults: EnrichedResult[] = await Promise.all(
      results.map(
        async (result: {
          _id: Id<"contentEmbeddings">;
          _score: number;
        }): Promise<EnrichedResult> => {
          const doc = await runQuery(GET_EMBEDDING_BY_ID_REF, {
            id: result._id,
          });
          if (!doc) return null;
          if (contentTypeSet && !contentTypeSet.has(doc.contentType)) return null;

          const content = await runQuery(GET_CONTENT_BY_ID_REF, {
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

    const filtered = enrichedResults.filter((r): r is NonNullable<typeof r> => r !== null);
    const deduped: NonNullable<EnrichedResult>[] = [];
    const seen = new Set<string>();
    for (const result of filtered) {
      const key = `${result.type}:${result.id}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduped.push(result);
      if (deduped.length >= limit) {
        break;
      }
    }

    return deduped;
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
      const article = await getUnifiedArticleByIdOrLegacyInternalId(
        ctx.db,
        args.contentId as Id<"articles"> | Id<"internalArticles">
      );
      if (article && article.visibility !== "internal") {
        return { content: article.content, title: article.title };
      }
    } else if (args.contentType === "internalArticle") {
      const article = await getUnifiedArticleByIdOrLegacyInternalId(
        ctx.db,
        args.contentId as Id<"articles"> | Id<"internalArticles">
      );
      if (article && isInternalArticle(article)) {
        return { content: article.content, title: article.title };
      }
      const legacyArticle = (await ctx.db.get(
        args.contentId as Id<"internalArticles">
      )) as Doc<"internalArticles"> | null;
      if (legacyArticle) {
        return { content: legacyArticle.content, title: legacyArticle.title };
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
    const normalizedQuery = normalizeSuggestionQuery(args.query);

    if (normalizedQuery.length < 2) {
      return [];
    }

    if (normalizedQuery.length > WIDGET_QUERY_MAX_LENGTH) {
      throw new Error("Query exceeds max length");
    }

    const runQuery = getShallowRunQuery(ctx);
    const sessionValidation = await runQuery(VALIDATE_SESSION_TOKEN_REF, {
      workspaceId: args.workspaceId,
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
    });

    if (!sessionValidation.valid) {
      throw new Error(sessionValidation.reason || "Session token validation failed");
    }

    const originValidation = await runQuery(VALIDATE_ORIGIN_REF, {
      workspaceId: args.workspaceId,
      origin: args.origin ?? "",
    });
    if (!originValidation.valid) {
      throw new Error(originValidation.reason || "Origin validation failed");
    }

    const limit = Math.max(1, Math.min(args.limit || 3, 5));

    const automationSettings = await runQuery(GET_AUTOMATION_SETTINGS_REF, {
      workspaceId: args.workspaceId,
    });

    if (!automationSettings?.suggestArticlesEnabled) {
      return [];
    }

    const aiClient = createAIClient();
    const { embedding } = await embed({
      model: aiClient.embedding(DEFAULT_EMBEDDING_MODEL),
      value: normalizedQuery,
    });

    const results = await ctx.vectorSearch("contentEmbeddings", "by_embedding", {
      vector: embedding,
      limit: limit * 8,
      filter: (q) => q.eq("workspaceId", args.workspaceId),
    });

    const enrichedResults: (WidgetSuggestionResult | null)[] = await Promise.all(
      results.map(
        async (result: {
          _id: Id<"contentEmbeddings">;
          _score: number;
        }): Promise<WidgetSuggestionResult | null> => {
          const doc = await runQuery(GET_EMBEDDING_BY_ID_REF, {
            id: result._id,
          });
          if (!doc) return null;
          if (doc.contentType !== "article") return null;

          return {
            id: doc.contentId,
            title: doc.title,
            snippet: doc.snippet,
            score: result._score,
          };
        }
      )
    );
    const filtered = enrichedResults.filter((r): r is WidgetSuggestionResult => r !== null);
    const deduped: WidgetSuggestionResult[] = [];
    const seen = new Set<string>();
    for (const result of filtered) {
      if (seen.has(result.id)) {
        continue;
      }
      seen.add(result.id);
      deduped.push(result);
      if (deduped.length >= limit) {
        break;
      }
    }

    return deduped;
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
