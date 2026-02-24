import { v } from "convex/values";
import { query } from "./_generated/server";
import {
  evaluateRuleWithSegmentSupport,
  evaluateTrigger,
  TriggerConfig,
  TriggerContext,
  validateAudienceRule,
} from "./audienceRules";
import { authMutation, authQuery } from "./lib/authWrappers";
import { getAuthenticatedUserFromSession } from "./auth";
import { requirePermission } from "./permissions";
import { resolveVisitorFromSession } from "./widgetSessions";
import {
  audienceRulesOrSegmentValidator,
  eventPropertiesValidator,
  selectorQualityValidator,
  triggerConfigValidator,
} from "./validators";

const TOOLTIP_LIST_DEFAULT_LIMIT = 200;
const TOOLTIP_LIST_MAX_LIMIT = 1000;
const TOOLTIP_EVALUATION_DEFAULT_LIMIT = 300;
const TOOLTIP_EVALUATION_MAX_LIMIT = 1500;

function clampLimit(value: number | undefined, fallback: number, max: number): number {
  return Math.max(1, Math.min(value ?? fallback, max));
}

export const create = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    elementSelector: v.string(),
    selectorQuality: v.optional(selectorQualityValidator),
    content: v.string(),
    triggerType: v.union(v.literal("hover"), v.literal("click"), v.literal("auto")),
    audienceRules: v.optional(audienceRulesOrSegmentValidator),
    triggers: v.optional(triggerConfigValidator),
  },
  permission: "settings.workspace",
  handler: async (ctx, args) => {
    // Validate audienceRules if provided
    const hasSegmentReference =
      typeof args.audienceRules === "object" &&
      args.audienceRules !== null &&
      "segmentId" in args.audienceRules;
    if (
      args.audienceRules !== undefined &&
      !hasSegmentReference &&
      !validateAudienceRule(args.audienceRules)
    ) {
      throw new Error("Invalid audience rules");
    }

    const now = Date.now();

    const tooltipId = await ctx.db.insert("tooltips", {
      workspaceId: args.workspaceId,
      name: args.name,
      elementSelector: args.elementSelector,
      selectorQuality: args.selectorQuality,
      content: args.content,
      triggerType: args.triggerType,
      audienceRules: args.audienceRules,
      triggers: args.triggers,
      createdAt: now,
      updatedAt: now,
    });

    return tooltipId;
  },
});

export const update = authMutation({
  args: {
    id: v.id("tooltips"),
    name: v.optional(v.string()),
    elementSelector: v.optional(v.string()),
    selectorQuality: v.optional(selectorQualityValidator),
    content: v.optional(v.string()),
    triggerType: v.optional(v.union(v.literal("hover"), v.literal("click"), v.literal("auto"))),
    audienceRules: v.optional(audienceRulesOrSegmentValidator),
    triggers: v.optional(triggerConfigValidator),
  },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const tooltip = await ctx.db.get(args.id);
    return tooltip?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const tooltip = await ctx.db.get(args.id);
    if (!tooltip) {
      throw new Error("Tooltip not found");
    }

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    // Validate audienceRules if provided
    const hasSegmentReference =
      typeof args.audienceRules === "object" &&
      args.audienceRules !== null &&
      "segmentId" in args.audienceRules;
    if (
      args.audienceRules !== undefined &&
      !hasSegmentReference &&
      !validateAudienceRule(args.audienceRules)
    ) {
      throw new Error("Invalid audience rules");
    }

    if (args.name !== undefined) updates.name = args.name;
    if (args.elementSelector !== undefined) updates.elementSelector = args.elementSelector;
    if (args.selectorQuality !== undefined) updates.selectorQuality = args.selectorQuality;
    if (args.content !== undefined) updates.content = args.content;
    if (args.triggerType !== undefined) updates.triggerType = args.triggerType;
    if (args.audienceRules !== undefined) updates.audienceRules = args.audienceRules;
    if (args.triggers !== undefined) updates.triggers = args.triggers;

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

export const remove = authMutation({
  args: {
    id: v.id("tooltips"),
  },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const tooltip = await ctx.db.get(args.id);
    return tooltip?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const tooltip = await ctx.db.get(args.id);
    if (!tooltip) {
      throw new Error("Tooltip not found");
    }
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const list = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  permission: "settings.workspace",
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, TOOLTIP_LIST_DEFAULT_LIMIT, TOOLTIP_LIST_MAX_LIMIT);
    return await ctx.db
      .query("tooltips")
      .withIndex("by_workspace_updated_at", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(limit);
  },
});

export const getAvailableTooltips = query({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    limit: v.optional(v.number()),
    triggerContext: v.optional(
      v.object({
        currentUrl: v.optional(v.string()),
        timeOnPageSeconds: v.optional(v.number()),
        scrollPercent: v.optional(v.number()),
        firedEventName: v.optional(v.string()),
        firedEventProperties: v.optional(eventPropertiesValidator),
        isExitIntent: v.optional(v.boolean()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const evaluationLimit = clampLimit(
      args.limit,
      TOOLTIP_EVALUATION_DEFAULT_LIMIT,
      TOOLTIP_EVALUATION_MAX_LIMIT
    );

    const authUser = await getAuthenticatedUserFromSession(ctx);
    let resolvedVisitorId = args.visitorId;

    if (authUser) {
      await requirePermission(ctx, authUser._id, args.workspaceId, "articles.read");
      if (!resolvedVisitorId) {
        return [];
      }
    } else {
      const resolved = await resolveVisitorFromSession(ctx, {
        sessionToken: args.sessionToken,
        workspaceId: args.workspaceId,
      });
      if (args.visitorId && args.visitorId !== resolved.visitorId) {
        throw new Error("Not authorized to list tooltips for this visitor");
      }
      resolvedVisitorId = resolved.visitorId;
    }

    if (!resolvedVisitorId) {
      return [];
    }

    const visitor = await ctx.db.get(resolvedVisitorId);
    if (!visitor || visitor.workspaceId !== args.workspaceId) {
      return [];
    }

    const tooltips = await ctx.db
      .query("tooltips")
      .withIndex("by_workspace_updated_at", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(evaluationLimit);

    const available: typeof tooltips = [];
    const triggerCtx: TriggerContext = args.triggerContext ?? {};

    for (const tooltip of tooltips) {
      const matchesAudience = await evaluateRuleWithSegmentSupport(
        ctx,
        tooltip.audienceRules,
        visitor
      );

      if (!matchesAudience) {
        continue;
      }

      const matchesTrigger = evaluateTrigger(
        tooltip.triggers as TriggerConfig | undefined,
        triggerCtx
      );

      if (matchesTrigger) {
        available.push(tooltip);
      }
    }

    return available;
  },
});
