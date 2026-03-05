import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getAuthenticatedUserFromSession } from "../auth";
import { requirePermission } from "../permissions";
import { resolveVisitorFromSession } from "../widgetSessions";
import {
  DEFAULT_REPORTING_SCAN_LIMIT,
  MAX_REPORTING_SCAN_LIMIT,
  clampLimit,
  getPeriodKey,
  requireReportingReadAccess,
} from "./helpers";

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
): Promise<void> {
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
      (response) => response.createdAt >= args.startDate && response.createdAt <= args.endDate
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

    const sum = filtered.reduce((accumulator, response) => accumulator + response.rating, 0);
    const averageRating = sum / filtered.length;

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const response of filtered) {
      distribution[response.rating] = (distribution[response.rating] || 0) + 1;
    }

    const satisfied = filtered.filter((response) => response.rating >= 4).length;
    const satisfactionRate = satisfied / filtered.length;

    const byPeriod: Record<string, { sum: number; count: number }> = {};
    for (const response of filtered) {
      const key = getPeriodKey(response.createdAt, granularity);
      if (!byPeriod[key]) {
        byPeriod[key] = { sum: 0, count: 0 };
      }
      byPeriod[key].sum += response.rating;
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
      averageRating,
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
      (response) =>
        response.createdAt >= args.startDate &&
        response.createdAt <= args.endDate &&
        response.agentId !== undefined
    );

    const agentStats: Record<string, { sum: number; count: number }> = {};
    for (const response of filtered) {
      const agentId = response.agentId!;
      if (!agentStats[agentId]) {
        agentStats[agentId] = { sum: 0, count: 0 };
      }
      agentStats[agentId].sum += response.rating;
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
