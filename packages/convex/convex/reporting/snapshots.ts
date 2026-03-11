import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { jsonRecordValidator } from "../validators";
import {
  DEFAULT_REPORTING_SCAN_LIMIT,
  MAX_REPORTING_SCAN_LIMIT,
  clampLimit,
  requireReportingReadAccess,
} from "./helpers";

const reportTypeValidator = v.union(
  v.literal("conversations"),
  v.literal("agents"),
  v.literal("csat"),
  v.literal("ai_agent")
);

export const saveReportSnapshot = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    reportType: reportTypeValidator,
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
    reportType: reportTypeValidator,
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
      (snapshot) => snapshot.periodStart === args.periodStart && snapshot.periodEnd === args.periodEnd
    );
  },
});
