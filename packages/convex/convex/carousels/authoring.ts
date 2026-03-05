import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { validateAudienceRule } from "../audienceRules";
import { authMutation, authQuery } from "../lib/authWrappers";
import { audienceRulesOrSegmentValidator } from "../validators";
import {
  assertValidStatusTransition,
  normalizeCarouselScreens,
  validateCarouselScreens,
  type CarouselScreen,
} from "./helpers";

const screenValidator = v.object({
  id: v.string(),
  title: v.optional(v.string()),
  body: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  buttons: v.optional(
    v.array(
      v.object({
        text: v.string(),
        action: v.union(
          v.literal("url"),
          v.literal("dismiss"),
          v.literal("next"),
          v.literal("deeplink")
        ),
        url: v.optional(v.string()),
        deepLink: v.optional(v.string()),
      })
    )
  ),
});

export const create = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    screens: v.array(screenValidator),
    targeting: v.optional(audienceRulesOrSegmentValidator),
    priority: v.optional(v.number()),
  },
  permission: "settings.workspace",
  handler: async (ctx, args) => {
    const hasSegmentReference =
      typeof args.targeting === "object" &&
      args.targeting !== null &&
      "segmentId" in args.targeting;
    if (
      args.targeting !== undefined &&
      !hasSegmentReference &&
      !validateAudienceRule(args.targeting)
    ) {
      throw new Error("Invalid targeting rules");
    }

    const normalizedName = args.name.trim();
    if (!normalizedName) {
      throw new Error("Carousel name is required.");
    }

    const validatedScreens = validateCarouselScreens(args.screens);

    const now = Date.now();
    return await ctx.db.insert("carousels", {
      workspaceId: args.workspaceId,
      name: normalizedName,
      screens: validatedScreens,
      targeting: args.targeting,
      priority: args.priority,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = authMutation({
  args: {
    id: v.id("carousels"),
    name: v.optional(v.string()),
    screens: v.optional(v.array(screenValidator)),
    targeting: v.optional(audienceRulesOrSegmentValidator),
    priority: v.optional(v.number()),
  },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    return carousel?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = (await ctx.db.get(id)) as Doc<"carousels"> | null;
    if (!existing) {
      throw new Error("Carousel not found");
    }

    const hasSegmentReference =
      typeof args.targeting === "object" &&
      args.targeting !== null &&
      "segmentId" in args.targeting;
    if (
      args.targeting !== undefined &&
      !hasSegmentReference &&
      !validateAudienceRule(args.targeting)
    ) {
      throw new Error("Invalid targeting rules");
    }

    const normalizedUpdates: {
      name?: string;
      screens?: CarouselScreen[];
      targeting?: typeof args.targeting;
      priority?: number;
    } = {
      ...updates,
    };

    if (typeof args.name === "string") {
      const normalizedName = args.name.trim();
      if (!normalizedName) {
        throw new Error("Carousel name is required.");
      }
      normalizedUpdates.name = normalizedName;
    }

    if (args.screens !== undefined) {
      normalizedUpdates.screens = validateCarouselScreens(args.screens);
    } else {
      const normalizedExistingScreens = normalizeCarouselScreens(existing.screens);
      if (JSON.stringify(existing.screens) !== JSON.stringify(normalizedExistingScreens)) {
        normalizedUpdates.screens = validateCarouselScreens(normalizedExistingScreens);
      }
    }

    await ctx.db.patch(id, {
      ...normalizedUpdates,
      updatedAt: Date.now(),
    });
    return id;
  },
});

export const list = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(
      v.union(v.literal("draft"), v.literal("active"), v.literal("paused"), v.literal("archived"))
    ),
  },
  permission: "settings.workspace",
  handler: async (ctx, args) => {
    let carousels;

    if (args.status) {
      carousels = await ctx.db
        .query("carousels")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", args.status!)
        )
        .collect();
    } else {
      carousels = await ctx.db
        .query("carousels")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect();
    }

    return carousels
      .map((carousel) => ({
        ...carousel,
        screens: normalizeCarouselScreens(carousel.screens),
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const get = authQuery({
  args: { id: v.id("carousels") },
  permission: "settings.workspace",
  allowMissingWorkspace: true,
  resolveWorkspaceId: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    return carousel?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const carousel = await ctx.db.get(args.id);
    if (!carousel) {
      return null;
    }
    return {
      ...carousel,
      screens: normalizeCarouselScreens(carousel.screens),
    };
  },
});

export const remove = authMutation({
  args: { id: v.id("carousels") },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    return carousel?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    if (!carousel) {
      throw new Error("Carousel not found");
    }

    const impressions = await ctx.db
      .query("carouselImpressions")
      .withIndex("by_carousel", (q) => q.eq("carouselId", args.id))
      .collect();

    for (const impression of impressions) {
      await ctx.db.delete(impression._id);
    }

    await ctx.db.delete(args.id);
  },
});

export const activate = authMutation({
  args: { id: v.id("carousels") },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    return carousel?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    if (!carousel) {
      throw new Error("Carousel not found");
    }
    assertValidStatusTransition(carousel.status, "active");
    validateCarouselScreens(carousel.screens);

    await ctx.db.patch(args.id, { status: "active", updatedAt: Date.now() });
  },
});

export const pause = authMutation({
  args: { id: v.id("carousels") },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    return carousel?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    if (!carousel) {
      throw new Error("Carousel not found");
    }
    assertValidStatusTransition(carousel.status, "paused");

    await ctx.db.patch(args.id, { status: "paused", updatedAt: Date.now() });
  },
});

export const archive = authMutation({
  args: { id: v.id("carousels") },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    return carousel?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    if (!carousel) {
      throw new Error("Carousel not found");
    }
    assertValidStatusTransition(carousel.status, "archived");

    await ctx.db.patch(args.id, { status: "archived", updatedAt: Date.now() });
  },
});

export const duplicate = authMutation({
  args: { id: v.id("carousels") },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    return carousel?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const carousel = (await ctx.db.get(args.id)) as Doc<"carousels"> | null;
    if (!carousel) {
      throw new Error("Carousel not found");
    }

    const normalizedScreens = normalizeCarouselScreens(carousel.screens);
    const validatedScreens = validateCarouselScreens(normalizedScreens);

    const now = Date.now();
    return await ctx.db.insert("carousels", {
      workspaceId: carousel.workspaceId,
      name: `${carousel.name} (Copy)`,
      screens: validatedScreens,
      targeting: carousel.targeting,
      priority: carousel.priority,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});
