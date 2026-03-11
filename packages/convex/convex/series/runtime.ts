import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import {
  DEFAULT_PROGRESS_SCAN_LIMIT,
  DEFAULT_WAITING_BATCH_LIMIT,
  MAX_PROGRESS_SCAN_LIMIT,
  MAX_SERIES_EXECUTION_DEPTH,
  MAX_WAITING_BATCH_LIMIT,
  seriesEntryTriggerValidator,
} from "./contracts";
import {
  clampLimit,
  isSeriesRuntimeEnabled,
  nowTs,
  serializeRuntimeGuardError,
  sortProgressDeterministically,
} from "./shared";
import { evaluateSeriesEntry } from "./runtimeEnrollment";
import { processProgressRecord } from "./runtimeProcessing";
import { runSeriesEvaluateEntry } from "./scheduler";

export const evaluateEntry = internalMutation({
  args: {
    seriesId: v.id("series"),
    visitorId: v.id("visitors"),
    triggerContext: v.optional(seriesEntryTriggerValidator),
  },
  handler: async (ctx, args) => {
    if (!isSeriesRuntimeEnabled()) {
      return { entered: false, reason: "runtime_disabled" as const };
    }
    return await evaluateSeriesEntry(ctx, args);
  },
});

export const evaluateEnrollmentForVisitor = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.id("visitors"),
    triggerContext: seriesEntryTriggerValidator,
  },
  handler: async (ctx, args) => {
    if (!isSeriesRuntimeEnabled()) {
      return {
        evaluated: 0,
        entered: 0,
        reason: serializeRuntimeGuardError(),
      };
    }

    const visitor = (await ctx.db.get(args.visitorId)) as Doc<"visitors"> | null;
    if (!visitor || visitor.workspaceId !== args.workspaceId) {
      return {
        evaluated: 0,
        entered: 0,
        reason: "visitor_not_found",
      };
    }

    const activeSeries = await ctx.db
      .query("series")
      .withIndex("by_workspace_status", (q) => q.eq("workspaceId", args.workspaceId).eq("status", "active"))
      .collect();

    let entered = 0;
    for (const series of activeSeries) {
      const result = await runSeriesEvaluateEntry(ctx, {
        seriesId: series._id,
        visitorId: args.visitorId,
        triggerContext: args.triggerContext,
      });
      if (result?.entered) {
        entered += 1;
      }
    }

    return {
      evaluated: activeSeries.length,
      entered,
    };
  },
});

export const resumeWaitingForEvent = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.id("visitors"),
    eventName: v.string(),
  },
  handler: async (ctx, args) => {
    if (!isSeriesRuntimeEnabled()) {
      return {
        matched: 0,
        resumed: 0,
        reason: serializeRuntimeGuardError(),
      };
    }

    const waitingProgress = sortProgressDeterministically(
      await ctx.db
        .query("seriesProgress")
        .withIndex("by_visitor_status", (q) => q.eq("visitorId", args.visitorId).eq("status", "waiting"))
        .collect()
    );

    let matched = 0;
    let resumed = 0;
    for (const progress of waitingProgress) {
      if (!progress.currentBlockId) {
        continue;
      }
      if (progress.waitEventName !== args.eventName) {
        continue;
      }

      const series = (await ctx.db.get(progress.seriesId)) as Doc<"series"> | null;
      if (!series || series.workspaceId !== args.workspaceId || series.status !== "active") {
        continue;
      }

      matched += 1;
      await ctx.db.patch(progress._id, {
        waitEventName: undefined,
        waitUntil: nowTs(),
      });

      const result = await processProgressRecord(ctx, progress._id);
      if (result.processed) {
        resumed += 1;
      }
    }

    return {
      matched,
      resumed,
    };
  },
});

export const processProgress = internalMutation({
  args: {
    progressId: v.id("seriesProgress"),
    maxDepth: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!isSeriesRuntimeEnabled()) {
      return {
        processed: false,
        status: "missing" as const,
        reason: serializeRuntimeGuardError(),
      };
    }

    const maxDepth = clampLimit(args.maxDepth, MAX_SERIES_EXECUTION_DEPTH, MAX_SERIES_EXECUTION_DEPTH);
    return await processProgressRecord(ctx, args.progressId, maxDepth);
  },
});

export const processWaitingProgress = internalMutation({
  args: {
    seriesLimit: v.optional(v.number()),
    waitingLimitPerSeries: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!isSeriesRuntimeEnabled()) {
      return {
        processed: 0,
        reason: serializeRuntimeGuardError(),
      };
    }

    const now = nowTs();
    const seriesLimit = clampLimit(args.seriesLimit, DEFAULT_PROGRESS_SCAN_LIMIT, MAX_PROGRESS_SCAN_LIMIT);
    const waitingLimitPerSeries = clampLimit(
      args.waitingLimitPerSeries,
      DEFAULT_WAITING_BATCH_LIMIT,
      MAX_WAITING_BATCH_LIMIT
    );

    const allSeries = await ctx.db.query("series").order("desc").take(seriesLimit);
    let processed = 0;
    let scanned = 0;

    for (const series of allSeries) {
      if (series.status !== "active") continue;

      const waitingProgress = sortProgressDeterministically(
        await ctx.db
          .query("seriesProgress")
          .withIndex("by_status", (q) => q.eq("seriesId", series._id).eq("status", "waiting"))
          .take(waitingLimitPerSeries)
      );

      for (const progress of waitingProgress) {
        scanned += 1;
        if (!progress.currentBlockId) continue;
        if (progress.waitEventName) continue;
        if (progress.waitUntil !== undefined && progress.waitUntil > now) continue;

        const result = await processProgressRecord(ctx, progress._id);
        if (result.processed) {
          processed += 1;
        }
      }
    }

    return { processed, scanned };
  },
});
