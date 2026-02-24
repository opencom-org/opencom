import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { countMatchingVisitors, AudienceRule, validateAudienceRule } from "./audienceRules";
import { getAuthenticatedUserFromSession } from "./auth";
import { requirePermission } from "./permissions";
import { createError } from "./utils/errors";
import { resolveVisitorFromSession } from "./widgetSessions";
import { audienceRulesOrSegmentValidator, targetingRulesValidator } from "./validators";
import { authMutation, authQuery } from "./lib/authWrappers";

type TourListAccessResult =
  | { accessType: "agent"; visitorId?: Id<"visitors"> }
  | { accessType: "visitor"; visitorId: Id<"visitors"> };

async function requireTourListAccess(
  ctx: QueryCtx,
  args: {
    workspaceId: Id<"workspaces">;
    visitorId?: Id<"visitors">;
    sessionToken?: string;
  }
): Promise<TourListAccessResult> {
  const authUser = await getAuthenticatedUserFromSession(ctx);
  if (authUser) {
    await requirePermission(ctx, authUser._id, args.workspaceId, "tours.manage");
    return { accessType: "agent", visitorId: args.visitorId };
  }

  const resolved = await resolveVisitorFromSession(ctx, {
    sessionToken: args.sessionToken,
    workspaceId: args.workspaceId,
  });
  if (args.visitorId && args.visitorId !== resolved.visitorId) {
    throw new Error("Not authorized to list tours for this visitor");
  }

  return { accessType: "visitor", visitorId: resolved.visitorId };
}

export const create = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    targetingRules: v.optional(targetingRulesValidator),
    audienceRules: v.optional(audienceRulesOrSegmentValidator),
    displayMode: v.optional(v.union(v.literal("first_time_only"), v.literal("until_dismissed"))),
    priority: v.optional(v.number()),
    buttonColor: v.optional(v.string()),
    senderId: v.optional(v.id("users")),
    showConfetti: v.optional(v.boolean()),
    allowSnooze: v.optional(v.boolean()),
    allowRestart: v.optional(v.boolean()),
  },
  permission: "tours.manage",
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
      throw createError("INVALID_INPUT", "Invalid audience rules");
    }

    const now = Date.now();

    const tourId = await ctx.db.insert("tours", {
      workspaceId: args.workspaceId,
      name: args.name,
      description: args.description,
      status: "draft",
      targetingRules: args.targetingRules,
      audienceRules: args.audienceRules,
      displayMode: args.displayMode ?? "first_time_only",
      priority: args.priority ?? 0,
      buttonColor: args.buttonColor,
      senderId: args.senderId,
      showConfetti: args.showConfetti ?? true,
      allowSnooze: args.allowSnooze ?? true,
      allowRestart: args.allowRestart ?? true,
      createdAt: now,
      updatedAt: now,
    });

    return tourId;
  },
});

export const update = authMutation({
  args: {
    id: v.id("tours"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    targetingRules: v.optional(targetingRulesValidator),
    audienceRules: v.optional(audienceRulesOrSegmentValidator),
    displayMode: v.optional(v.union(v.literal("first_time_only"), v.literal("until_dismissed"))),
    priority: v.optional(v.number()),
    buttonColor: v.optional(v.string()),
    senderId: v.optional(v.id("users")),
    showConfetti: v.optional(v.boolean()),
    allowSnooze: v.optional(v.boolean()),
    allowRestart: v.optional(v.boolean()),
  },
  permission: "tours.manage",
  resolveWorkspaceId: async (ctx, args) => {
    const tour = await ctx.db.get(args.id);
    return tour?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const tour = await ctx.db.get(args.id);
    if (!tour) {
      throw createError("NOT_FOUND", "Tour not found");
    }

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
      throw createError("INVALID_INPUT", "Invalid audience rules");
    }

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.targetingRules !== undefined) updates.targetingRules = args.targetingRules;
    if (args.audienceRules !== undefined) updates.audienceRules = args.audienceRules;
    if (args.displayMode !== undefined) updates.displayMode = args.displayMode;
    if (args.priority !== undefined) updates.priority = args.priority;
    if (args.buttonColor !== undefined) updates.buttonColor = args.buttonColor;
    if (args.senderId !== undefined) updates.senderId = args.senderId;
    if (args.showConfetti !== undefined) updates.showConfetti = args.showConfetti;
    if (args.allowSnooze !== undefined) updates.allowSnooze = args.allowSnooze;
    if (args.allowRestart !== undefined) updates.allowRestart = args.allowRestart;

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

export const remove = authMutation({
  args: {
    id: v.id("tours"),
  },
  permission: "tours.manage",
  resolveWorkspaceId: async (ctx, args) => {
    const tour = await ctx.db.get(args.id);
    return tour?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const tour = await ctx.db.get(args.id);
    if (!tour) {
      throw createError("NOT_FOUND", "Tour not found");
    }

    // Delete all steps associated with this tour
    const steps = await ctx.db
      .query("tourSteps")
      .withIndex("by_tour", (q) => q.eq("tourId", args.id))
      .collect();

    for (const step of steps) {
      await ctx.db.delete(step._id);
    }

    // Delete all progress records for this tour
    const progress = await ctx.db
      .query("tourProgress")
      .withIndex("by_tour", (q) => q.eq("tourId", args.id))
      .collect();

    for (const p of progress) {
      await ctx.db.delete(p._id);
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const get = authQuery({
  args: {
    id: v.id("tours"),
  },
  permission: "tours.manage",
  allowMissingWorkspace: true,
  resolveWorkspaceId: async (ctx, args) => {
    const tour = await ctx.db.get(args.id);
    return tour?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const tour = await ctx.db.get(args.id);
    if (!tour) {
      return null;
    }
    return tour;
  },
});

export const list = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(v.union(v.literal("draft"), v.literal("active"), v.literal("archived"))),
  },
  permission: "tours.manage",
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("tours")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", args.status!)
        )
        .collect();
    }

    return await ctx.db
      .query("tours")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
  },
});

export const listAll = query({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireTourListAccess(ctx, args);
    const resolvedVisitorId = access.visitorId;

    if (resolvedVisitorId) {
      const visitor = await ctx.db.get(resolvedVisitorId);
      if (!visitor || visitor.workspaceId !== args.workspaceId) {
        throw new Error("Visitor not found in workspace");
      }
    }

    // Get all active tours for the workspace (ignores displayMode)
    const activeTours = await ctx.db
      .query("tours")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "active")
      )
      .collect();

    // Get visitor's progress if visitorId provided
    let progressByTour = new Map<string, { status: string; currentStep: number }>();
    if (resolvedVisitorId) {
      const allProgress = await ctx.db
        .query("tourProgress")
        .withIndex("by_visitor", (q) => q.eq("visitorId", resolvedVisitorId!))
        .collect();
      progressByTour = new Map(
        allProgress.map((p) => [
          p.tourId.toString(),
          { status: p.status, currentStep: p.currentStep },
        ])
      );
    }

    const workspaceSteps = await ctx.db
      .query("tourSteps")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const stepsByTour = new Map<string, Doc<"tourSteps">[]>();
    for (const step of workspaceSteps) {
      const key = step.tourId.toString();
      const existingSteps = stepsByTour.get(key) ?? [];
      existingSteps.push(step);
      stepsByTour.set(key, existingSteps);
    }

    for (const steps of stepsByTour.values()) {
      steps.sort((a, b) => a.order - b.order);
    }

    const toursMissingStepMetadata = activeTours.filter(
      (tour) => !stepsByTour.has(tour._id.toString())
    );
    if (toursMissingStepMetadata.length > 0) {
      const legacyEntries = await Promise.all(
        toursMissingStepMetadata.map(async (tour) => {
          const steps = await ctx.db
            .query("tourSteps")
            .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
            .collect();
          steps.sort((a, b) => a.order - b.order);
          return [tour._id.toString(), steps] as const;
        })
      );
      for (const [tourId, steps] of legacyEntries) {
        stepsByTour.set(tourId, steps);
      }
    }

    type TourWithDetails = {
      tour: Doc<"tours">;
      steps: Doc<"tourSteps">[];
      tourStatus: "new" | "in_progress" | "completed";
      elementSelectors: string[];
    };
    const toursWithDetails: TourWithDetails[] = [];
    for (const tour of activeTours) {
      const steps = stepsByTour.get(tour._id.toString()) ?? [];
      const progress = progressByTour.get(tour._id.toString());

      // Determine tour status for display
      let tourStatus: "new" | "in_progress" | "completed" = "new";
      if (progress) {
        if (progress.status === "completed") {
          tourStatus = "completed";
        } else if (progress.status === "in_progress") {
          tourStatus = "in_progress";
        }
      }

      toursWithDetails.push({
        tour,
        steps,
        tourStatus,
        elementSelectors: steps.map((s) => s.elementSelector).filter(Boolean) as string[],
      });
    }

    // Sort by priority (ascending - lower number = higher priority)
    toursWithDetails.sort((a, b) => (a.tour.priority ?? 0) - (b.tour.priority ?? 0));

    return toursWithDetails;
  },
});

export const activate = authMutation({
  args: {
    id: v.id("tours"),
  },
  permission: "tours.manage",
  resolveWorkspaceId: async (ctx, args) => {
    const tour = await ctx.db.get(args.id);
    return tour?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const tour = await ctx.db.get(args.id);
    if (!tour) {
      throw createError("NOT_FOUND", "Tour not found");
    }

    await ctx.db.patch(args.id, {
      status: "active",
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const deactivate = authMutation({
  args: {
    id: v.id("tours"),
  },
  permission: "tours.manage",
  resolveWorkspaceId: async (ctx, args) => {
    const tour = await ctx.db.get(args.id);
    return tour?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const tour = await ctx.db.get(args.id);
    if (!tour) {
      throw createError("NOT_FOUND", "Tour not found");
    }

    await ctx.db.patch(args.id, {
      status: "draft",
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const duplicate = authMutation({
  args: {
    id: v.id("tours"),
  },
  permission: "tours.manage",
  resolveWorkspaceId: async (ctx, args) => {
    const tour = await ctx.db.get(args.id);
    return tour?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const tour = await ctx.db.get(args.id);
    if (!tour) {
      throw createError("NOT_FOUND", "Tour not found");
    }

    const now = Date.now();

    // Create new tour with copied settings
    const newTourId = await ctx.db.insert("tours", {
      workspaceId: tour.workspaceId,
      name: `${tour.name} (Copy)`,
      description: tour.description,
      status: "draft",
      targetingRules: tour.targetingRules,
      audienceRules: tour.audienceRules,
      displayMode: tour.displayMode,
      priority: tour.priority,
      buttonColor: tour.buttonColor,
      senderId: tour.senderId,
      showConfetti: tour.showConfetti,
      allowSnooze: tour.allowSnooze,
      allowRestart: tour.allowRestart,
      createdAt: now,
      updatedAt: now,
    });

    // Copy all steps
    const steps = await ctx.db
      .query("tourSteps")
      .withIndex("by_tour", (q) => q.eq("tourId", args.id))
      .collect();

    for (const step of steps) {
      await ctx.db.insert("tourSteps", {
        workspaceId: tour.workspaceId,
        tourId: newTourId,
        type: step.type,
        order: step.order,
        title: step.title,
        content: step.content,
        elementSelector: step.elementSelector,
        position: step.position,
        size: step.size,
        advanceOn: step.advanceOn,
        customButtonText: step.customButtonText,
        mediaUrl: step.mediaUrl,
        mediaType: step.mediaType,
        createdAt: now,
        updatedAt: now,
      });
    }

    return newTourId;
  },
});

export const previewAudienceRules = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    audienceRules: v.optional(audienceRulesOrSegmentValidator),
  },
  permission: "tours.manage",
  handler: async (ctx, args) => {
    return await countMatchingVisitors(
      ctx,
      args.workspaceId,
      args.audienceRules as AudienceRule | undefined
    );
  },
});
