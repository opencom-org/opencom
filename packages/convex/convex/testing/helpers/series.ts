import { internalMutation } from "../../_generated/server";
import { v } from "convex/values";
import {
  runSeriesEvaluateEnrollmentForVisitor as runSeriesEvaluateEnrollmentForVisitorInternal,
  runSeriesProcessWaitingProgress as runSeriesProcessWaitingProgressInternal,
  runSeriesResumeWaitingForEvent as runSeriesResumeWaitingForEventInternal,
} from "../../series/scheduler";

const seriesEntryTriggerTestValidator = v.object({
  source: v.union(
    v.literal("event"),
    v.literal("auto_event"),
    v.literal("visitor_attribute_changed"),
    v.literal("visitor_state_changed")
  ),
  eventName: v.optional(v.string()),
  attributeKey: v.optional(v.string()),
  fromValue: v.optional(v.string()),
  toValue: v.optional(v.string()),
});
const seriesProgressStatusValidator = v.union(
  v.literal("active"),
  v.literal("waiting"),
  v.literal("completed"),
  v.literal("exited"),
  v.literal("goal_reached"),
  v.literal("failed")
);

const runSeriesEvaluateEnrollmentForVisitor: ReturnType<typeof internalMutation> =
  internalMutation({
    args: {
      workspaceId: v.id("workspaces"),
      visitorId: v.id("visitors"),
      triggerContext: seriesEntryTriggerTestValidator,
    },
    handler: async (ctx, args): Promise<unknown> => {
      return await runSeriesEvaluateEnrollmentForVisitorInternal(ctx, args);
    },
  });

/**
 * Runs event-based wait resumption for waiting series progress records.
 */
const runSeriesResumeWaitingForEvent: ReturnType<typeof internalMutation> = internalMutation(
  {
    args: {
      workspaceId: v.id("workspaces"),
      visitorId: v.id("visitors"),
      eventName: v.string(),
    },
    handler: async (ctx, args): Promise<unknown> => {
      return await runSeriesResumeWaitingForEventInternal(ctx, args);
    },
  }
);

/**
 * Runs wait backstop processing for active series.
 */
const runSeriesProcessWaitingProgress: ReturnType<typeof internalMutation> =
  internalMutation({
    args: {
      seriesLimit: v.optional(v.number()),
      waitingLimitPerSeries: v.optional(v.number()),
    },
    handler: async (ctx, args): Promise<unknown> => {
      return await runSeriesProcessWaitingProgressInternal(ctx, args);
    },
  });

/**
 * Returns the current progress record for a visitor in a series.
 */
const getSeriesProgressForVisitorSeries = internalMutation({
  args: {
    visitorId: v.id("visitors"),
    seriesId: v.id("series"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("seriesProgress")
      .withIndex("by_visitor_series", (q) =>
        q.eq("visitorId", args.visitorId).eq("seriesId", args.seriesId)
      )
      .first();
  },
});

/**
 * Patches series progress fields for deterministic runtime retry/backstop tests.
 */
const updateSeriesProgressForTest = internalMutation({
  args: {
    progressId: v.id("seriesProgress"),
    status: v.optional(seriesProgressStatusValidator),
    waitUntil: v.optional(v.number()),
    waitEventName: v.optional(v.string()),
    attemptCount: v.optional(v.number()),
    lastExecutionError: v.optional(v.string()),
    clearWaitUntil: v.optional(v.boolean()),
    clearWaitEventName: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const progress = await ctx.db.get(args.progressId);
    if (!progress) {
      throw new Error("Progress not found");
    }

    await ctx.db.patch(args.progressId, {
      ...(args.status !== undefined ? { status: args.status } : {}),
      ...(args.waitUntil !== undefined ? { waitUntil: args.waitUntil } : {}),
      ...(args.waitEventName !== undefined ? { waitEventName: args.waitEventName } : {}),
      ...(args.attemptCount !== undefined ? { attemptCount: args.attemptCount } : {}),
      ...(args.lastExecutionError !== undefined
        ? { lastExecutionError: args.lastExecutionError }
        : {}),
      ...(args.clearWaitUntil ? { waitUntil: undefined } : {}),
      ...(args.clearWaitEventName ? { waitEventName: undefined } : {}),
    });

    return await ctx.db.get(args.progressId);
  },
});

/**
 * Creates a test audit log entry directly (bypasses auth) for deterministic audit E2E flows.
 */
const createTestSeries = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("draft"), v.literal("active"), v.literal("paused"), v.literal("archived"))
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2, 8);

    const seriesId = await ctx.db.insert("series", {
      workspaceId: args.workspaceId,
      name: args.name ?? `Test Series ${randomSuffix}`,
      status: args.status ?? "active",
      createdAt: now,
      updatedAt: now,
    });

    // Add a minimal entry block so evaluateEntry can traverse the series.
    await ctx.db.insert("seriesBlocks", {
      seriesId,
      type: "wait",
      position: { x: 0, y: 0 },
      config: {
        waitType: "duration",
        waitDuration: 1,
        waitUnit: "minutes",
      },
      createdAt: now,
      updatedAt: now,
    });

    return { seriesId };
  },
});

/**
 * Creates a test push campaign directly (bypasses auth on pushCampaigns.create).
 */

export const seriesTestHelpers: Record<string, ReturnType<typeof internalMutation>> = {
  runSeriesEvaluateEnrollmentForVisitor,
  runSeriesResumeWaitingForEvent,
  runSeriesProcessWaitingProgress,
  getSeriesProgressForVisitorSeries,
  updateSeriesProgressForTest,
  createTestSeries,
} as const;
