import { v } from "convex/values";
import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getAuthenticatedUserFromSession } from "./auth";
import { requirePermission } from "./permissions";
import { resolveVisitorFromSession } from "./widgetSessions";
import { jsonRecordValidator } from "./validators";

async function requireReportingReadAccess(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">
) {
  const user = await getAuthenticatedUserFromSession(ctx);
  if (!user) {
    throw new Error("Not authenticated");
  }
  await requirePermission(ctx, user._id, workspaceId, "conversations.read");
}

const DEFAULT_REPORTING_SCAN_LIMIT = 5000;
const MAX_REPORTING_SCAN_LIMIT = 20000;
const DEFAULT_AI_RESPONSES_PER_CONVERSATION_LIMIT = 200;
const MAX_AI_RESPONSES_PER_CONVERSATION_LIMIT = 1000;
const DEFAULT_GAPS_LIMIT = 20;
const MAX_GAPS_LIMIT = 100;

function clampLimit(limit: number | undefined, defaultValue: number, maxValue: number): number {
  const normalized = limit ?? defaultValue;
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return defaultValue;
  }
  return Math.min(Math.floor(normalized), maxValue);
}

// ============================================================================
// Conversation Metrics
// ============================================================================

export const getConversationMetrics = query({
  args: {
    workspaceId: v.id("workspaces"),
    startDate: v.number(),
    endDate: v.number(),
    granularity: v.optional(v.union(v.literal("day"), v.literal("week"), v.literal("month"))),
    scanLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireReportingReadAccess(ctx, args.workspaceId);
    const granularity = args.granularity ?? "day";
    const scanLimit = clampLimit(
      args.scanLimit,
      DEFAULT_REPORTING_SCAN_LIMIT,
      MAX_REPORTING_SCAN_LIMIT
    );

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(scanLimit);

    const filtered = conversations.filter(
      (c) => c.createdAt >= args.startDate && c.createdAt <= args.endDate
    );

    // Group by time period
    const volumeByPeriod: Record<string, number> = {};
    const getKey = (timestamp: number): string => {
      const date = new Date(timestamp);
      if (granularity === "day") {
        return date.toISOString().split("T")[0];
      } else if (granularity === "week") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().split("T")[0];
      } else {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      }
    };

    for (const conv of filtered) {
      const key = getKey(conv.createdAt);
      volumeByPeriod[key] = (volumeByPeriod[key] || 0) + 1;
    }

    // Calculate state counts
    const openCount = filtered.filter((c) => c.status === "open").length;
    const closedCount = filtered.filter((c) => c.status === "closed").length;
    const snoozedCount = filtered.filter((c) => c.status === "snoozed").length;

    // Calculate channel breakdown
    const chatCount = filtered.filter((c) => c.channel === "chat" || !c.channel).length;
    const emailCount = filtered.filter((c) => c.channel === "email").length;

    return {
      total: filtered.length,
      volumeByPeriod: Object.entries(volumeByPeriod)
        .map(([period, count]) => ({ period, count }))
        .sort((a, b) => a.period.localeCompare(b.period)),
      byStatus: {
        open: openCount,
        closed: closedCount,
        snoozed: snoozedCount,
      },
      byChannel: {
        chat: chatCount,
        email: emailCount,
      },
      truncated: conversations.length >= scanLimit,
    };
  },
});

export const getResponseTimeMetrics = query({
  args: {
    workspaceId: v.id("workspaces"),
    startDate: v.number(),
    endDate: v.number(),
    scanLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireReportingReadAccess(ctx, args.workspaceId);
    const scanLimit = clampLimit(
      args.scanLimit,
      DEFAULT_REPORTING_SCAN_LIMIT,
      MAX_REPORTING_SCAN_LIMIT
    );
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(scanLimit);

    const filtered = conversations.filter(
      (c) =>
        c.createdAt >= args.startDate &&
        c.createdAt <= args.endDate &&
        c.firstResponseAt !== undefined
    );

    if (filtered.length === 0) {
      return {
        count: 0,
        averageMs: 0,
        medianMs: 0,
        p90Ms: 0,
        p95Ms: 0,
        truncated: conversations.length >= scanLimit,
      };
    }

    const responseTimes = filtered
      .map((c) => c.firstResponseAt! - c.createdAt)
      .filter((t) => t > 0)
      .sort((a, b) => a - b);

    if (responseTimes.length === 0) {
      return {
        count: 0,
        averageMs: 0,
        medianMs: 0,
        p90Ms: 0,
        p95Ms: 0,
        truncated: conversations.length >= scanLimit,
      };
    }

    const sum = responseTimes.reduce((a, b) => a + b, 0);
    const avg = sum / responseTimes.length;
    const median = responseTimes[Math.floor(responseTimes.length / 2)];
    const p90 = responseTimes[Math.floor(responseTimes.length * 0.9)];
    const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];

    return {
      count: responseTimes.length,
      averageMs: avg,
      medianMs: median,
      p90Ms: p90,
      p95Ms: p95,
      truncated: conversations.length >= scanLimit,
    };
  },
});

export const getResolutionTimeMetrics = query({
  args: {
    workspaceId: v.id("workspaces"),
    startDate: v.number(),
    endDate: v.number(),
    scanLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireReportingReadAccess(ctx, args.workspaceId);
    const scanLimit = clampLimit(
      args.scanLimit,
      DEFAULT_REPORTING_SCAN_LIMIT,
      MAX_REPORTING_SCAN_LIMIT
    );
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(scanLimit);

    const filtered = conversations.filter(
      (c) =>
        c.createdAt >= args.startDate && c.createdAt <= args.endDate && c.resolvedAt !== undefined
    );

    if (filtered.length === 0) {
      return {
        count: 0,
        averageMs: 0,
        medianMs: 0,
        p90Ms: 0,
        p95Ms: 0,
        truncated: conversations.length >= scanLimit,
      };
    }

    const resolutionTimes = filtered
      .map((c) => c.resolvedAt! - c.createdAt)
      .filter((t) => t > 0)
      .sort((a, b) => a - b);

    if (resolutionTimes.length === 0) {
      return {
        count: 0,
        averageMs: 0,
        medianMs: 0,
        p90Ms: 0,
        p95Ms: 0,
        truncated: conversations.length >= scanLimit,
      };
    }

    const sum = resolutionTimes.reduce((a, b) => a + b, 0);
    const avg = sum / resolutionTimes.length;
    const median = resolutionTimes[Math.floor(resolutionTimes.length / 2)];
    const p90 = resolutionTimes[Math.floor(resolutionTimes.length * 0.9)];
    const p95 = resolutionTimes[Math.floor(resolutionTimes.length * 0.95)];

    return {
      count: resolutionTimes.length,
      averageMs: avg,
      medianMs: median,
      p90Ms: p90,
      p95Ms: p95,
      truncated: conversations.length >= scanLimit,
    };
  },
});

// ============================================================================
// Team Performance / Agent Metrics
// ============================================================================

export const getAgentMetrics = query({
  args: {
    workspaceId: v.id("workspaces"),
    startDate: v.number(),
    endDate: v.number(),
    scanLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireReportingReadAccess(ctx, args.workspaceId);
    const scanLimit = clampLimit(
      args.scanLimit,
      DEFAULT_REPORTING_SCAN_LIMIT,
      MAX_REPORTING_SCAN_LIMIT
    );
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(scanLimit);

    const filtered = conversations.filter(
      (c) =>
        c.createdAt >= args.startDate &&
        c.createdAt <= args.endDate &&
        c.assignedAgentId !== undefined
    );

    // Group by agent
    const agentStats: Record<
      string,
      {
        conversationsHandled: number;
        responseTimes: number[];
        resolutionTimes: number[];
        resolved: number;
      }
    > = {};

    for (const conv of filtered) {
      const agentId = conv.assignedAgentId!;
      if (!agentStats[agentId]) {
        agentStats[agentId] = {
          conversationsHandled: 0,
          responseTimes: [],
          resolutionTimes: [],
          resolved: 0,
        };
      }

      agentStats[agentId].conversationsHandled++;

      if (conv.firstResponseAt) {
        agentStats[agentId].responseTimes.push(conv.firstResponseAt - conv.createdAt);
      }

      if (conv.resolvedAt) {
        agentStats[agentId].resolutionTimes.push(conv.resolvedAt - conv.createdAt);
        agentStats[agentId].resolved++;
      }
    }

    // Get agent details
    const agentMetrics = await Promise.all(
      Object.entries(agentStats).map(async ([agentId, stats]) => {
        const agent = (await ctx.db.get(agentId as Id<"users">)) as Doc<"users"> | null;
        const avgResponseTime =
          stats.responseTimes.length > 0
            ? stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length
            : 0;
        const avgResolutionTime =
          stats.resolutionTimes.length > 0
            ? stats.resolutionTimes.reduce((a, b) => a + b, 0) / stats.resolutionTimes.length
            : 0;

        return {
          agentId,
          agentName: agent?.name ?? agent?.email ?? "Unknown",
          conversationsHandled: stats.conversationsHandled,
          resolved: stats.resolved,
          avgResponseTimeMs: avgResponseTime,
          avgResolutionTimeMs: avgResolutionTime,
        };
      })
    );

    return agentMetrics.sort((a, b) => b.conversationsHandled - a.conversationsHandled);
  },
});

export const getAgentWorkloadDistribution = query({
  args: {
    workspaceId: v.id("workspaces"),
    scanLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireReportingReadAccess(ctx, args.workspaceId);
    const scanLimit = clampLimit(
      args.scanLimit,
      DEFAULT_REPORTING_SCAN_LIMIT,
      MAX_REPORTING_SCAN_LIMIT
    );
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_status", (q) => q.eq("workspaceId", args.workspaceId).eq("status", "open"))
      .order("desc")
      .take(scanLimit);

    const workload: Record<string, number> = {};
    let unassigned = 0;

    for (const conv of conversations) {
      if (conv.assignedAgentId) {
        workload[conv.assignedAgentId] = (workload[conv.assignedAgentId] || 0) + 1;
      } else {
        unassigned++;
      }
    }

    const distribution = await Promise.all(
      Object.entries(workload).map(async ([agentId, count]) => {
        const agent = (await ctx.db.get(agentId as Id<"users">)) as Doc<"users"> | null;
        return {
          agentId,
          agentName: agent?.name ?? agent?.email ?? "Unknown",
          openConversations: count,
        };
      })
    );

    return {
      distribution: distribution.sort((a, b) => b.openConversations - a.openConversations),
      unassigned,
      total: conversations.length,
      truncated: conversations.length >= scanLimit,
    };
  },
});

// ============================================================================
// CSAT Tracking
// ============================================================================

type CsatAccessArgs = {
  visitorId?: Id<"visitors">;
  sessionToken?: string;
};

type CsatEligibilityReason =
  | "eligible"
  | "conversation_not_closed"
  | "disabled"
  | "already_submitted";

async function requireCsatAccess(
  ctx: QueryCtx | MutationCtx,
  conversation: Doc<"conversations">,
  args: CsatAccessArgs
) {
  const authUser = await getAuthenticatedUserFromSession(ctx);
  if (authUser) {
    await requirePermission(ctx, authUser._id, conversation.workspaceId, "conversations.read");
    return;
  }

  if (!conversation.visitorId || !args.visitorId || !args.sessionToken) {
    throw new Error("Not authorized to submit CSAT response");
  }
  if (conversation.visitorId !== args.visitorId) {
    throw new Error("Not authorized to submit CSAT response");
  }
  const resolved = await resolveVisitorFromSession(ctx, {
    sessionToken: args.sessionToken,
    workspaceId: conversation.workspaceId,
  });
  if (resolved.visitorId !== args.visitorId) {
    throw new Error("Not authorized to submit CSAT response");
  }
}

async function getWorkspaceCsatEnabled(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">
): Promise<boolean> {
  const settings = await ctx.db
    .query("automationSettings")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .first();
  return settings?.askForRatingEnabled ?? false;
}

async function hasConversationCsatResponse(
  ctx: QueryCtx | MutationCtx,
  conversationId: Id<"conversations">
): Promise<boolean> {
  const existing = await ctx.db
    .query("csatResponses")
    .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
    .first();
  return !!existing;
}

function evaluateConversationCsatEligibility(
  conversation: Doc<"conversations">,
  askForRatingEnabled: boolean,
  alreadySubmitted: boolean
): {
  eligible: boolean;
  reason: CsatEligibilityReason;
} {
  if (!askForRatingEnabled) {
    return { eligible: false, reason: "disabled" };
  }
  if (conversation.status !== "closed") {
    return { eligible: false, reason: "conversation_not_closed" };
  }
  if (alreadySubmitted) {
    return { eligible: false, reason: "already_submitted" };
  }
  return { eligible: true, reason: "eligible" };
}

export const getCsatEligibility = query({
  args: {
    conversationId: v.id("conversations"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const conversation = (await ctx.db.get(args.conversationId)) as Doc<"conversations"> | null;
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    await requireCsatAccess(ctx, conversation, {
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
    });

    const askForRatingEnabled = await getWorkspaceCsatEnabled(ctx, conversation.workspaceId);
    const alreadySubmitted =
      !!conversation.csatCompletedAt ||
      !!conversation.csatResponseId ||
      (await hasConversationCsatResponse(ctx, args.conversationId));
    const outcome = evaluateConversationCsatEligibility(
      conversation,
      askForRatingEnabled,
      alreadySubmitted
    );

    return {
      eligible: outcome.eligible,
      reason: outcome.reason,
      askForRatingEnabled,
      alreadySubmitted,
      conversationStatus: conversation.status,
    };
  },
});

export const submitCsatResponse = mutation({
  args: {
    conversationId: v.id("conversations"),
    rating: v.number(),
    feedback: v.optional(v.string()),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.rating < 1 || args.rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    const conversation = (await ctx.db.get(args.conversationId)) as Doc<"conversations"> | null;
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    await requireCsatAccess(ctx, conversation, {
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
    });

    const askForRatingEnabled = await getWorkspaceCsatEnabled(ctx, conversation.workspaceId);
    if (!askForRatingEnabled) {
      throw new Error("CSAT collection is disabled for this workspace");
    }
    if (conversation.status !== "closed") {
      throw new Error("CSAT can only be submitted for closed conversations");
    }

    const alreadySubmitted =
      !!conversation.csatCompletedAt ||
      !!conversation.csatResponseId ||
      (await hasConversationCsatResponse(ctx, args.conversationId));

    if (alreadySubmitted) {
      throw new Error("CSAT response already submitted for this conversation");
    }

    const now = Date.now();
    const csatId = await ctx.db.insert("csatResponses", {
      workspaceId: conversation.workspaceId,
      conversationId: args.conversationId,
      visitorId: conversation.visitorId,
      agentId: conversation.assignedAgentId,
      rating: args.rating,
      feedback: args.feedback,
      createdAt: now,
    });

    await ctx.db.patch(args.conversationId, {
      csatCompletedAt: now,
      csatResponseId: csatId,
      updatedAt: now,
    });

    return csatId;
  },
});

export const getCsatMetrics = query({
  args: {
    workspaceId: v.id("workspaces"),
    startDate: v.number(),
    endDate: v.number(),
    granularity: v.optional(v.union(v.literal("day"), v.literal("week"), v.literal("month"))),
    scanLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireReportingReadAccess(ctx, args.workspaceId);
    const granularity = args.granularity ?? "day";
    const scanLimit = clampLimit(
      args.scanLimit,
      DEFAULT_REPORTING_SCAN_LIMIT,
      MAX_REPORTING_SCAN_LIMIT
    );

    const responses = await ctx.db
      .query("csatResponses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(scanLimit);

    const filtered = responses.filter(
      (r) => r.createdAt >= args.startDate && r.createdAt <= args.endDate
    );

    if (filtered.length === 0) {
      return {
        totalResponses: 0,
        averageRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        satisfactionRate: 0,
        trendByPeriod: [],
        truncated: responses.length >= scanLimit,
      };
    }

    // Calculate average
    const sum = filtered.reduce((a, r) => a + r.rating, 0);
    const avg = sum / filtered.length;

    // Rating distribution
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of filtered) {
      distribution[r.rating] = (distribution[r.rating] || 0) + 1;
    }

    // Satisfaction rate (4 or 5 stars)
    const satisfied = filtered.filter((r) => r.rating >= 4).length;
    const satisfactionRate = satisfied / filtered.length;

    // Trend by period
    const getKey = (timestamp: number): string => {
      const date = new Date(timestamp);
      if (granularity === "day") {
        return date.toISOString().split("T")[0];
      } else if (granularity === "week") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().split("T")[0];
      } else {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      }
    };

    const byPeriod: Record<string, { sum: number; count: number }> = {};
    for (const r of filtered) {
      const key = getKey(r.createdAt);
      if (!byPeriod[key]) {
        byPeriod[key] = { sum: 0, count: 0 };
      }
      byPeriod[key].sum += r.rating;
      byPeriod[key].count++;
    }

    const trendByPeriod = Object.entries(byPeriod)
      .map(([period, data]) => ({
        period,
        averageRating: data.sum / data.count,
        count: data.count,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return {
      totalResponses: filtered.length,
      averageRating: avg,
      ratingDistribution: distribution,
      satisfactionRate,
      trendByPeriod,
      truncated: responses.length >= scanLimit,
    };
  },
});

export const getCsatByAgent = query({
  args: {
    workspaceId: v.id("workspaces"),
    startDate: v.number(),
    endDate: v.number(),
    scanLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireReportingReadAccess(ctx, args.workspaceId);
    const scanLimit = clampLimit(
      args.scanLimit,
      DEFAULT_REPORTING_SCAN_LIMIT,
      MAX_REPORTING_SCAN_LIMIT
    );
    const responses = await ctx.db
      .query("csatResponses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(scanLimit);

    const filtered = responses.filter(
      (r) => r.createdAt >= args.startDate && r.createdAt <= args.endDate && r.agentId !== undefined
    );

    // Group by agent
    const agentStats: Record<string, { sum: number; count: number }> = {};
    for (const r of filtered) {
      const agentId = r.agentId!;
      if (!agentStats[agentId]) {
        agentStats[agentId] = { sum: 0, count: 0 };
      }
      agentStats[agentId].sum += r.rating;
      agentStats[agentId].count++;
    }

    const agentCsat = await Promise.all(
      Object.entries(agentStats).map(async ([agentId, stats]) => {
        const agent = (await ctx.db.get(agentId as Id<"users">)) as Doc<"users"> | null;
        return {
          agentId,
          agentName: agent?.name ?? agent?.email ?? "Unknown",
          averageRating: stats.sum / stats.count,
          totalResponses: stats.count,
        };
      })
    );

    return agentCsat.sort((a, b) => b.averageRating - a.averageRating);
  },
});

// ============================================================================
// AI Agent Metrics Integration
// ============================================================================

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

    // Get all conversations for this workspace
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(conversationScanLimit);
    const conversationsTruncated = conversations.length >= conversationScanLimit;
    let responsesTruncated = false;

    // Note: conversationIds set built but filtering happens via loop below

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
        .order("desc")
        .take(responsesPerConversationLimit);
      if (responses.length >= responsesPerConversationLimit) {
        responsesTruncated = true;
      }
      allResponses.push(...responses);
    }

    // Filter by date range
    const filtered = allResponses.filter(
      (r) => r.createdAt >= args.startDate && r.createdAt <= args.endDate
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

    // Calculate metrics
    const totalResponses = filtered.length;
    const handedOff = filtered.filter((r) => r.handedOff).length;
    const resolvedByAI = totalResponses - handedOff;
    const helpfulFeedback = filtered.filter((r) => r.feedback === "helpful").length;
    const notHelpfulFeedback = filtered.filter((r) => r.feedback === "not_helpful").length;
    const totalFeedback = helpfulFeedback + notHelpfulFeedback;

    const avgResponseTime =
      filtered.reduce((sum, r) => sum + r.generationTimeMs, 0) / filtered.length;
    const avgConfidence = filtered.reduce((sum, r) => sum + r.confidence, 0) / filtered.length;
    const totalTokensUsed = filtered.reduce((sum, r) => sum + (r.tokensUsed ?? 0), 0);

    // Trend by period
    const getKey = (timestamp: number): string => {
      const date = new Date(timestamp);
      if (granularity === "day") {
        return date.toISOString().split("T")[0];
      } else if (granularity === "week") {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().split("T")[0];
      } else {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      }
    };

    const byPeriod: Record<
      string,
      { total: number; handedOff: number; helpful: number; feedbackCount: number }
    > = {};
    for (const r of filtered) {
      const key = getKey(r.createdAt);
      if (!byPeriod[key]) {
        byPeriod[key] = { total: 0, handedOff: 0, helpful: 0, feedbackCount: 0 };
      }
      byPeriod[key].total++;
      if (r.handedOff) byPeriod[key].handedOff++;
      if (r.feedback === "helpful") byPeriod[key].helpful++;
      if (r.feedback) byPeriod[key].feedbackCount++;
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
    // Get conversations
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(conversationScanLimit);
    const conversationsTruncated = conversations.length >= conversationScanLimit;

    const filtered = conversations.filter(
      (c) => c.createdAt >= args.startDate && c.createdAt <= args.endDate
    );

    // Get AI responses for these conversations
    const aiResponsesByConv: Record<string, boolean> = {};
    for (const conv of filtered) {
      const responses = await ctx.db
        .query("aiResponses")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
        .first();
      aiResponsesByConv[conv._id] = !!responses;
    }

    // Separate AI-handled vs human-only conversations
    const aiHandled = filtered.filter((c) => aiResponsesByConv[c._id]);
    const humanOnly = filtered.filter((c) => !aiResponsesByConv[c._id]);

    // Calculate response times
    const aiResponseTimes = aiHandled
      .filter((c) => c.firstResponseAt)
      .map((c) => c.firstResponseAt! - c.createdAt);
    const humanResponseTimes = humanOnly
      .filter((c) => c.firstResponseAt)
      .map((c) => c.firstResponseAt! - c.createdAt);

    const avgAiResponseTime =
      aiResponseTimes.length > 0
        ? aiResponseTimes.reduce((a, b) => a + b, 0) / aiResponseTimes.length
        : 0;
    const avgHumanResponseTime =
      humanResponseTimes.length > 0
        ? humanResponseTimes.reduce((a, b) => a + b, 0) / humanResponseTimes.length
        : 0;

    // Get CSAT for each group
    const aiConvIds = new Set(aiHandled.map((c) => c._id));
    const humanConvIds = new Set(humanOnly.map((c) => c._id));

    const csatResponses = await ctx.db
      .query("csatResponses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(csatScanLimit);
    const csatTruncated = csatResponses.length >= csatScanLimit;

    const aiCsat = csatResponses.filter((r) => aiConvIds.has(r.conversationId));
    const humanCsat = csatResponses.filter((r) => humanConvIds.has(r.conversationId));

    const avgAiCsat =
      aiCsat.length > 0 ? aiCsat.reduce((a, r) => a + r.rating, 0) / aiCsat.length : 0;
    const avgHumanCsat =
      humanCsat.length > 0 ? humanCsat.reduce((a, r) => a + r.rating, 0) / humanCsat.length : 0;

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

    // Get conversations for this workspace
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(conversationScanLimit);

    // Get AI responses that resulted in handoff (low confidence or explicit handoff)
    const queryMap: Record<string, { confidence: number; count: number }> = {};

    for (const conv of conversations) {
      const responses = await ctx.db
        .query("aiResponses")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
        .order("desc")
        .take(responsesPerConversationLimit);

      for (const r of responses) {
        if (
          r.createdAt >= args.startDate &&
          r.createdAt <= args.endDate &&
          (r.handedOff || r.confidence < 0.5 || r.feedback === "not_helpful")
        ) {
          const normalizedQuery = r.query.toLowerCase().trim();
          if (!queryMap[normalizedQuery]) {
            queryMap[normalizedQuery] = { confidence: r.confidence, count: 0 };
          }
          queryMap[normalizedQuery].count++;
          queryMap[normalizedQuery].confidence = Math.min(
            queryMap[normalizedQuery].confidence,
            r.confidence
          );
        }
      }
    }

    return Object.entries(queryMap)
      .map(([query, data]) => ({ query, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  },
});

// ============================================================================
// Report Snapshots (Caching)
// ============================================================================

export const saveReportSnapshot = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    reportType: v.union(
      v.literal("conversations"),
      v.literal("agents"),
      v.literal("csat"),
      v.literal("ai_agent")
    ),
    periodStart: v.number(),
    periodEnd: v.number(),
    granularity: v.union(v.literal("day"), v.literal("week"), v.literal("month")),
    metrics: jsonRecordValidator,
  },
  handler: async (ctx, args) => {
    await requireReportingReadAccess(ctx, args.workspaceId);
    return await ctx.db.insert("reportSnapshots", {
      workspaceId: args.workspaceId,
      reportType: args.reportType,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      granularity: args.granularity,
      metrics: args.metrics,
      createdAt: Date.now(),
    });
  },
});

export const getReportSnapshot = query({
  args: {
    workspaceId: v.id("workspaces"),
    reportType: v.union(
      v.literal("conversations"),
      v.literal("agents"),
      v.literal("csat"),
      v.literal("ai_agent")
    ),
    periodStart: v.number(),
    periodEnd: v.number(),
    scanLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireReportingReadAccess(ctx, args.workspaceId);
    const scanLimit = clampLimit(
      args.scanLimit,
      DEFAULT_REPORTING_SCAN_LIMIT,
      MAX_REPORTING_SCAN_LIMIT
    );
    const snapshots = await ctx.db
      .query("reportSnapshots")
      .withIndex("by_workspace_type", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("reportType", args.reportType)
      )
      .order("desc")
      .take(scanLimit);

    return snapshots.find(
      (s) => s.periodStart === args.periodStart && s.periodEnd === args.periodEnd
    );
  },
});

// ============================================================================
// Dashboard Summary
// ============================================================================

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
    // Get conversations
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(conversationScanLimit);
    const conversationsTruncated = conversations.length >= conversationScanLimit;

    const filtered = conversations.filter(
      (c) => c.createdAt >= args.startDate && c.createdAt <= args.endDate
    );

    // Basic counts
    const totalConversations = filtered.length;
    const openConversations = filtered.filter((c) => c.status === "open").length;
    const closedConversations = filtered.filter((c) => c.status === "closed").length;

    // Response time
    const withResponse = filtered.filter((c) => c.firstResponseAt);
    const avgResponseTime =
      withResponse.length > 0
        ? withResponse.reduce((sum, c) => sum + (c.firstResponseAt! - c.createdAt), 0) /
          withResponse.length
        : 0;

    // Resolution time
    const resolved = filtered.filter((c) => c.resolvedAt);
    const avgResolutionTime =
      resolved.length > 0
        ? resolved.reduce((sum, c) => sum + (c.resolvedAt! - c.createdAt), 0) / resolved.length
        : 0;

    // CSAT
    const csatResponses = await ctx.db
      .query("csatResponses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(csatScanLimit);
    const csatTruncated = csatResponses.length >= csatScanLimit;

    const csatFiltered = csatResponses.filter(
      (r) => r.createdAt >= args.startDate && r.createdAt <= args.endDate
    );

    const avgCsat =
      csatFiltered.length > 0
        ? csatFiltered.reduce((sum, r) => sum + r.rating, 0) / csatFiltered.length
        : 0;

    // AI metrics
    let aiResolutionRate = 0;
    let aiResponseCount = 0;

    let aiResponsesTruncated = false;
    for (const conv of filtered) {
      const responses = await ctx.db
        .query("aiResponses")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
        .order("desc")
        .take(aiResponsesPerConversationLimit);
      if (responses.length >= aiResponsesPerConversationLimit) {
        aiResponsesTruncated = true;
      }

      const inRange = responses.filter(
        (r) => r.createdAt >= args.startDate && r.createdAt <= args.endDate
      );

      aiResponseCount += inRange.length;
      const resolved = inRange.filter((r) => !r.handedOff).length;
      aiResolutionRate += resolved;
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
