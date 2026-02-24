import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { AudienceRule, countMatchingVisitors, validateAudienceRule } from "./audienceRules";
import { getAuthenticatedUserFromSession } from "./auth";
import { hasPermission, requirePermission } from "./permissions";
import { audienceRulesValidator } from "./validators";

function getSegmentId(rules: unknown): string | undefined {
  if (rules && typeof rules === "object" && "segmentId" in rules) {
    return (rules as { segmentId: string }).segmentId;
  }
  return undefined;
}

const DEFAULT_SEGMENT_LIST_LIMIT = 100;
const MAX_SEGMENT_LIST_LIMIT = 500;
const DEFAULT_USAGE_TOTAL_LIMIT = 200;
const MAX_USAGE_TOTAL_LIMIT = 1000;
const DEFAULT_USAGE_PER_TYPE_LIMIT = 100;
const MAX_USAGE_PER_TYPE_LIMIT = 500;

function clampLimit(limit: number | undefined, defaultValue: number, maxValue: number): number {
  const normalized = limit ?? defaultValue;
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return defaultValue;
  }
  return Math.min(Math.floor(normalized), maxValue);
}

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    audienceRules: audienceRulesValidator,
    createdBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, args.workspaceId, "settings.workspace");
    if (args.createdBy && args.createdBy !== user._id) {
      throw new Error("Cannot create segment on behalf of another user");
    }

    if (!validateAudienceRule(args.audienceRules)) {
      throw new Error("Invalid audience rules");
    }

    const now = Date.now();

    const segmentId = await ctx.db.insert("segments", {
      workspaceId: args.workspaceId,
      name: args.name,
      description: args.description,
      audienceRules: args.audienceRules,
      createdAt: now,
      updatedAt: now,
      createdBy: args.createdBy,
    });

    return segmentId;
  },
});

export const update = mutation({
  args: {
    id: v.id("segments"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    audienceRules: v.optional(audienceRulesValidator),
  },
  handler: async (ctx, args) => {
    const segment = await ctx.db.get(args.id);
    if (!segment) {
      throw new Error("Segment not found");
    }

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, segment.workspaceId, "settings.workspace");

    if (args.audienceRules !== undefined && !validateAudienceRule(args.audienceRules)) {
      throw new Error("Invalid audience rules");
    }

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.audienceRules !== undefined) updates.audienceRules = args.audienceRules;

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

export const remove = mutation({
  args: {
    id: v.id("segments"),
  },
  handler: async (ctx, args) => {
    const segment = await ctx.db.get(args.id);
    if (!segment) {
      throw new Error("Segment not found");
    }

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, segment.workspaceId, "settings.workspace");

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const get = query({
  args: {
    id: v.id("segments"),
  },
  handler: async (ctx, args) => {
    const segment = await ctx.db.get(args.id);
    if (!segment) {
      return null;
    }

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return null;
    }
    const canRead = await hasPermission(ctx, user._id, segment.workspaceId, "settings.workspace");
    if (!canRead) {
      return null;
    }

    return segment;
  },
});

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return [];
    }
    const canRead = await hasPermission(ctx, user._id, args.workspaceId, "settings.workspace");
    if (!canRead) {
      return [];
    }

    const limit = clampLimit(args.limit, DEFAULT_SEGMENT_LIST_LIMIT, MAX_SEGMENT_LIST_LIMIT);
    return await ctx.db
      .query("segments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(limit);
  },
});

export const preview = query({
  args: {
    workspaceId: v.id("workspaces"),
    audienceRules: audienceRulesValidator,
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return 0;
    }
    const canRead = await hasPermission(ctx, user._id, args.workspaceId, "settings.workspace");
    if (!canRead) {
      return 0;
    }

    if (!validateAudienceRule(args.audienceRules)) {
      throw new Error("Invalid audience rules");
    }

    return await countMatchingVisitors(ctx, args.workspaceId, args.audienceRules as AudienceRule);
  },
});

export const getUsage = query({
  args: {
    id: v.id("segments"),
    totalLimit: v.optional(v.number()),
    perTypeLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const segment = await ctx.db.get(args.id);
    if (!segment) {
      throw new Error("Segment not found");
    }

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return [];
    }
    const canRead = await hasPermission(ctx, user._id, segment.workspaceId, "settings.workspace");
    if (!canRead) {
      return [];
    }

    const usage: { type: string; id: string; name: string }[] = [];
    const totalLimit = clampLimit(
      args.totalLimit,
      DEFAULT_USAGE_TOTAL_LIMIT,
      MAX_USAGE_TOTAL_LIMIT
    );
    const perTypeLimit = clampLimit(
      args.perTypeLimit,
      DEFAULT_USAGE_PER_TYPE_LIMIT,
      MAX_USAGE_PER_TYPE_LIMIT
    );

    // Check tours
    const tours = await ctx.db
      .query("tours")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", segment.workspaceId))
      .order("desc")
      .take(perTypeLimit);
    for (const tour of tours) {
      if (usage.length >= totalLimit) return usage;
      if (getSegmentId(tour.audienceRules) === args.id) {
        usage.push({ type: "tour", id: tour._id, name: tour.name });
      }
    }

    // Check surveys
    const surveys = await ctx.db
      .query("surveys")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", segment.workspaceId))
      .order("desc")
      .take(perTypeLimit);
    for (const survey of surveys) {
      if (usage.length >= totalLimit) return usage;
      if (getSegmentId(survey.audienceRules) === args.id) {
        usage.push({ type: "survey", id: survey._id, name: survey.name });
      }
    }

    // Check outbound messages
    const messages = await ctx.db
      .query("outboundMessages")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", segment.workspaceId))
      .order("desc")
      .take(perTypeLimit);
    for (const message of messages) {
      if (usage.length >= totalLimit) return usage;
      const rules = (message as Record<string, unknown>).audienceRules ?? message.targeting;
      if ((rules as Record<string, unknown>)?.segmentId === args.id) {
        usage.push({ type: "outboundMessage", id: message._id, name: message.name });
      }
    }

    // Check checklists
    const checklists = await ctx.db
      .query("checklists")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", segment.workspaceId))
      .order("desc")
      .take(perTypeLimit);
    for (const checklist of checklists) {
      if (usage.length >= totalLimit) return usage;
      const rules = (checklist as Record<string, unknown>).audienceRules ?? checklist.targeting;
      if ((rules as Record<string, unknown>)?.segmentId === args.id) {
        usage.push({ type: "checklist", id: checklist._id, name: checklist.name });
      }
    }

    return usage;
  },
});
