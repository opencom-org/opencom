import { v } from "convex/values";
import { internalMutation, internalQuery, query, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  DEFAULT_GRAPH_ITEM_LIMIT,
  DEFAULT_HISTORY_LIMIT,
  DEFAULT_PROGRESS_SCAN_LIMIT,
  MAX_GRAPH_ITEM_LIMIT,
  MAX_HISTORY_LIMIT,
  MAX_PROGRESS_SCAN_LIMIT,
} from "./contracts";
import { canManageSeries, clampLimit, nowTs } from "./shared";

export async function upsertBlockTelemetry(
  ctx: MutationCtx,
  seriesId: Id<"series">,
  blockId: Id<"seriesBlocks">,
  patch: {
    entered?: number;
    completed?: number;
    skipped?: number;
    failed?: number;
    deliveryAttempts?: number;
    deliveryFailures?: number;
    yesBranchCount?: number;
    noBranchCount?: number;
    defaultBranchCount?: number;
    lastResult?: Doc<"seriesBlockTelemetry">["lastResult"];
  }
): Promise<void> {
  const existing = await ctx.db
    .query("seriesBlockTelemetry")
    .withIndex("by_series_block", (q) => q.eq("seriesId", seriesId).eq("blockId", blockId))
    .first();

  if (!existing) {
    await ctx.db.insert("seriesBlockTelemetry", {
      seriesId,
      blockId,
      entered: patch.entered ?? 0,
      completed: patch.completed ?? 0,
      skipped: patch.skipped ?? 0,
      failed: patch.failed ?? 0,
      deliveryAttempts: patch.deliveryAttempts ?? 0,
      deliveryFailures: patch.deliveryFailures ?? 0,
      yesBranchCount: patch.yesBranchCount,
      noBranchCount: patch.noBranchCount,
      defaultBranchCount: patch.defaultBranchCount,
      lastResult: patch.lastResult,
      updatedAt: nowTs(),
    });
    return;
  }

  await ctx.db.patch(existing._id, {
    entered: existing.entered + (patch.entered ?? 0),
    completed: existing.completed + (patch.completed ?? 0),
    skipped: existing.skipped + (patch.skipped ?? 0),
    failed: existing.failed + (patch.failed ?? 0),
    deliveryAttempts: existing.deliveryAttempts + (patch.deliveryAttempts ?? 0),
    deliveryFailures: existing.deliveryFailures + (patch.deliveryFailures ?? 0),
    yesBranchCount: (existing.yesBranchCount ?? 0) + (patch.yesBranchCount ?? 0),
    noBranchCount: (existing.noBranchCount ?? 0) + (patch.noBranchCount ?? 0),
    defaultBranchCount: (existing.defaultBranchCount ?? 0) + (patch.defaultBranchCount ?? 0),
    ...(patch.lastResult !== undefined ? { lastResult: patch.lastResult } : {}),
    updatedAt: nowTs(),
  });
}

export const getProgress = internalQuery({
  args: {
    seriesId: v.id("series"),
    visitorId: v.id("visitors"),
    historyLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.seriesId)) as Doc<"series"> | null;
    if (!series) {
      return null;
    }

    const progress = await ctx.db
      .query("seriesProgress")
      .withIndex("by_visitor_series", (q) =>
        q.eq("visitorId", args.visitorId).eq("seriesId", args.seriesId)
      )
      .first();

    if (!progress) return null;

    const historyLimit = clampLimit(args.historyLimit, DEFAULT_HISTORY_LIMIT, MAX_HISTORY_LIMIT);
    const history = await ctx.db
      .query("seriesProgressHistory")
      .withIndex("by_progress", (q) => q.eq("progressId", progress._id))
      .order("desc")
      .take(historyLimit);

    return {
      ...progress,
      history: history.sort((a, b) => a.createdAt - b.createdAt),
    };
  },
});

export const exitProgress = internalMutation({
  args: {
    progressId: v.id("seriesProgress"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const progress = (await ctx.db.get(args.progressId)) as Doc<"seriesProgress"> | null;
    if (!progress) throw new Error("Progress not found");
    const series = (await ctx.db.get(progress.seriesId)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");

    const now = nowTs();

    await ctx.db.patch(args.progressId, {
      status: "exited",
      exitedAt: now,
    });

    if (series.stats) {
      await ctx.db.patch(progress.seriesId, {
        stats: {
          ...series.stats,
          exited: series.stats.exited + 1,
        },
      });
    }
  },
});

export const markGoalReached = internalMutation({
  args: {
    progressId: v.id("seriesProgress"),
  },
  handler: async (ctx, args) => {
    const progress = (await ctx.db.get(args.progressId)) as Doc<"seriesProgress"> | null;
    if (!progress) throw new Error("Progress not found");
    const series = (await ctx.db.get(progress.seriesId)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");

    const now = nowTs();

    await ctx.db.patch(args.progressId, {
      status: "goal_reached",
      goalReachedAt: now,
    });

    if (series.stats) {
      await ctx.db.patch(progress.seriesId, {
        stats: {
          ...series.stats,
          goalReached: series.stats.goalReached + 1,
        },
      });
    }
  },
});

export const getStats = query({
  args: {
    id: v.id("series"),
    scanLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.id)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");
    const canManage = await canManageSeries(ctx, series.workspaceId);
    if (!canManage) {
      throw new Error("Permission denied: settings.workspace");
    }

    const scanLimit = clampLimit(args.scanLimit, DEFAULT_PROGRESS_SCAN_LIMIT, MAX_PROGRESS_SCAN_LIMIT);
    const progressRecords = await ctx.db
      .query("seriesProgress")
      .withIndex("by_series", (q) => q.eq("seriesId", args.id))
      .order("desc")
      .take(scanLimit);
    const truncated = progressRecords.length >= scanLimit;

    return {
      total: progressRecords.length,
      active: progressRecords.filter((p) => p.status === "active").length,
      waiting: progressRecords.filter((p) => p.status === "waiting").length,
      completed: progressRecords.filter((p) => p.status === "completed").length,
      exited: progressRecords.filter((p) => p.status === "exited").length,
      goalReached: progressRecords.filter((p) => p.status === "goal_reached").length,
      failed: progressRecords.filter((p) => p.status === "failed").length,
      completionRate:
        progressRecords.length > 0
          ? (progressRecords.filter((p) => p.status === "completed").length / progressRecords.length) *
            100
          : 0,
      goalRate:
        progressRecords.length > 0
          ? (progressRecords.filter((p) => p.status === "goal_reached").length / progressRecords.length) *
            100
          : 0,
      truncated,
    };
  },
});

export const getTelemetry = query({
  args: {
    id: v.id("series"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.id)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");

    const canManage = await canManageSeries(ctx, series.workspaceId);
    if (!canManage) {
      throw new Error("Permission denied: settings.workspace");
    }

    const limit = clampLimit(args.limit, DEFAULT_GRAPH_ITEM_LIMIT, MAX_GRAPH_ITEM_LIMIT);
    const telemetryRows = await ctx.db
      .query("seriesBlockTelemetry")
      .withIndex("by_series", (q) => q.eq("seriesId", args.id))
      .order("desc")
      .take(limit);

    const blockRows = await ctx.db
      .query("seriesBlocks")
      .withIndex("by_series", (q) => q.eq("seriesId", args.id))
      .collect();
    const blockMap = new Map(blockRows.map((block) => [block._id, block] as const));

    const totals = telemetryRows.reduce(
      (acc, row) => {
        acc.entered += row.entered;
        acc.completed += row.completed;
        acc.skipped += row.skipped;
        acc.failed += row.failed;
        acc.deliveryAttempts += row.deliveryAttempts;
        acc.deliveryFailures += row.deliveryFailures;
        return acc;
      },
      {
        entered: 0,
        completed: 0,
        skipped: 0,
        failed: 0,
        deliveryAttempts: 0,
        deliveryFailures: 0,
      }
    );

    return {
      totals,
      blocks: telemetryRows.map((row) => ({
        ...row,
        block: blockMap.get(row.blockId) ?? null,
      })),
    };
  },
});
