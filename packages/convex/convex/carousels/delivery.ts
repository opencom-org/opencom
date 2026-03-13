import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { evaluateRuleWithSegmentSupport } from "../audienceRules";
import { authQuery } from "../lib/authWrappers";
import {
  assertCarouselDeliverable,
  findExistingTerminalImpression,
  normalizeCarouselScreens,
  resolveCarouselVisitorAccess,
} from "./helpers";

async function listEligibleCarousels(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  visitorId: Id<"visitors">
): Promise<Doc<"carousels">[]> {
  const visitor = (await ctx.db.get(visitorId)) as Doc<"visitors"> | null;
  if (!visitor || visitor.workspaceId !== workspaceId) {
    throw new Error("Visitor not found in workspace");
  }

  const activeCarousels = await ctx.db
    .query("carousels")
    .withIndex("by_workspace_status", (q) => q.eq("workspaceId", workspaceId).eq("status", "active"))
    .collect();

  const impressions = await ctx.db
    .query("carouselImpressions")
    .withIndex("by_visitor", (q) => q.eq("visitorId", visitorId))
    .collect();

  const completedCarouselIds = new Set(
    impressions
      .filter((impression) => impression.action === "completed" || impression.action === "dismissed")
      .map((impression) => impression.carouselId as string)
  );

  const eligible: Doc<"carousels">[] = [];

  for (const carousel of activeCarousels) {
    if (completedCarouselIds.has(carousel._id as string)) {
      continue;
    }

    try {
      assertCarouselDeliverable(carousel);
    } catch {
      continue;
    }

    const audienceRules = carousel.audienceRules ?? carousel.targeting;
    if (audienceRules) {
      const matches = await evaluateRuleWithSegmentSupport(ctx, audienceRules, visitor);
      if (!matches) {
        continue;
      }
    }

    eligible.push({
      ...carousel,
      screens: normalizeCarouselScreens(carousel.screens),
    });
  }

  return eligible.sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

async function trackCarouselImpression(
  ctx: MutationCtx,
  args: {
    carouselId: Id<"carousels">;
    visitorId?: Id<"visitors">;
    sessionToken?: string;
    action: "shown" | "completed" | "dismissed";
    screenIndex?: number;
  }
): Promise<Id<"carouselImpressions">> {
  const carousel = (await ctx.db.get(args.carouselId)) as Doc<"carousels"> | null;
  if (!carousel) {
    throw new Error("Carousel not found");
  }
  assertCarouselDeliverable(carousel);

  const resolvedVisitorId = await resolveCarouselVisitorAccess(ctx, {
    workspaceId: carousel.workspaceId,
    visitorId: args.visitorId,
    sessionToken: args.sessionToken,
  });

  if (args.action === "completed" || args.action === "dismissed") {
    const existingTerminal = await findExistingTerminalImpression(
      ctx,
      resolvedVisitorId,
      args.carouselId
    );
    if (existingTerminal) {
      return existingTerminal._id;
    }
  }

  return await ctx.db.insert("carouselImpressions", {
    carouselId: args.carouselId,
    visitorId: resolvedVisitorId,
    action: args.action,
    screenIndex: args.screenIndex,
    createdAt: Date.now(),
  });
}

export const getEligible = query({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const resolvedVisitorId = await resolveCarouselVisitorAccess(ctx, {
      workspaceId: args.workspaceId,
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
    });

    return await listEligibleCarousels(ctx, args.workspaceId, resolvedVisitorId);
  },
});

export const trackImpression = mutation({
  args: {
    carouselId: v.id("carousels"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    action: v.union(v.literal("shown"), v.literal("completed"), v.literal("dismissed")),
    screenIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await trackCarouselImpression(ctx, args);
  },
});

export const getStats = authQuery({
  args: { id: v.id("carousels") },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    return carousel?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const impressions = await ctx.db
      .query("carouselImpressions")
      .withIndex("by_carousel", (q) => q.eq("carouselId", args.id))
      .collect();

    const shown = new Set(
      impressions.filter((impression) => impression.action === "shown").map((impression) => impression.visitorId)
    ).size;
    const completed = new Set(
      impressions
        .filter((impression) => impression.action === "completed")
        .map((impression) => impression.visitorId)
    ).size;
    const dismissed = new Set(
      impressions
        .filter((impression) => impression.action === "dismissed")
        .map((impression) => impression.visitorId)
    ).size;

    const uniqueVisitors = new Set(impressions.map((impression) => impression.visitorId)).size;

    return {
      shown,
      completed,
      dismissed,
      uniqueVisitors,
      completionRate: shown > 0 ? (completed / shown) * 100 : 0,
      dismissRate: shown > 0 ? (dismissed / shown) * 100 : 0,
    };
  },
});

export const listActive = query({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const resolvedVisitorId = await resolveCarouselVisitorAccess(ctx, {
      workspaceId: args.workspaceId,
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
    });

    return await listEligibleCarousels(ctx, args.workspaceId, resolvedVisitorId);
  },
});

export const recordImpression = mutation({
  args: {
    carouselId: v.id("carousels"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    action: v.union(v.literal("shown"), v.literal("completed"), v.literal("dismissed")),
    screenIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await trackCarouselImpression(ctx, args);
  },
});
