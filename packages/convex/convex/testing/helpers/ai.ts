import { internalMutation } from "../../_generated/server";
import { v } from "convex/values";

const seedTestAIResponse = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    query: v.string(),
    response: v.string(),
    generatedCandidateResponse: v.optional(v.string()),
    generatedCandidateSources: v.optional(
      v.array(
        v.object({
          type: v.string(),
          id: v.string(),
          title: v.string(),
          articleId: v.optional(v.string()),
        })
      )
    ),
    generatedCandidateConfidence: v.optional(v.number()),
    confidence: v.optional(v.number()),
    handedOff: v.optional(v.boolean()),
    handoffReason: v.optional(v.string()),
    feedback: v.optional(v.union(v.literal("helpful"), v.literal("not_helpful"))),
    sources: v.optional(
      v.array(
        v.object({
          type: v.string(),
          id: v.string(),
          title: v.string(),
          articleId: v.optional(v.string()),
        })
      )
    ),
    model: v.optional(v.string()),
    provider: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const confidence = args.confidence ?? 0.75;
    const handedOff = args.handedOff ?? false;
    const handoffReason = handedOff
      ? (args.handoffReason ?? "AI requested human handoff")
      : undefined;

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: "ai-agent",
      senderType: "bot",
      content: args.response,
      createdAt: now,
    });

    const responseId = await ctx.db.insert("aiResponses", {
      conversationId: args.conversationId,
      messageId,
      query: args.query,
      response: args.response,
      generatedCandidateResponse: args.generatedCandidateResponse,
      generatedCandidateSources: args.generatedCandidateSources,
      generatedCandidateConfidence: args.generatedCandidateConfidence,
      sources: args.sources ?? [],
      confidence,
      feedback: args.feedback,
      handedOff,
      handoffReason,
      generationTimeMs: 120,
      tokensUsed: 96,
      model: args.model ?? "openai/gpt-5-nano",
      provider: args.provider ?? "openai",
      createdAt: now,
    });

    await ctx.db.patch(args.conversationId, {
      status: "open",
      updatedAt: now,
      lastMessageAt: now,
      aiWorkflowState: handedOff ? "handoff" : "ai_handled",
      aiHandoffReason: handoffReason,
      aiLastConfidence: confidence,
      aiLastResponseAt: now,
    });

    return { responseId, messageId };
  },
});

/**
 * Gets a workspace with full data directly (bypasses auth-limited fields).
 */
const getTestAISettings = internalMutation({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("aiAgentSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (!settings) {
      return {
        enabled: false,
        knowledgeSources: ["articles"],
        confidenceThreshold: 0.6,
        personality: null,
        handoffMessage: "Let me connect you with a human agent who can help you better.",
        workingHours: null,
        model: "openai/gpt-5-nano",
        suggestionsEnabled: false,
        embeddingModel: "text-embedding-3-small",
      };
    }

    return {
      ...settings,
      suggestionsEnabled: settings.suggestionsEnabled ?? false,
      embeddingModel: settings.embeddingModel ?? "text-embedding-3-small",
    };
  },
});

/**
 * Updates AI agent settings directly (bypasses auth).
 */
const updateTestAISettings = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    enabled: v.optional(v.boolean()),
    model: v.optional(v.string()),
    confidenceThreshold: v.optional(v.number()),
    knowledgeSources: v.optional(v.array(v.string())),
    personality: v.optional(v.string()),
    handoffMessage: v.optional(v.string()),
    suggestionsEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("aiAgentSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const { workspaceId, ...updates } = args;

    if (existing) {
      const patchData: Record<string, unknown> = { updatedAt: now };
      if (updates.enabled !== undefined) patchData.enabled = updates.enabled;
      if (updates.model !== undefined) patchData.model = updates.model;
      if (updates.confidenceThreshold !== undefined)
        patchData.confidenceThreshold = updates.confidenceThreshold;
      if (updates.knowledgeSources !== undefined)
        patchData.knowledgeSources = updates.knowledgeSources;
      if (updates.personality !== undefined) patchData.personality = updates.personality;
      if (updates.handoffMessage !== undefined) patchData.handoffMessage = updates.handoffMessage;
      if (updates.suggestionsEnabled !== undefined)
        patchData.suggestionsEnabled = updates.suggestionsEnabled;
      await ctx.db.patch(existing._id, patchData as any);
      return existing._id;
    }

    return await ctx.db.insert("aiAgentSettings", {
      workspaceId,
      enabled: args.enabled ?? false,
      knowledgeSources: (args.knowledgeSources as any) ?? ["articles"],
      confidenceThreshold: args.confidenceThreshold ?? 0.6,
      personality: args.personality,
      handoffMessage:
        args.handoffMessage ?? "Let me connect you with a human agent who can help you better.",
      model: args.model ?? "openai/gpt-5-nano",
      suggestionsEnabled: args.suggestionsEnabled ?? false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

const listTestSuggestionFeedback = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("suggestionFeedback")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
  },
});

/**
 * Gets a visitor by ID directly (bypasses auth).
 */

export const aiTestHelpers: Record<string, ReturnType<typeof internalMutation>> = {
  seedTestAIResponse,
  getTestAISettings,
  updateTestAISettings,
  listTestSuggestionFeedback,
} as const;
