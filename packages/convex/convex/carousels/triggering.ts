import { v } from "convex/values";
import { internal, api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { authAction, authMutation, authQuery } from "../lib/authWrappers";
import { evaluateRuleWithSegmentSupport } from "../audienceRules";
import { hasTerminalImpression } from "./helpers";

export const triggerForVisitors = authMutation({
  args: {
    carouselId: v.id("carousels"),
    visitorIds: v.array(v.id("visitors")),
  },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.carouselId)) as Doc<"carousels"> | null;
    return carousel?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.carouselId)) as Doc<"carousels"> | null;
    if (!carousel) {
      throw new Error("Carousel not found");
    }
    if (carousel.status !== "active") {
      throw new Error("Carousel must be active to trigger");
    }

    const now = Date.now();
    const triggered: Id<"visitors">[] = [];

    for (const visitorId of args.visitorIds) {
      const alreadyTerminal = await hasTerminalImpression(ctx, visitorId, args.carouselId);
      if (alreadyTerminal) {
        continue;
      }

      await ctx.db.insert("carouselImpressions", {
        carouselId: args.carouselId,
        visitorId,
        action: "shown",
        createdAt: now,
      });

      triggered.push(visitorId);
    }

    return { triggered: triggered.length, skipped: args.visitorIds.length - triggered.length };
  },
});

export const triggerForTargetedVisitors = authMutation({
  args: {
    carouselId: v.id("carousels"),
  },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.carouselId)) as Doc<"carousels"> | null;
    return carousel?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.carouselId)) as Doc<"carousels"> | null;
    if (!carousel) {
      throw new Error("Carousel not found");
    }
    if (carousel.status !== "active") {
      throw new Error("Carousel must be active to trigger");
    }

    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", carousel.workspaceId))
      .collect();

    const eligibleVisitorIds: Id<"visitors">[] = [];

    for (const visitor of visitors) {
      const audienceRules = carousel.audienceRules ?? carousel.targeting;
      if (audienceRules) {
        const matches = await evaluateRuleWithSegmentSupport(ctx, audienceRules, visitor);
        if (!matches) {
          continue;
        }
      }
      eligibleVisitorIds.push(visitor._id);
    }

    if (eligibleVisitorIds.length === 0) {
      return { triggered: 0, skipped: 0, message: "No visitors match targeting criteria" };
    }

    const now = Date.now();
    let triggered = 0;
    let skipped = 0;

    for (const visitorId of eligibleVisitorIds) {
      const alreadyTerminal = await hasTerminalImpression(ctx, visitorId, args.carouselId);
      if (alreadyTerminal) {
        skipped++;
        continue;
      }

      await ctx.db.insert("carouselImpressions", {
        carouselId: args.carouselId,
        visitorId,
        action: "shown",
        createdAt: now,
      });

      triggered++;
    }

    return { triggered, skipped };
  },
});

export const sendPushTrigger = authAction({
  args: {
    carouselId: v.id("carousels"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    sent: number;
    message?: string;
    failed?: number;
    error?: string;
    tickets?: Array<{ status: string; id?: string; error?: string }>;
  }> => {
    const carousel = await ctx.runQuery(api.carousels.get, { id: args.carouselId });
    if (!carousel) {
      throw new Error("Carousel not found");
    }
    if (carousel.status !== "active") {
      throw new Error("Carousel must be active to trigger");
    }

    const firstScreen = carousel.screens[0];
    const title = firstScreen?.title || carousel.name;
    const body = firstScreen?.body || "Check out this new content";

    const eligibleVisitors = await ctx.runQuery(api.carousels.getEligibleVisitorsWithPushTokens, {
      carouselId: args.carouselId,
    });

    if (eligibleVisitors.length === 0) {
      return { success: true, sent: 0, message: "No eligible visitors with push tokens" };
    }

    const visitorIds = Array.from(
      new Set(eligibleVisitors.map((visitor: { visitorId: Id<"visitors"> }) => visitor.visitorId))
    ) as Id<"visitors">[];

    const routed = await ctx.runMutation(internal.notifications.routeEvent, {
      eventType: "carousel_trigger",
      domain: "outbound",
      audience: "visitor",
      workspaceId: carousel.workspaceId,
      actorType: "system",
      title,
      body,
      data: {
        type: "carousel_trigger",
        carouselId: args.carouselId,
      },
      recipientVisitorIds: visitorIds,
      eventKey: `carousel_trigger:${args.carouselId}:${carousel.updatedAt}`,
    });

    return {
      success: true,
      sent: routed.scheduled,
      failed: 0,
      message: routed.scheduled === 0 ? "No eligible visitors with push tokens" : undefined,
    };
  },
});

export const getEligibleVisitorsWithPushTokens = authQuery({
  args: {
    carouselId: v.id("carousels"),
  },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.carouselId)) as Doc<"carousels"> | null;
    return carousel?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.carouselId)) as Doc<"carousels"> | null;
    if (!carousel) {
      return [];
    }

    const pushTokens = await ctx.db
      .query("visitorPushTokens")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", carousel.workspaceId))
      .collect();

    if (pushTokens.length === 0) {
      return [];
    }

    const visitorIds = [...new Set(pushTokens.map((token) => token.visitorId))];
    const eligibleVisitors: Array<{ visitorId: Id<"visitors">; token: string }> = [];

    for (const visitorId of visitorIds) {
      const visitor = (await ctx.db.get(visitorId)) as Doc<"visitors"> | null;
      if (!visitor) {
        continue;
      }

      const audienceRules = carousel.audienceRules ?? carousel.targeting;
      if (audienceRules) {
        const matches = await evaluateRuleWithSegmentSupport(ctx, audienceRules, visitor);
        if (!matches) {
          continue;
        }
      }

      const alreadyTerminal = await hasTerminalImpression(ctx, visitorId, args.carouselId);
      if (alreadyTerminal) {
        continue;
      }

      const visitorTokens = pushTokens.filter((token) => token.visitorId === visitorId);
      const latestToken = visitorTokens.sort((a, b) => b.updatedAt - a.updatedAt)[0];

      if (latestToken) {
        eligibleVisitors.push({
          visitorId,
          token: latestToken.token,
        });
      }
    }

    return eligibleVisitors;
  },
});
