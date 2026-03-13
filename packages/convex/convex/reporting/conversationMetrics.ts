import { v } from "convex/values";
import { query } from "../_generated/server";
import {
  DEFAULT_REPORTING_SCAN_LIMIT,
  MAX_REPORTING_SCAN_LIMIT,
  clampLimit,
  getPeriodKey,
  requireReportingReadAccess,
} from "./helpers";

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
      (conversation) => conversation.createdAt >= args.startDate && conversation.createdAt <= args.endDate
    );

    const volumeByPeriod: Record<string, number> = {};
    for (const conversation of filtered) {
      const key = getPeriodKey(conversation.createdAt, granularity);
      volumeByPeriod[key] = (volumeByPeriod[key] || 0) + 1;
    }

    const openCount = filtered.filter((conversation) => conversation.status === "open").length;
    const closedCount = filtered.filter((conversation) => conversation.status === "closed").length;
    const snoozedCount = filtered.filter((conversation) => conversation.status === "snoozed").length;

    const chatCount = filtered.filter((conversation) => conversation.channel === "chat" || !conversation.channel).length;
    const emailCount = filtered.filter((conversation) => conversation.channel === "email").length;

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

function summarizeDurations(durations: number[]) {
  if (durations.length === 0) {
    return {
      count: 0,
      averageMs: 0,
      medianMs: 0,
      p90Ms: 0,
      p95Ms: 0,
    };
  }

  const sortedDurations = [...durations].sort((a, b) => a - b);
  const sum = sortedDurations.reduce((a, b) => a + b, 0);
  const average = sum / sortedDurations.length;
  const median = sortedDurations[Math.floor(sortedDurations.length / 2)];
  const p90 = sortedDurations[Math.floor(sortedDurations.length * 0.9)];
  const p95 = sortedDurations[Math.floor(sortedDurations.length * 0.95)];

  return {
    count: sortedDurations.length,
    averageMs: average,
    medianMs: median,
    p90Ms: p90,
    p95Ms: p95,
  };
}

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
      (conversation) =>
        conversation.createdAt >= args.startDate &&
        conversation.createdAt <= args.endDate &&
        conversation.firstResponseAt !== undefined
    );

    const responseTimes = filtered
      .map((conversation) => conversation.firstResponseAt! - conversation.createdAt)
      .filter((duration) => duration > 0);

    return {
      ...summarizeDurations(responseTimes),
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
      (conversation) =>
        conversation.createdAt >= args.startDate &&
        conversation.createdAt <= args.endDate &&
        conversation.resolvedAt !== undefined
    );

    const resolutionTimes = filtered
      .map((conversation) => conversation.resolvedAt! - conversation.createdAt)
      .filter((duration) => duration > 0);

    return {
      ...summarizeDurations(resolutionTimes),
      truncated: conversations.length >= scanLimit,
    };
  },
});
