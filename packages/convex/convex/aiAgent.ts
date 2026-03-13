import { v } from "convex/values";
import {
  mutation,
  query,
  internalQuery,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getAuthenticatedUserFromSession } from "./auth";
import { getWorkspaceMembership, requirePermission } from "./permissions";
import { authMutation, authQuery } from "./lib/authWrappers";
import { getShallowRunAfter, routeEventRef } from "./notifications/functionRefs";
import { resolveVisitorFromSession } from "./widgetSessions";
import { isInternalArticle, isPublicArticle, listUnifiedArticlesWithLegacyFallback } from "./lib/unifiedArticles";

const knowledgeSourceValidator = v.union(
  v.literal("articles"),
  v.literal("internalArticles"),
  v.literal("snippets")
);

type KnowledgeSource = "articles" | "internalArticles" | "snippets";


const aiResponseSourceValidator = v.object({
  type: v.string(),
  id: v.string(),
  title: v.string(),
  articleId: v.optional(v.string()),
});

const DEFAULT_AI_SETTINGS = {
  enabled: false,
  knowledgeSources: ["articles"] as KnowledgeSource[],
  confidenceThreshold: 0.6,
  personality: null,
  handoffMessage: "Let me connect you with a human agent who can help you better.",
  workingHours: null,
  model: "openai/gpt-5-nano",
  suggestionsEnabled: false,
  embeddingModel: "text-embedding-3-small",
  lastConfigError: null,
};

function withAISettingDefaults(settings: Doc<"aiAgentSettings"> | null): {
  _id?: Id<"aiAgentSettings">;
  _creationTime?: number;
  workspaceId?: Id<"workspaces">;
  enabled: boolean;
  knowledgeSources: KnowledgeSource[];
  confidenceThreshold: number;
  personality: string | null;
  handoffMessage: string;
  workingHours: { start: string; end: string; timezone: string } | null;
  model: string;
  suggestionsEnabled: boolean;
  embeddingModel: string;
  lastConfigError: {
    code: string;
    message: string;
    provider?: string;
    model?: string;
    detectedAt: number;
  } | null;
  createdAt?: number;
  updatedAt?: number;
} {
  if (!settings) {
    return DEFAULT_AI_SETTINGS;
  }

  return {
    ...settings,
    knowledgeSources: settings.knowledgeSources as KnowledgeSource[],
    personality: settings.personality ?? null,
    handoffMessage: settings.handoffMessage ?? DEFAULT_AI_SETTINGS.handoffMessage,
    workingHours: settings.workingHours ?? null,
    suggestionsEnabled: settings.suggestionsEnabled ?? false,
    embeddingModel: settings.embeddingModel ?? DEFAULT_AI_SETTINGS.embeddingModel,
    lastConfigError: settings.lastConfigError ?? null,
  };
}

async function getWorkspaceAISettings(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">
): Promise<Doc<"aiAgentSettings"> | null> {
  return await ctx.db
    .query("aiAgentSettings")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .first();
}
async function requireConversationAccess(
  ctx: QueryCtx | MutationCtx,
  args: {
    conversationId: Id<"conversations">;
    visitorId?: Id<"visitors">;
    sessionToken?: string;
  }
): Promise<Doc<"conversations">> {
  const conversation = (await ctx.db.get(args.conversationId)) as Doc<"conversations"> | null;
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const authUser = await getAuthenticatedUserFromSession(ctx);
  if (authUser) {
    await requirePermission(ctx, authUser._id, conversation.workspaceId, "conversations.read");
    return conversation;
  }

  const resolved = await resolveVisitorFromSession(ctx, {
    sessionToken: args.sessionToken,
    workspaceId: conversation.workspaceId,
  });
  if (args.visitorId && args.visitorId !== resolved.visitorId) {
    throw new Error("Not authorized");
  }
  if (!conversation.visitorId || conversation.visitorId !== resolved.visitorId) {
    throw new Error("Not authorized");
  }

  return conversation;
}

// Get AI Agent settings for a workspace
export const getSettings = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    // Require workspace membership
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return DEFAULT_AI_SETTINGS;
    }

    const membership = await getWorkspaceMembership(ctx, user._id, args.workspaceId);
    if (!membership) {
      return DEFAULT_AI_SETTINGS;
    }

    const settings = await getWorkspaceAISettings(ctx, args.workspaceId);
    return withAISettingDefaults(settings);
  },
});

// Public AI settings for widget/runtime use (no workspace membership required)
export const getPublicSettings = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const settings = await getWorkspaceAISettings(ctx, args.workspaceId);
    const normalized = withAISettingDefaults(settings);

    return {
      enabled: normalized.enabled,
      knowledgeSources: normalized.knowledgeSources,
      confidenceThreshold: normalized.confidenceThreshold,
      personality: normalized.personality,
      handoffMessage: normalized.handoffMessage,
      workingHours: normalized.workingHours,
      model: normalized.model,
      suggestionsEnabled: normalized.suggestionsEnabled,
      embeddingModel: normalized.embeddingModel,
    };
  },
});

export const getRuntimeSettingsForWorkspace = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const settings = await getWorkspaceAISettings(ctx, args.workspaceId);
    return withAISettingDefaults(settings);
  },
});

// Update AI Agent settings
export const updateSettings = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    enabled: v.optional(v.boolean()),
    knowledgeSources: v.optional(v.array(knowledgeSourceValidator)),
    confidenceThreshold: v.optional(v.number()),
    personality: v.optional(v.string()),
    handoffMessage: v.optional(v.string()),
    workingHours: v.optional(
      v.union(
        v.null(),
        v.object({
          start: v.string(),
          end: v.string(),
          timezone: v.string(),
        })
      )
    ),
    model: v.optional(v.string()),
    suggestionsEnabled: v.optional(v.boolean()),
    embeddingModel: v.optional(v.string()),
  },
  permission: "settings.workspace",
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("aiAgentSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (existing) {
      const updates: Record<string, unknown> = {
        updatedAt: now,
        lastConfigError: undefined,
      };
      if (args.enabled !== undefined) updates.enabled = args.enabled;
      if (args.knowledgeSources !== undefined) updates.knowledgeSources = args.knowledgeSources;
      if (args.confidenceThreshold !== undefined)
        updates.confidenceThreshold = args.confidenceThreshold;
      if (args.personality !== undefined) updates.personality = args.personality;
      if (args.handoffMessage !== undefined) updates.handoffMessage = args.handoffMessage;
      if (args.workingHours !== undefined) updates.workingHours = args.workingHours ?? undefined;
      if (args.model !== undefined) updates.model = args.model;
      if (args.suggestionsEnabled !== undefined)
        updates.suggestionsEnabled = args.suggestionsEnabled;
      if (args.embeddingModel !== undefined) updates.embeddingModel = args.embeddingModel;

      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    // Create new settings
    return await ctx.db.insert("aiAgentSettings", {
      workspaceId: args.workspaceId,
      enabled: args.enabled ?? false,
      knowledgeSources: args.knowledgeSources ?? ["articles"],
      confidenceThreshold: args.confidenceThreshold ?? 0.6,
      personality: args.personality,
      handoffMessage: args.handoffMessage,
      workingHours: args.workingHours ?? undefined,
      model: args.model ?? "openai/gpt-5-nano",
      suggestionsEnabled: args.suggestionsEnabled ?? false,
      embeddingModel: args.embeddingModel ?? "text-embedding-3-small",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const recordRuntimeDiagnostic = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    code: v.string(),
    message: v.string(),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await getWorkspaceAISettings(ctx, args.workspaceId);

    const diagnostic = {
      code: args.code,
      message: args.message,
      provider: args.provider,
      model: args.model,
      detectedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastConfigError: diagnostic,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("aiAgentSettings", {
      workspaceId: args.workspaceId,
      enabled: false,
      knowledgeSources: ["articles"],
      confidenceThreshold: 0.6,
      personality: undefined,
      handoffMessage: "Let me connect you with a human agent who can help you better.",
      workingHours: undefined,
      model: "openai/gpt-5-nano",
      suggestionsEnabled: false,
      embeddingModel: "text-embedding-3-small",
      lastConfigError: diagnostic,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const clearRuntimeDiagnostic = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const existing = await getWorkspaceAISettings(ctx, args.workspaceId);
    if (!existing) {
      return null;
    }
    await ctx.db.patch(existing._id, {
      lastConfigError: undefined,
      updatedAt: Date.now(),
    });
    return existing._id;
  },
});

// Get relevant knowledge for a query
export const getRelevantKnowledge = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    knowledgeSources: v.optional(v.array(knowledgeSourceValidator)),
    limit: v.optional(v.number()),
  },
  permission: "articles.read",
  handler: async (ctx, args) => {
    const normalizedQuery = args.query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    const limit = Math.max(1, Math.min(args.limit ?? 5, 20));
    const requestedSources = new Set(args.knowledgeSources ?? ["articles"]);
    const queryTerms = normalizedQuery
      .split(/[^a-z0-9]+/g)
      .map((term) => term.trim())
      .filter((term) => term.length >= 3);

    const scoreText = (title: string, content: string): number => {
      const titleLower = title.toLowerCase();
      const contentLower = content.toLowerCase();
      let score = 0;

      if (titleLower.includes(normalizedQuery)) score += 8;
      if (contentLower.includes(normalizedQuery)) score += 4;

      for (const term of queryTerms) {
        if (titleLower.includes(term)) score += 3;
        if (contentLower.includes(term)) score += 1;
      }

      return score;
    };

    const candidates: Array<{
      id: string;
      type: "article" | "internalArticle" | "snippet";
      title: string;
      content: string;
      relevanceScore: number;
    }> = [];

    if (requestedSources.has("articles") || requestedSources.has("internalArticles")) {
      const articles = await listUnifiedArticlesWithLegacyFallback(ctx.db, args.workspaceId);
      for (const article of articles) {
        if (article.status !== "published") {
          continue;
        }
        if (isPublicArticle(article) && requestedSources.has("articles")) {
          const score = scoreText(article.title, article.content);
          if (score > 0) {
            candidates.push({
              id: article._id,
              type: "article",
              title: article.title,
              content: article.content,
              relevanceScore: Math.min(100, score * 10),
            });
          }
        }
        if (isInternalArticle(article) && requestedSources.has("internalArticles")) {
          const score = scoreText(article.title, article.content);
          if (score > 0) {
            candidates.push({
              id: article._id,
              type: "internalArticle",
              title: article.title,
              content: article.content,
              relevanceScore: Math.min(100, score * 10),
            });
          }
        }
      }
    }

    if (requestedSources.has("snippets")) {
      const snippets = (await ctx.db
        .query("snippets")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect()) as Doc<"snippets">[];
      for (const snippet of snippets) {
        const score = scoreText(snippet.name, snippet.content);
        if (score > 0) {
          candidates.push({
            id: snippet._id,
            type: "snippet",
            title: snippet.name,
            content: snippet.content,
            relevanceScore: Math.min(100, score * 10),
          });
        }
      }
    }

    candidates.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return candidates.slice(0, limit);
  },
});

export const getRelevantKnowledgeForRuntime = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    knowledgeSources: v.optional(v.array(knowledgeSourceValidator)),
    limit: v.optional(v.number()),
  },
  handler: async () => {
    return [];
  },
});

// Store an AI response
export const storeResponse = mutation({
  args: {
    conversationId: v.id("conversations"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    messageId: v.id("messages"),
    query: v.string(),
    response: v.string(),
    generatedCandidateResponse: v.optional(v.string()),
    generatedCandidateSources: v.optional(
      v.array(aiResponseSourceValidator)
    ),
    generatedCandidateConfidence: v.optional(v.number()),
    sources: v.array(aiResponseSourceValidator),
    confidence: v.number(),
    handedOff: v.boolean(),
    handoffReason: v.optional(v.string()),
    generationTimeMs: v.number(),
    tokensUsed: v.optional(v.number()),
    model: v.string(),
    provider: v.string(),
  },
  handler: async (ctx, args) => {
    await requireConversationAccess(ctx, {
      conversationId: args.conversationId,
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
    });

    const responseId = await ctx.db.insert("aiResponses", {
      conversationId: args.conversationId,
      messageId: args.messageId,
      query: args.query,
      response: args.response,
      generatedCandidateResponse: args.generatedCandidateResponse,
      generatedCandidateSources: args.generatedCandidateSources,
      generatedCandidateConfidence: args.generatedCandidateConfidence,
      sources: args.sources,
      confidence: args.confidence,
      handedOff: args.handedOff,
      handoffReason: args.handoffReason,
      generationTimeMs: args.generationTimeMs,
      tokensUsed: args.tokensUsed,
      model: args.model,
      provider: args.provider,
      createdAt: Date.now(),
    });

    await ctx.db.patch(args.conversationId, {
      aiWorkflowState: args.handedOff ? "handoff" : "ai_handled",
      aiHandoffReason: args.handedOff ? args.handoffReason : undefined,
      aiLastConfidence: args.confidence,
      aiLastResponseAt: Date.now(),
      updatedAt: Date.now(),
    });

    return responseId;
  },
});

// Submit feedback for an AI response
export const submitFeedback = mutation({
  args: {
    responseId: v.id("aiResponses"),
    feedback: v.union(v.literal("helpful"), v.literal("not_helpful")),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const response = await ctx.db.get(args.responseId);
    if (!response) {
      throw new Error("AI response not found");
    }

    await requireConversationAccess(ctx, {
      conversationId: response.conversationId,
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
    });

    await ctx.db.patch(args.responseId, { feedback: args.feedback });
  },
});

// Get AI responses for a conversation
export const getConversationResponses = query({
  args: {
    conversationId: v.id("conversations"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireConversationAccess(ctx, {
      conversationId: args.conversationId,
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
    });

    const responses = await ctx.db
      .query("aiResponses")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    return responses.map((response) => ({
      ...response,
      deliveredResponseContext: {
        response: response.response,
        sources: response.sources,
        confidence: response.handedOff ? null : response.confidence,
      },
      generatedResponseContext:
        response.generatedCandidateResponse === undefined
          ? null
          : {
              response: response.generatedCandidateResponse,
              sources: response.generatedCandidateSources ?? [],
              confidence: response.generatedCandidateConfidence ?? response.confidence,
            },
    }));
  },
});

export const authorizeConversationAccess = internalQuery({
  args: {
    conversationId: v.id("conversations"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const conversation = await requireConversationAccess(ctx, {
      conversationId: args.conversationId,
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
    });

    const hasHumanAgentResponse = (
      await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
        .collect()
    ).some((message) => message.senderType === "agent" || message.senderType === "user");

    return {
      conversationId: conversation._id,
      workspaceId: conversation.workspaceId,
      visitorId: conversation.visitorId,
      aiWorkflowState: conversation.aiWorkflowState ?? "none",
      hasHumanAgentResponse,
    };
  },
});

// Handoff to human agent
export const handoffToHuman = mutation({
  args: {
    conversationId: v.id("conversations"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ messageId: Id<"messages">; handoffMessage: string }> => {
    const conversation = await requireConversationAccess(ctx, {
      conversationId: args.conversationId,
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
    });

    // Get AI settings for handoff message
    const settings = await getWorkspaceAISettings(ctx, conversation.workspaceId);

    const handoffMessage =
      settings?.handoffMessage ?? "Let me connect you with a human agent who can help you better.";

    const now = Date.now();

    const messageId: Id<"messages"> = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: "ai-agent",
      content: handoffMessage,
      senderType: "bot",
      createdAt: now,
    });

    // Update conversation to ensure it's open and visible to agents
    await ctx.db.patch(args.conversationId, {
      status: "open",
      updatedAt: now,
      lastMessageAt: now,
      // Preserve existing visitor-unread count while ensuring handoff-only threads surface to agents.
      unreadByAgent: Math.max(conversation.unreadByAgent || 0, 1),
      aiWorkflowState: "handoff",
      aiHandoffReason: args.reason,
      aiLastResponseAt: now,
    });

    const runAfter = getShallowRunAfter(ctx);
    await runAfter(0, routeEventRef, {
      eventType: "chat_message",
      domain: "chat",
      audience: "agent",
      workspaceId: conversation.workspaceId,
      actorType: "bot",
      conversationId: args.conversationId,
      title: "AI handoff",
      body: handoffMessage,
      data: {
        conversationId: args.conversationId,
        type: "ai_handoff",
      },
      eventKey: `chat_handoff:${messageId}`,
    });

    return { messageId, handoffMessage };
  },
});

// Check if AI Agent should respond
export const shouldRespond = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const settings = await getWorkspaceAISettings(ctx, args.workspaceId);

    if (!settings?.enabled) {
      return { shouldRespond: false, reason: "AI Agent is disabled" };
    }

    // Check working hours if configured
    if (settings.workingHours) {
      const now = new Date();
      // Simple check - in production, use proper timezone handling
      const currentHour = now.getHours();
      const [startHour] = settings.workingHours.start.split(":").map(Number);
      const [endHour] = settings.workingHours.end.split(":").map(Number);

      if (currentHour < startHour || currentHour >= endHour) {
        return { shouldRespond: false, reason: "Outside working hours" };
      }
    }

    return { shouldRespond: true, reason: null };
  },
});

// Get AI Agent analytics
export const getAnalytics = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  permission: "settings.workspace",
  handler: async (ctx, args) => {
    const startDate = args.startDate ?? Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago
    const endDate = args.endDate ?? Date.now();

    // Get all conversations for this workspace
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    // Track conversation IDs for filtering
    void conversations.map((c) => c._id);

    // Get all AI responses
    const allResponses: Array<{
      _id: Id<"aiResponses">;
      conversationId: Id<"conversations">;
      confidence: number;
      feedback?: "helpful" | "not_helpful";
      handedOff: boolean;
      generationTimeMs: number;
      tokensUsed?: number;
      createdAt: number;
    }> = [];

    for (const conv of conversations) {
      const responses = await ctx.db
        .query("aiResponses")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
        .collect();
      allResponses.push(...responses);
    }

    // Filter by date range
    const responses = allResponses.filter(
      (r) => r.createdAt >= startDate && r.createdAt <= endDate
    );

    // Calculate metrics
    const totalResponses = responses.length;
    const handedOff = responses.filter((r) => r.handedOff).length;
    const resolvedByAI = totalResponses - handedOff;
    const helpfulFeedback = responses.filter((r) => r.feedback === "helpful").length;
    const notHelpfulFeedback = responses.filter((r) => r.feedback === "not_helpful").length;
    const totalFeedback = helpfulFeedback + notHelpfulFeedback;

    const avgResponseTime =
      responses.length > 0
        ? responses.reduce((sum, r) => sum + r.generationTimeMs, 0) / responses.length
        : 0;

    const avgConfidence =
      responses.length > 0
        ? responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length
        : 0;

    return {
      totalResponses,
      resolvedByAI,
      handedOff,
      handoffRate: totalResponses > 0 ? handedOff / totalResponses : 0,
      resolutionRate: totalResponses > 0 ? resolvedByAI / totalResponses : 0,
      helpfulFeedback,
      notHelpfulFeedback,
      satisfactionRate: totalFeedback > 0 ? helpfulFeedback / totalFeedback : 0,
      avgResponseTimeMs: avgResponseTime,
      avgConfidence,
    };
  },
});

// List available AI models (from AI Gateway)
export const listAvailableModels = query({
  args: {},
  handler: async () => {
    // Return a static list of supported models
    // In production, this could query the AI Gateway API
    return [
      { id: "openai/gpt-5-nano", name: "GPT-5.1 Mini", provider: "openai" },
      // { id: "openai/gpt-5.1", name: "GPT-5.1", provider: "openai" },
      // { id: "anthropic/claude-3-haiku-20240307", name: "Claude 3 Haiku", provider: "anthropic" },
      // {
      //   id: "anthropic/claude-3-5-sonnet-20241022",
      //   name: "Claude 3.5 Sonnet",
      //   provider: "anthropic",
      // },
    ];
  },
});
