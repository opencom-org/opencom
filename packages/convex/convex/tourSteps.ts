import { v } from "convex/values";
import { authMutation, authQuery } from "./lib/authWrappers";
import { selectorQualityValidator } from "./validators";

type StepType = "pointer" | "post" | "video";
type AdvanceOn = "click" | "elementClick" | "fieldFill";

function validateStepConfig(args: {
  type: StepType;
  advanceOn: AdvanceOn;
  elementSelector?: string;
}) {
  const selector = args.elementSelector?.trim();
  const requiresSelector = args.type === "pointer" || args.type === "video";

  if (requiresSelector && !selector) {
    throw new Error("Element selector is required for pointer and video steps");
  }

  if ((args.advanceOn === "elementClick" || args.advanceOn === "fieldFill") && !selector) {
    throw new Error("Element selector is required for elementClick and fieldFill advancement");
  }
}

export const create = authMutation({
  args: {
    tourId: v.id("tours"),
    type: v.union(v.literal("pointer"), v.literal("post"), v.literal("video")),
    title: v.optional(v.string()),
    content: v.string(),
    elementSelector: v.optional(v.string()),
    position: v.optional(
      v.union(
        v.literal("auto"),
        v.literal("left"),
        v.literal("right"),
        v.literal("above"),
        v.literal("below")
      )
    ),
    size: v.optional(v.union(v.literal("small"), v.literal("large"))),
    advanceOn: v.optional(
      v.union(v.literal("click"), v.literal("elementClick"), v.literal("fieldFill"))
    ),
    routePath: v.optional(v.string()),
    selectorQuality: v.optional(selectorQualityValidator),
    customButtonText: v.optional(v.string()),
    mediaUrl: v.optional(v.string()),
    mediaType: v.optional(v.union(v.literal("image"), v.literal("video"))),
  },
  permission: "tours.manage",
  resolveWorkspaceId: async (ctx, args) => {
    const tour = await ctx.db.get(args.tourId);
    return tour?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const tour = await ctx.db.get(args.tourId);
    if (!tour) {
      throw new Error("Tour not found");
    }

    const normalizedSelector = args.elementSelector?.trim() || undefined;
    const normalizedRoutePath = args.routePath?.trim() || undefined;
    const advanceOn = (args.advanceOn ?? "click") as AdvanceOn;
    validateStepConfig({
      type: args.type as StepType,
      advanceOn,
      elementSelector: normalizedSelector,
    });

    // Get the highest order number for this tour
    const existingSteps = await ctx.db
      .query("tourSteps")
      .withIndex("by_tour", (q) => q.eq("tourId", args.tourId))
      .collect();

    const maxOrder = existingSteps.reduce((max, step) => Math.max(max, step.order), -1);
    const now = Date.now();

    const stepId = await ctx.db.insert("tourSteps", {
      workspaceId: tour.workspaceId,
      tourId: args.tourId,
      type: args.type,
      order: maxOrder + 1,
      title: args.title,
      content: args.content,
      elementSelector: normalizedSelector,
      position: args.position ?? "auto",
      size: args.size ?? "small",
      advanceOn,
      routePath: normalizedRoutePath,
      selectorQuality: args.selectorQuality,
      customButtonText: args.customButtonText,
      mediaUrl: args.mediaUrl,
      mediaType: args.mediaType,
      createdAt: now,
      updatedAt: now,
    });

    return stepId;
  },
});

export const update = authMutation({
  args: {
    id: v.id("tourSteps"),
    type: v.optional(v.union(v.literal("pointer"), v.literal("post"), v.literal("video"))),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    elementSelector: v.optional(v.string()),
    position: v.optional(
      v.union(
        v.literal("auto"),
        v.literal("left"),
        v.literal("right"),
        v.literal("above"),
        v.literal("below")
      )
    ),
    size: v.optional(v.union(v.literal("small"), v.literal("large"))),
    advanceOn: v.optional(
      v.union(v.literal("click"), v.literal("elementClick"), v.literal("fieldFill"))
    ),
    routePath: v.optional(v.string()),
    selectorQuality: v.optional(selectorQualityValidator),
    customButtonText: v.optional(v.string()),
    mediaUrl: v.optional(v.string()),
    mediaType: v.optional(v.union(v.literal("image"), v.literal("video"))),
  },
  permission: "tours.manage",
  resolveWorkspaceId: async (ctx, args) => {
    const step = await ctx.db.get(args.id);
    if (!step) {
      return null;
    }
    const tour = await ctx.db.get(step.tourId);
    return tour?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.id);
    if (!step) {
      throw new Error("Tour step not found");
    }

    const nextType = (args.type ?? step.type) as StepType;
    const nextAdvanceOn = (args.advanceOn ?? step.advanceOn ?? "click") as AdvanceOn;
    const nextSelector =
      args.elementSelector !== undefined
        ? args.elementSelector.trim() || undefined
        : step.elementSelector;

    validateStepConfig({
      type: nextType,
      advanceOn: nextAdvanceOn,
      elementSelector: nextSelector,
    });

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.type !== undefined) updates.type = args.type;
    if (args.title !== undefined) updates.title = args.title;
    if (args.content !== undefined) updates.content = args.content;
    if (args.elementSelector !== undefined) updates.elementSelector = nextSelector;
    if (args.position !== undefined) updates.position = args.position;
    if (args.size !== undefined) updates.size = args.size;
    if (args.advanceOn !== undefined) updates.advanceOn = args.advanceOn;
    if (args.routePath !== undefined) updates.routePath = args.routePath.trim() || undefined;
    if (args.selectorQuality !== undefined) updates.selectorQuality = args.selectorQuality;
    if (args.customButtonText !== undefined) updates.customButtonText = args.customButtonText;
    if (args.mediaUrl !== undefined) updates.mediaUrl = args.mediaUrl;
    if (args.mediaType !== undefined) updates.mediaType = args.mediaType;

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

export const remove = authMutation({
  args: {
    id: v.id("tourSteps"),
  },
  permission: "tours.manage",
  resolveWorkspaceId: async (ctx, args) => {
    const step = await ctx.db.get(args.id);
    if (!step) {
      return null;
    }
    const tour = await ctx.db.get(step.tourId);
    return tour?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const step = await ctx.db.get(args.id);
    if (!step) {
      throw new Error("Tour step not found");
    }

    // Reorder remaining steps
    const remainingSteps = await ctx.db
      .query("tourSteps")
      .withIndex("by_tour", (q) => q.eq("tourId", step.tourId))
      .collect();

    const stepsToReorder = remainingSteps
      .filter((s) => s._id !== args.id && s.order > step.order)
      .sort((a, b) => a.order - b.order);

    for (const s of stepsToReorder) {
      await ctx.db.patch(s._id, { order: s.order - 1 });
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const list = authQuery({
  args: {
    tourId: v.id("tours"),
  },
  permission: "tours.manage",
  resolveWorkspaceId: async (ctx, args) => {
    const tour = await ctx.db.get(args.tourId);
    return tour?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const steps = await ctx.db
      .query("tourSteps")
      .withIndex("by_tour", (q) => q.eq("tourId", args.tourId))
      .collect();

    return steps.sort((a, b) => a.order - b.order);
  },
});

export const reorder = authMutation({
  args: {
    tourId: v.id("tours"),
    stepIds: v.array(v.id("tourSteps")),
  },
  permission: "tours.manage",
  resolveWorkspaceId: async (ctx, args) => {
    const tour = await ctx.db.get(args.tourId);
    return tour?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const tour = await ctx.db.get(args.tourId);
    if (!tour) {
      throw new Error("Tour not found");
    }

    const now = Date.now();

    for (let i = 0; i < args.stepIds.length; i++) {
      await ctx.db.patch(args.stepIds[i], {
        order: i,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});
