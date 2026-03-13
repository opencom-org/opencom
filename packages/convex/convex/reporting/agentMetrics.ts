import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  DEFAULT_REPORTING_SCAN_LIMIT,
  MAX_REPORTING_SCAN_LIMIT,
  clampLimit,
  requireReportingReadAccess,
} from "./helpers";

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
      (conversation) =>
        conversation.createdAt >= args.startDate &&
        conversation.createdAt <= args.endDate &&
        conversation.assignedAgentId !== undefined
    );

    const agentStats: Record<
      string,
      {
        conversationsHandled: number;
        responseTimes: number[];
        resolutionTimes: number[];
        resolved: number;
      }
    > = {};

    for (const conversation of filtered) {
      const agentId = conversation.assignedAgentId!;
      if (!agentStats[agentId]) {
        agentStats[agentId] = {
          conversationsHandled: 0,
          responseTimes: [],
          resolutionTimes: [],
          resolved: 0,
        };
      }

      agentStats[agentId].conversationsHandled++;

      if (conversation.firstResponseAt) {
        agentStats[agentId].responseTimes.push(conversation.firstResponseAt - conversation.createdAt);
      }

      if (conversation.resolvedAt) {
        agentStats[agentId].resolutionTimes.push(conversation.resolvedAt - conversation.createdAt);
        agentStats[agentId].resolved++;
      }
    }

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

    for (const conversation of conversations) {
      if (conversation.assignedAgentId) {
        workload[conversation.assignedAgentId] = (workload[conversation.assignedAgentId] || 0) + 1;
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
