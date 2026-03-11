import { v } from "convex/values";
import { query } from "../_generated/server";
import {
  DEFAULT_AI_RESPONSES_PER_CONVERSATION_LIMIT,
  DEFAULT_REPORTING_SCAN_LIMIT,
  MAX_AI_RESPONSES_PER_CONVERSATION_LIMIT,
  MAX_REPORTING_SCAN_LIMIT,
  clampLimit,
  requireReportingReadAccess,
} from "./helpers";

export const getDashboardSummary = query({
  args: {
    workspaceId: v.id("workspaces"),
    startDate: v.number(),
    endDate: v.number(),
    conversationScanLimit: v.optional(v.number()),
    csatScanLimit: v.optional(v.number()),
    aiResponsesPerConversationLimit: v.optional(v.number()),
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
    const aiResponsesPerConversationLimit = clampLimit(
      args.aiResponsesPerConversationLimit,
      DEFAULT_AI_RESPONSES_PER_CONVERSATION_LIMIT,
      MAX_AI_RESPONSES_PER_CONVERSATION_LIMIT
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

    const totalConversations = filtered.length;
    const openConversations = filtered.filter((conversation) => conversation.status === "open").length;
    const closedConversations = filtered.filter((conversation) => conversation.status === "closed").length;

    const withResponse = filtered.filter((conversation) => conversation.firstResponseAt);
    const avgResponseTime =
      withResponse.length > 0
        ? withResponse.reduce(
            (sum, conversation) => sum + (conversation.firstResponseAt! - conversation.createdAt),
            0
          ) / withResponse.length
        : 0;

    const resolved = filtered.filter((conversation) => conversation.resolvedAt);
    const avgResolutionTime =
      resolved.length > 0
        ? resolved.reduce(
            (sum, conversation) => sum + (conversation.resolvedAt! - conversation.createdAt),
            0
          ) / resolved.length
        : 0;

    const csatResponses = await ctx.db
      .query("csatResponses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(csatScanLimit);
    const csatTruncated = csatResponses.length >= csatScanLimit;

    const csatFiltered = csatResponses.filter(
      (response) => response.createdAt >= args.startDate && response.createdAt <= args.endDate
    );

    const avgCsat =
      csatFiltered.length > 0
        ? csatFiltered.reduce((sum, response) => sum + response.rating, 0) / csatFiltered.length
        : 0;

    let aiResolutionRate = 0;
    let aiResponseCount = 0;

    let aiResponsesTruncated = false;
    for (const conversation of filtered) {
      const responses = await ctx.db
        .query("aiResponses")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
        .order("desc")
        .take(aiResponsesPerConversationLimit);
      if (responses.length >= aiResponsesPerConversationLimit) {
        aiResponsesTruncated = true;
      }

      const inRange = responses.filter(
        (response) => response.createdAt >= args.startDate && response.createdAt <= args.endDate
      );

      aiResponseCount += inRange.length;
      const resolvedCount = inRange.filter((response) => !response.handedOff).length;
      aiResolutionRate += resolvedCount;
    }

    const aiResolutionRateFinal = aiResponseCount > 0 ? aiResolutionRate / aiResponseCount : 0;

    return {
      totalConversations,
      openConversations,
      closedConversations,
      avgResponseTimeMs: avgResponseTime,
      avgResolutionTimeMs: avgResolutionTime,
      avgCsatRating: avgCsat,
      csatResponseCount: csatFiltered.length,
      aiResponseCount,
      aiResolutionRate: aiResolutionRateFinal,
      truncated: conversationsTruncated || csatTruncated || aiResponsesTruncated,
    };
  },
});
