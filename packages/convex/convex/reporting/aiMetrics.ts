import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  DEFAULT_AI_RESPONSES_PER_CONVERSATION_LIMIT,
  DEFAULT_GAPS_LIMIT,
  DEFAULT_REPORTING_SCAN_LIMIT,
  MAX_AI_RESPONSES_PER_CONVERSATION_LIMIT,
  MAX_GAPS_LIMIT,
  MAX_REPORTING_SCAN_LIMIT,
  clampLimit,
  getPeriodKey,
  requireReportingReadAccess,
} from "./helpers";

export const getAiAgentMetrics = query({
  args: {
    workspaceId: v.id("workspaces"),
    startDate: v.number(),
    endDate: v.number(),
    granularity: v.optional(v.union(v.literal("day"), v.literal("week"), v.literal("month"))),
    conversationScanLimit: v.optional(v.number()),
    responsesPerConversationLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireReportingReadAccess(ctx, args.workspaceId);
    const granularity = args.granularity ?? "day";
    const conversationScanLimit = clampLimit(
      args.conversationScanLimit,
      DEFAULT_REPORTING_SCAN_LIMIT,
      MAX_REPORTING_SCAN_LIMIT
    );
    const responsesPerConversationLimit = clampLimit(
      args.responsesPerConversationLimit,
      DEFAULT_AI_RESPONSES_PER_CONVERSATION_LIMIT,
      MAX_AI_RESPONSES_PER_CONVERSATION_LIMIT
    );

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(conversationScanLimit);
    const conversationsTruncated = conversations.length >= conversationScanLimit;
    let responsesTruncated = false;

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

    for (const conversation of conversations) {
      const responses = await ctx.db
        .query("aiResponses")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
        .order("desc")
        .take(responsesPerConversationLimit);
      if (responses.length >= responsesPerConversationLimit) {
        responsesTruncated = true;
      }
      allResponses.push(...responses);
    }

    const filtered = allResponses.filter(
      (response) => response.createdAt >= args.startDate && response.createdAt <= args.endDate
    );

    if (filtered.length === 0) {
      return {
        totalResponses: 0,
        resolvedByAI: 0,
        handedOff: 0,
        resolutionRate: 0,
        handoffRate: 0,
        avgResponseTimeMs: 0,
        avgConfidence: 0,
        satisfactionRate: 0,
        totalTokensUsed: 0,
        trendByPeriod: [],
        truncated: conversationsTruncated || responsesTruncated,
      };
    }

    const totalResponses = filtered.length;
    const handedOff = filtered.filter((response) => response.handedOff).length;
    const resolvedByAI = totalResponses - handedOff;
    const helpfulFeedback = filtered.filter((response) => response.feedback === "helpful").length;
    const notHelpfulFeedback = filtered.filter((response) => response.feedback === "not_helpful").length;
    const totalFeedback = helpfulFeedback + notHelpfulFeedback;

    const avgResponseTime =
      filtered.reduce((sum, response) => sum + response.generationTimeMs, 0) / filtered.length;
    const avgConfidence =
      filtered.reduce((sum, response) => sum + response.confidence, 0) / filtered.length;
    const totalTokensUsed =
      filtered.reduce((sum, response) => sum + (response.tokensUsed ?? 0), 0);

    const byPeriod: Record<
      string,
      { total: number; handedOff: number; helpful: number; feedbackCount: number }
    > = {};
    for (const response of filtered) {
      const key = getPeriodKey(response.createdAt, granularity);
      if (!byPeriod[key]) {
        byPeriod[key] = { total: 0, handedOff: 0, helpful: 0, feedbackCount: 0 };
      }
      byPeriod[key].total++;
      if (response.handedOff) {
        byPeriod[key].handedOff++;
      }
      if (response.feedback === "helpful") {
        byPeriod[key].helpful++;
      }
      if (response.feedback) {
        byPeriod[key].feedbackCount++;
      }
    }

    const trendByPeriod = Object.entries(byPeriod)
      .map(([period, data]) => ({
        period,
        totalResponses: data.total,
        resolutionRate: data.total > 0 ? (data.total - data.handedOff) / data.total : 0,
        satisfactionRate: data.feedbackCount > 0 ? data.helpful / data.feedbackCount : 0,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return {
      totalResponses,
      resolvedByAI,
      handedOff,
      resolutionRate: totalResponses > 0 ? resolvedByAI / totalResponses : 0,
      handoffRate: totalResponses > 0 ? handedOff / totalResponses : 0,
      avgResponseTimeMs: avgResponseTime,
      avgConfidence,
      satisfactionRate: totalFeedback > 0 ? helpfulFeedback / totalFeedback : 0,
      totalTokensUsed,
      trendByPeriod,
      truncated: conversationsTruncated || responsesTruncated,
    };
  },
});

export const getAiVsHumanComparison = query({
  args: {
    workspaceId: v.id("workspaces"),
    startDate: v.number(),
    endDate: v.number(),
    conversationScanLimit: v.optional(v.number()),
    csatScanLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireReportingReadAccess(ctx, args.workspaceId);
    const conversationScanLimit = clampLimit(
      args.conversationScanLimit,
      DEFAULT_REPORTING_SCAN_LIMIT,
      MAX_REPORTING_SCAN_LIMIT
    );
    const csatScanLimit = clampLimit(
      args.csatScanLimit,
      DEFAULT_REPORTING_SCAN_LIMIT,
      MAX_REPORTING_SCAN_LIMIT
    );

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(conversationScanLimit);
    const conversationsTruncated = conversations.length >= conversationScanLimit;

    const filtered = conversations.filter(
      (conversation) => conversation.createdAt >= args.startDate && conversation.createdAt <= args.endDate
    );

    const aiResponsesByConversation: Record<string, boolean> = {};
    for (const conversation of filtered) {
      const response = await ctx.db
        .query("aiResponses")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
        .first();
      aiResponsesByConversation[conversation._id] = !!response;
    }

    const aiHandled = filtered.filter((conversation) => aiResponsesByConversation[conversation._id]);
    const humanOnly = filtered.filter((conversation) => !aiResponsesByConversation[conversation._id]);

    const aiResponseTimes = aiHandled
      .filter((conversation) => conversation.firstResponseAt)
      .map((conversation) => conversation.firstResponseAt! - conversation.createdAt);
    const humanResponseTimes = humanOnly
      .filter((conversation) => conversation.firstResponseAt)
      .map((conversation) => conversation.firstResponseAt! - conversation.createdAt);

    const avgAiResponseTime =
      aiResponseTimes.length > 0
        ? aiResponseTimes.reduce((a, b) => a + b, 0) / aiResponseTimes.length
        : 0;
    const avgHumanResponseTime =
      humanResponseTimes.length > 0
        ? humanResponseTimes.reduce((a, b) => a + b, 0) / humanResponseTimes.length
        : 0;

    const aiConversationIds = new Set(aiHandled.map((conversation) => conversation._id));
    const humanConversationIds = new Set(humanOnly.map((conversation) => conversation._id));

    const csatResponses = await ctx.db
      .query("csatResponses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(csatScanLimit);
    const csatTruncated = csatResponses.length >= csatScanLimit;

    const aiCsat = csatResponses.filter((response) => aiConversationIds.has(response.conversationId));
    const humanCsat = csatResponses.filter((response) => humanConversationIds.has(response.conversationId));

    const avgAiCsat = aiCsat.length > 0 ? aiCsat.reduce((a, response) => a + response.rating, 0) / aiCsat.length : 0;
    const avgHumanCsat =
      humanCsat.length > 0 ? humanCsat.reduce((a, response) => a + response.rating, 0) / humanCsat.length : 0;

    return {
      ai: {
        conversationCount: aiHandled.length,
        avgResponseTimeMs: avgAiResponseTime,
        avgCsatRating: avgAiCsat,
        csatResponseCount: aiCsat.length,
      },
      human: {
        conversationCount: humanOnly.length,
        avgResponseTimeMs: avgHumanResponseTime,
        avgCsatRating: avgHumanCsat,
        csatResponseCount: humanCsat.length,
      },
      truncated: conversationsTruncated || csatTruncated,
    };
  },
});

export const getKnowledgeGaps = query({
  args: {
    workspaceId: v.id("workspaces"),
    startDate: v.number(),
    endDate: v.number(),
    limit: v.optional(v.number()),
    conversationScanLimit: v.optional(v.number()),
    responsesPerConversationLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireReportingReadAccess(ctx, args.workspaceId);
    const limit = clampLimit(args.limit, DEFAULT_GAPS_LIMIT, MAX_GAPS_LIMIT);
    const conversationScanLimit = clampLimit(
      args.conversationScanLimit,
      DEFAULT_REPORTING_SCAN_LIMIT,
      MAX_REPORTING_SCAN_LIMIT
    );
    const responsesPerConversationLimit = clampLimit(
      args.responsesPerConversationLimit,
      DEFAULT_AI_RESPONSES_PER_CONVERSATION_LIMIT,
      MAX_AI_RESPONSES_PER_CONVERSATION_LIMIT
    );

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(conversationScanLimit);

    const queryMap: Record<string, { confidence: number; count: number }> = {};

    for (const conversation of conversations) {
      const responses = await ctx.db
        .query("aiResponses")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
        .order("desc")
        .take(responsesPerConversationLimit);

      for (const response of responses) {
        if (
          response.createdAt >= args.startDate &&
          response.createdAt <= args.endDate &&
          (response.handedOff || response.confidence < 0.5 || response.feedback === "not_helpful")
        ) {
          const normalizedQuery = response.query.toLowerCase().trim();
          if (!queryMap[normalizedQuery]) {
            queryMap[normalizedQuery] = { confidence: response.confidence, count: 0 };
          }
          queryMap[normalizedQuery].count++;
          queryMap[normalizedQuery].confidence = Math.min(
            queryMap[normalizedQuery].confidence,
            response.confidence
          );
        }
      }
    }

    return Object.entries(queryMap)
      .map(([queryText, data]) => ({ query: queryText, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  },
});
