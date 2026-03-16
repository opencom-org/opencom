import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { validateAudienceRule } from "../audienceRules";
import { audienceRulesOrSegmentValidator } from "../validators";
import {
  DEFAULT_GRAPH_ITEM_LIMIT,
  DEFAULT_SERIES_LIST_LIMIT,
  MAX_GRAPH_ITEM_LIMIT,
  MAX_SERIES_LIST_LIMIT,
  seriesBlockConfigValidator,
  seriesBlockTypeValidator,
  seriesEntryTriggerValidator,
} from "./contracts";
import { evaluateSeriesReadiness } from "./readiness";
import {
  canManageSeries,
  clampLimit,
  isSeriesRuntimeEnabled,
  normalizeSeriesStats,
  nowTs,
  requireSeriesManagePermission,
  serializeReadinessError,
  serializeRuntimeGuardError,
} from "./shared";
import { requireFeatureAccess } from "../billing-hooks/onEmailSent";

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    entryTriggers: v.optional(v.array(seriesEntryTriggerValidator)),
    entryRules: v.optional(audienceRulesOrSegmentValidator),
    exitRules: v.optional(audienceRulesOrSegmentValidator),
    goalRules: v.optional(audienceRulesOrSegmentValidator),
  },
  handler: async (ctx, args) => {
    await requireSeriesManagePermission(ctx, args.workspaceId);
    // Task 8.3: Check series feature entitlement
    // Billing hook: throws if series automation is not available on the current plan.
    await requireFeatureAccess(ctx, args.workspaceId, "series");

    if (args.entryRules !== undefined && !validateAudienceRule(args.entryRules)) {
      throw new Error("Invalid entry rules");
    }
    if (args.exitRules !== undefined && !validateAudienceRule(args.exitRules)) {
      throw new Error("Invalid exit rules");
    }
    if (args.goalRules !== undefined && !validateAudienceRule(args.goalRules)) {
      throw new Error("Invalid goal rules");
    }

    const now = nowTs();
    return await ctx.db.insert("series", {
      workspaceId: args.workspaceId,
      name: args.name,
      description: args.description,
      entryTriggers: args.entryTriggers,
      entryRules: args.entryRules,
      exitRules: args.exitRules,
      goalRules: args.goalRules,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("series"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    entryTriggers: v.optional(v.array(seriesEntryTriggerValidator)),
    entryRules: v.optional(audienceRulesOrSegmentValidator),
    exitRules: v.optional(audienceRulesOrSegmentValidator),
    goalRules: v.optional(audienceRulesOrSegmentValidator),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = (await ctx.db.get(id)) as Doc<"series"> | null;
    if (!existing) throw new Error("Series not found");
    await requireSeriesManagePermission(ctx, existing.workspaceId);

    if (args.entryRules !== undefined && !validateAudienceRule(args.entryRules)) {
      throw new Error("Invalid entry rules");
    }
    if (args.exitRules !== undefined && !validateAudienceRule(args.exitRules)) {
      throw new Error("Invalid exit rules");
    }
    if (args.goalRules !== undefined && !validateAudienceRule(args.goalRules)) {
      throw new Error("Invalid goal rules");
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: nowTs(),
    });
    return id;
  },
});

export const activate = mutation({
  args: { id: v.id("series") },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.id)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");
    await requireSeriesManagePermission(ctx, series.workspaceId);

    if (!isSeriesRuntimeEnabled()) {
      throw new Error(serializeRuntimeGuardError());
    }

    const readiness = await evaluateSeriesReadiness(ctx, series);
    if (!readiness.isReady) {
      throw new Error(serializeReadinessError(readiness));
    }

    await ctx.db.patch(args.id, {
      status: "active",
      updatedAt: nowTs(),
      stats: normalizeSeriesStats(series),
    });
  },
});

export const pause = mutation({
  args: { id: v.id("series") },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.id)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");
    await requireSeriesManagePermission(ctx, series.workspaceId);

    await ctx.db.patch(args.id, { status: "paused", updatedAt: nowTs() });
  },
});

export const archive = mutation({
  args: { id: v.id("series") },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.id)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");
    await requireSeriesManagePermission(ctx, series.workspaceId);

    await ctx.db.patch(args.id, { status: "archived", updatedAt: nowTs() });
  },
});

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(
      v.union(v.literal("draft"), v.literal("active"), v.literal("paused"), v.literal("archived"))
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const canManage = await canManageSeries(ctx, args.workspaceId);
    if (!canManage) {
      return [];
    }

    const limit = clampLimit(args.limit, DEFAULT_SERIES_LIST_LIMIT, MAX_SERIES_LIST_LIMIT);
    let seriesList;

    if (args.status) {
      seriesList = await ctx.db
        .query("series")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", args.status!)
        )
        .order("desc")
        .take(limit);
    } else {
      seriesList = await ctx.db
        .query("series")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .order("desc")
        .take(limit);
    }

    return seriesList.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const get = query({
  args: { id: v.id("series") },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.id)) as Doc<"series"> | null;
    if (!series) {
      return null;
    }
    const canManage = await canManageSeries(ctx, series.workspaceId);
    if (!canManage) {
      return null;
    }
    return series;
  },
});

export const getReadiness = query({
  args: { id: v.id("series") },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.id)) as Doc<"series"> | null;
    if (!series) {
      return null;
    }

    const canManage = await canManageSeries(ctx, series.workspaceId);
    if (!canManage) {
      throw new Error("Permission denied: settings.workspace");
    }

    return await evaluateSeriesReadiness(ctx, series);
  },
});

export const getWithBlocks = query({
  args: {
    id: v.id("series"),
    blockLimit: v.optional(v.number()),
    connectionLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.id)) as Doc<"series"> | null;
    if (!series) return null;
    const canManage = await canManageSeries(ctx, series.workspaceId);
    if (!canManage) return null;

    const blockLimit = clampLimit(args.blockLimit, DEFAULT_GRAPH_ITEM_LIMIT, MAX_GRAPH_ITEM_LIMIT);
    const connectionLimit = clampLimit(
      args.connectionLimit,
      DEFAULT_GRAPH_ITEM_LIMIT,
      MAX_GRAPH_ITEM_LIMIT
    );
    const blocks = await ctx.db
      .query("seriesBlocks")
      .withIndex("by_series", (q) => q.eq("seriesId", args.id))
      .order("desc")
      .take(blockLimit);

    const connections = await ctx.db
      .query("seriesConnections")
      .withIndex("by_series", (q) => q.eq("seriesId", args.id))
      .order("desc")
      .take(connectionLimit);

    return {
      ...series,
      blocks,
      connections,
    };
  },
});

export const remove = mutation({
  args: { id: v.id("series") },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.id)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");
    await requireSeriesManagePermission(ctx, series.workspaceId);

    const blocks = await ctx.db
      .query("seriesBlocks")
      .withIndex("by_series", (q) => q.eq("seriesId", args.id))
      .collect();

    for (const block of blocks) {
      await ctx.db.delete(block._id);
    }

    const connections = await ctx.db
      .query("seriesConnections")
      .withIndex("by_series", (q) => q.eq("seriesId", args.id))
      .collect();

    for (const connection of connections) {
      await ctx.db.delete(connection._id);
    }

    const progressRecords = await ctx.db
      .query("seriesProgress")
      .withIndex("by_series", (q) => q.eq("seriesId", args.id))
      .collect();

    for (const progress of progressRecords) {
      const history = await ctx.db
        .query("seriesProgressHistory")
        .withIndex("by_progress", (q) => q.eq("progressId", progress._id))
        .collect();

      for (const h of history) {
        await ctx.db.delete(h._id);
      }

      await ctx.db.delete(progress._id);
    }

    await ctx.db.delete(args.id);
  },
});

export const addBlock = mutation({
  args: {
    seriesId: v.id("series"),
    type: seriesBlockTypeValidator,
    position: v.object({
      x: v.number(),
      y: v.number(),
    }),
    config: seriesBlockConfigValidator,
  },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.seriesId)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");
    await requireSeriesManagePermission(ctx, series.workspaceId);

    const now = nowTs();
    return await ctx.db.insert("seriesBlocks", {
      seriesId: args.seriesId,
      type: args.type,
      position: args.position,
      config: args.config,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateBlock = mutation({
  args: {
    id: v.id("seriesBlocks"),
    position: v.optional(
      v.object({
        x: v.number(),
        y: v.number(),
      })
    ),
    config: v.optional(seriesBlockConfigValidator),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = (await ctx.db.get(id)) as Doc<"seriesBlocks"> | null;
    if (!existing) throw new Error("Block not found");
    const series = (await ctx.db.get(existing.seriesId)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");
    await requireSeriesManagePermission(ctx, series.workspaceId);

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: nowTs(),
    });
    return id;
  },
});

export const removeBlock = mutation({
  args: { id: v.id("seriesBlocks") },
  handler: async (ctx, args) => {
    const block = (await ctx.db.get(args.id)) as Doc<"seriesBlocks"> | null;
    if (!block) throw new Error("Block not found");
    const series = (await ctx.db.get(block.seriesId)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");
    await requireSeriesManagePermission(ctx, series.workspaceId);

    const fromConnections = await ctx.db
      .query("seriesConnections")
      .withIndex("by_from_block", (q) => q.eq("fromBlockId", args.id))
      .collect();

    const toConnections = await ctx.db
      .query("seriesConnections")
      .withIndex("by_to_block", (q) => q.eq("toBlockId", args.id))
      .collect();

    for (const conn of [...fromConnections, ...toConnections]) {
      await ctx.db.delete(conn._id);
    }

    await ctx.db.delete(args.id);
  },
});

export const addConnection = mutation({
  args: {
    seriesId: v.id("series"),
    fromBlockId: v.id("seriesBlocks"),
    toBlockId: v.id("seriesBlocks"),
    condition: v.optional(v.union(v.literal("yes"), v.literal("no"), v.literal("default"))),
  },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.seriesId)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");
    await requireSeriesManagePermission(ctx, series.workspaceId);

    const fromBlock = (await ctx.db.get(args.fromBlockId)) as Doc<"seriesBlocks"> | null;
    const toBlock = (await ctx.db.get(args.toBlockId)) as Doc<"seriesBlocks"> | null;
    if (!fromBlock || !toBlock) {
      throw new Error("Block not found");
    }
    if (fromBlock.seriesId !== args.seriesId || toBlock.seriesId !== args.seriesId) {
      throw new Error("Blocks must belong to the target series");
    }

    return await ctx.db.insert("seriesConnections", {
      seriesId: args.seriesId,
      fromBlockId: args.fromBlockId,
      toBlockId: args.toBlockId,
      condition: args.condition,
      createdAt: nowTs(),
    });
  },
});

export const removeConnection = mutation({
  args: { id: v.id("seriesConnections") },
  handler: async (ctx, args) => {
    const connection = (await ctx.db.get(args.id)) as Doc<"seriesConnections"> | null;
    if (!connection) throw new Error("Connection not found");
    const series = (await ctx.db.get(connection.seriesId)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");
    await requireSeriesManagePermission(ctx, series.workspaceId);

    await ctx.db.delete(args.id);
  },
});

export const duplicate = mutation({
  args: { id: v.id("series") },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.id)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");
    await requireSeriesManagePermission(ctx, series.workspaceId);

    const now = nowTs();

    const newSeriesId = await ctx.db.insert("series", {
      workspaceId: series.workspaceId,
      name: `${series.name} (Copy)`,
      description: series.description,
      entryTriggers: series.entryTriggers,
      entryRules: series.entryRules,
      exitRules: series.exitRules,
      goalRules: series.goalRules,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });

    const blocks = await ctx.db
      .query("seriesBlocks")
      .withIndex("by_series", (q) => q.eq("seriesId", args.id))
      .collect();

    const blockIdMap = new Map<string, Id<"seriesBlocks">>();

    for (const block of blocks) {
      const newBlockId = await ctx.db.insert("seriesBlocks", {
        seriesId: newSeriesId,
        type: block.type,
        position: block.position,
        config: block.config,
        createdAt: now,
        updatedAt: now,
      });
      blockIdMap.set(block._id as string, newBlockId);
    }

    const connections = await ctx.db
      .query("seriesConnections")
      .withIndex("by_series", (q) => q.eq("seriesId", args.id))
      .collect();

    for (const conn of connections) {
      const newFromId = blockIdMap.get(conn.fromBlockId as string);
      const newToId = blockIdMap.get(conn.toBlockId as string);

      if (newFromId && newToId) {
        await ctx.db.insert("seriesConnections", {
          seriesId: newSeriesId,
          fromBlockId: newFromId,
          toBlockId: newToId,
          condition: conn.condition,
          createdAt: now,
        });
      }
    }

    return newSeriesId;
  },
});
