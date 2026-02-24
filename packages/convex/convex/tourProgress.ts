import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { evaluateRule, AudienceRule } from "./audienceRules";
import { getAuthenticatedUserFromSession } from "./auth";
import { requirePermission } from "./permissions";
import { resolveVisitorFromSession } from "./widgetSessions";
import { tourAdvanceModeValidator, tourDiagnosticReasonValidator } from "./validators";

type VisitorAuthArgs = {
  workspaceId: Id<"workspaces">;
  sessionToken?: string;
  visitorId?: Id<"visitors">;
};

type AdvanceMode = "click" | "elementClick" | "fieldFill";
type DiagnosticMode = AdvanceMode | "system";
type DiagnosticReason =
  | "mode_mismatch"
  | "element_click_required"
  | "field_fill_required"
  | "field_fill_invalid"
  | "route_mismatch"
  | "checkpoint_invalid_route"
  | "selector_missing";

type ProgressContext = {
  tour: Doc<"tours">;
  visitorId: Id<"visitors">;
  progress: Doc<"tourProgress">;
  steps: Doc<"tourSteps">[];
};

function normalizeRoutePath(routePath?: string): string | undefined {
  const trimmed = routePath?.trim();
  return trimmed ? trimmed : undefined;
}

function safeParseUrl(url?: string): URL | null {
  if (!url) return null;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wildcardMatch(pattern: string, value: string): boolean {
  const regex = new RegExp(`^${escapeRegex(pattern).replace(/\\\*/g, ".*")}$`);
  return regex.test(value);
}

function evaluateRouteMatch(
  routePath: string | undefined,
  currentUrl?: string
): { matches: boolean; invalidRoute: boolean } {
  const normalizedRoute = normalizeRoutePath(routePath);
  if (!normalizedRoute) {
    return { matches: true, invalidRoute: false };
  }

  if (!currentUrl) {
    return { matches: true, invalidRoute: false };
  }

  const parsedCurrent = safeParseUrl(currentUrl);
  if (!parsedCurrent) {
    return { matches: false, invalidRoute: false };
  }

  const currentAbsolute = `${parsedCurrent.origin}${parsedCurrent.pathname}${parsedCurrent.search}`;
  const currentPath = `${parsedCurrent.pathname}${parsedCurrent.search}`;

  if (/^https?:\/\//i.test(normalizedRoute)) {
    const parsedRoute = safeParseUrl(normalizedRoute);
    if (!parsedRoute) {
      return { matches: false, invalidRoute: true };
    }

    const routeAbsolute = `${parsedRoute.origin}${parsedRoute.pathname}${parsedRoute.search}`;
    if (routeAbsolute.includes("*")) {
      return { matches: wildcardMatch(routeAbsolute, currentAbsolute), invalidRoute: false };
    }
    return { matches: routeAbsolute === currentAbsolute, invalidRoute: false };
  }

  if (normalizedRoute.startsWith("/")) {
    if (normalizedRoute.includes("*")) {
      return { matches: wildcardMatch(normalizedRoute, currentPath), invalidRoute: false };
    }
    return {
      matches: normalizedRoute === currentPath || normalizedRoute === parsedCurrent.pathname,
      invalidRoute: false,
    };
  }

  if (normalizedRoute.includes("*")) {
    return {
      matches:
        wildcardMatch(normalizedRoute, currentAbsolute) ||
        wildcardMatch(normalizedRoute, currentPath),
      invalidRoute: false,
    };
  }

  return {
    matches:
      normalizedRoute === currentAbsolute ||
      normalizedRoute === currentPath ||
      normalizedRoute === parsedCurrent.pathname,
    invalidRoute: false,
  };
}

function buildCheckpoint(currentStep: number, step?: Doc<"tourSteps">) {
  return {
    checkpointStep: step ? currentStep : undefined,
    checkpointRoute: normalizeRoutePath(step?.routePath),
    checkpointSelector: step?.elementSelector,
  };
}

async function getOrderedTourSteps(
  ctx: QueryCtx | MutationCtx,
  tourId: Id<"tours">
): Promise<Doc<"tourSteps">[]> {
  const steps = await ctx.db
    .query("tourSteps")
    .withIndex("by_tour", (q) => q.eq("tourId", tourId))
    .collect();

  return steps.sort((a, b) => a.order - b.order);
}

async function recordDiagnostic(
  ctx: MutationCtx,
  args: {
    progress: Doc<"tourProgress">;
    step?: Doc<"tourSteps">;
    reason: DiagnosticReason;
    mode: DiagnosticMode;
    currentUrl?: string;
    selector?: string;
    metadata?: Record<string, string | number | boolean | null>;
  }
) {
  await ctx.db.insert("tourProgressDiagnostics", {
    progressId: args.progress._id,
    tourId: args.progress.tourId,
    visitorId: args.progress.visitorId,
    stepOrder: args.step?.order ?? args.progress.currentStep,
    reason: args.reason,
    mode: args.mode,
    currentUrl: args.currentUrl,
    selector: args.selector ?? args.step?.elementSelector,
    metadata: args.metadata,
    createdAt: Date.now(),
  });
}

async function resolveAuthorizedTourVisitor(
  ctx: QueryCtx | MutationCtx,
  args: VisitorAuthArgs
): Promise<Id<"visitors">> {
  const authUser = await getAuthenticatedUserFromSession(ctx);
  if (authUser) {
    await requirePermission(ctx, authUser._id, args.workspaceId, "tours.manage");
    if (!args.visitorId) {
      throw new Error("visitorId is required for authenticated tour access");
    }
    const visitor = (await ctx.db.get(args.visitorId)) as Doc<"visitors"> | null;
    if (!visitor || visitor.workspaceId !== args.workspaceId) {
      throw new Error("Visitor not found in workspace");
    }
    return args.visitorId;
  }

  const resolved = await resolveVisitorFromSession(ctx, {
    sessionToken: args.sessionToken,
    workspaceId: args.workspaceId,
  });
  if (args.visitorId && args.visitorId !== resolved.visitorId) {
    throw new Error("Not authorized for requested visitor");
  }
  return resolved.visitorId;
}

async function loadProgressContext(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    visitorId?: Id<"visitors">;
    sessionToken?: string;
    tourId: Id<"tours">;
  }
): Promise<ProgressContext> {
  const tour = await ctx.db.get(args.tourId);
  if (!tour) {
    throw new Error("Tour not found");
  }
  if (tour.workspaceId !== args.workspaceId) {
    throw new Error("Tour does not belong to workspace");
  }

  const visitorId = await resolveAuthorizedTourVisitor(ctx, {
    workspaceId: args.workspaceId,
    sessionToken: args.sessionToken,
    visitorId: args.visitorId,
  });

  const progress = await ctx.db
    .query("tourProgress")
    .withIndex("by_visitor_tour", (q) => q.eq("visitorId", visitorId).eq("tourId", args.tourId))
    .first();

  if (!progress) {
    throw new Error("Tour progress not found");
  }

  const steps = await getOrderedTourSteps(ctx, args.tourId);

  return { tour, visitorId, progress, steps };
}

export const start = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    tourId: v.id("tours"),
    force: v.optional(v.boolean()),
    currentUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tour = await ctx.db.get(args.tourId);
    if (!tour) {
      throw new Error("Tour not found");
    }
    if (tour.workspaceId !== args.workspaceId) {
      throw new Error("Tour does not belong to workspace");
    }

    const visitorId = await resolveAuthorizedTourVisitor(ctx, {
      workspaceId: args.workspaceId,
      sessionToken: args.sessionToken,
      visitorId: args.visitorId,
    });

    const steps = await getOrderedTourSteps(ctx, args.tourId);

    const existing = await ctx.db
      .query("tourProgress")
      .withIndex("by_visitor_tour", (q) => q.eq("visitorId", visitorId).eq("tourId", args.tourId))
      .first();

    const now = Date.now();
    const firstStep = steps[0];

    if (existing) {
      if (
        args.force ||
        (existing.status === "snoozed" &&
          existing.snoozedUntil !== undefined &&
          existing.snoozedUntil < now)
      ) {
        await ctx.db.patch(existing._id, {
          status: "in_progress",
          currentStep: 0,
          ...buildCheckpoint(0, firstStep),
          lastSeenUrl: args.currentUrl,
          snoozedUntil: undefined,
          completedAt: undefined,
          lastBlockedReason: undefined,
          lastBlockedMode: undefined,
          lastBlockedAt: undefined,
          updatedAt: now,
        });
        return existing._id;
      }

      if (existing.status === "in_progress") {
        const currentStepDoc = steps[existing.currentStep];
        await ctx.db.patch(existing._id, {
          ...buildCheckpoint(existing.currentStep, currentStepDoc),
          lastSeenUrl: args.currentUrl,
          updatedAt: now,
        });
      }

      return existing._id;
    }

    const progressId = await ctx.db.insert("tourProgress", {
      visitorId,
      tourId: args.tourId,
      currentStep: 0,
      ...buildCheckpoint(0, firstStep),
      lastSeenUrl: args.currentUrl,
      status: "in_progress",
      createdAt: now,
      updatedAt: now,
    });

    return progressId;
  },
});

export const advance = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    tourId: v.id("tours"),
    mode: v.optional(
      v.union(v.literal("click"), v.literal("elementClick"), v.literal("fieldFill"))
    ),
    targetMatched: v.optional(v.boolean()),
    fieldValue: v.optional(v.string()),
    selector: v.optional(v.string()),
    currentUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { progress, steps } = await loadProgressContext(ctx, args);

    if (progress.status !== "in_progress") {
      throw new Error("Tour is not in progress");
    }

    const now = Date.now();
    const currentStep = steps[progress.currentStep];
    const mode = (args.mode ?? "click") as AdvanceMode;

    if (!currentStep) {
      await ctx.db.patch(progress._id, {
        status: "completed",
        completedAt: now,
        updatedAt: now,
        checkpointStep: undefined,
        checkpointRoute: undefined,
        checkpointSelector: undefined,
      });
      return {
        progressId: progress._id,
        advanced: true,
        status: "completed",
        nextStep: progress.currentStep,
      };
    }

    const routeMatch = evaluateRouteMatch(currentStep.routePath, args.currentUrl);
    const expectedMode = (currentStep.advanceOn ?? "click") as AdvanceMode;

    let blockedReason: DiagnosticReason | null = null;
    if (routeMatch.invalidRoute) {
      blockedReason = "checkpoint_invalid_route";
    } else if (!routeMatch.matches) {
      blockedReason = "route_mismatch";
    } else if (mode !== expectedMode) {
      blockedReason = "mode_mismatch";
    } else if (expectedMode === "elementClick" && !args.targetMatched) {
      blockedReason = "element_click_required";
    } else if (expectedMode === "fieldFill") {
      const normalizedValue = args.fieldValue?.trim() ?? "";
      if (!normalizedValue) {
        blockedReason = "field_fill_required";
      }
    }

    if (blockedReason) {
      await recordDiagnostic(ctx, {
        progress,
        step: currentStep,
        reason: blockedReason,
        mode,
        currentUrl: args.currentUrl,
        selector: args.selector,
        metadata: {
          expectedMode,
          providedMode: mode,
          targetMatched: args.targetMatched ?? null,
        },
      });

      await ctx.db.patch(progress._id, {
        ...buildCheckpoint(progress.currentStep, currentStep),
        lastSeenUrl: args.currentUrl,
        lastBlockedReason: blockedReason,
        lastBlockedMode: mode,
        lastBlockedAt: now,
        updatedAt: now,
      });

      return {
        progressId: progress._id,
        advanced: false,
        blockedReason,
        status: progress.status,
        nextStep: progress.currentStep,
      };
    }

    const nextStepIndex = progress.currentStep + 1;
    const nextStep = steps[nextStepIndex];

    if (!nextStep) {
      await ctx.db.patch(progress._id, {
        currentStep: nextStepIndex,
        status: "completed",
        completedAt: now,
        lastSeenUrl: args.currentUrl,
        checkpointStep: undefined,
        checkpointRoute: undefined,
        checkpointSelector: undefined,
        lastBlockedReason: undefined,
        lastBlockedMode: undefined,
        lastBlockedAt: undefined,
        updatedAt: now,
      });
      return {
        progressId: progress._id,
        advanced: true,
        blockedReason: null,
        status: "completed",
        nextStep: nextStepIndex,
      };
    }

    await ctx.db.patch(progress._id, {
      currentStep: nextStepIndex,
      ...buildCheckpoint(nextStepIndex, nextStep),
      lastSeenUrl: args.currentUrl,
      lastBlockedReason: undefined,
      lastBlockedMode: undefined,
      lastBlockedAt: undefined,
      updatedAt: now,
    });

    return {
      progressId: progress._id,
      advanced: true,
      blockedReason: null,
      status: "in_progress",
      nextStep: nextStepIndex,
    };
  },
});

export const skipStep = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    tourId: v.id("tours"),
    reason: tourDiagnosticReasonValidator,
    selector: v.optional(v.string()),
    currentUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { progress, steps } = await loadProgressContext(ctx, args);

    if (progress.status !== "in_progress") {
      throw new Error("Tour is not in progress");
    }

    const now = Date.now();
    const currentStep = steps[progress.currentStep];
    if (!currentStep) {
      throw new Error("Current step not found");
    }

    await recordDiagnostic(ctx, {
      progress,
      step: currentStep,
      reason: args.reason,
      mode: "system",
      currentUrl: args.currentUrl,
      selector: args.selector,
    });

    const nextStepIndex = progress.currentStep + 1;
    const nextStep = steps[nextStepIndex];

    if (!nextStep) {
      await ctx.db.patch(progress._id, {
        currentStep: nextStepIndex,
        status: "completed",
        completedAt: now,
        lastSeenUrl: args.currentUrl,
        checkpointStep: undefined,
        checkpointRoute: undefined,
        checkpointSelector: undefined,
        lastBlockedReason: args.reason,
        lastBlockedMode: "system",
        lastBlockedAt: now,
        updatedAt: now,
      });
      return {
        progressId: progress._id,
        skipped: true,
        reason: args.reason,
        status: "completed",
        nextStep: nextStepIndex,
      };
    }

    await ctx.db.patch(progress._id, {
      currentStep: nextStepIndex,
      ...buildCheckpoint(nextStepIndex, nextStep),
      lastSeenUrl: args.currentUrl,
      lastBlockedReason: args.reason,
      lastBlockedMode: "system",
      lastBlockedAt: now,
      updatedAt: now,
    });

    return {
      progressId: progress._id,
      skipped: true,
      reason: args.reason,
      status: "in_progress",
      nextStep: nextStepIndex,
    };
  },
});

export const checkpoint = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    tourId: v.id("tours"),
    currentUrl: v.optional(v.string()),
    selector: v.optional(v.string()),
    blockedReason: v.optional(tourDiagnosticReasonValidator),
    mode: v.optional(tourAdvanceModeValidator),
  },
  handler: async (ctx, args) => {
    const { progress, steps } = await loadProgressContext(ctx, args);

    if (progress.status !== "in_progress") {
      throw new Error("Tour is not in progress");
    }

    const currentStep = steps[progress.currentStep];
    if (!currentStep) {
      throw new Error("Current step not found");
    }

    const now = Date.now();

    if (args.blockedReason) {
      await recordDiagnostic(ctx, {
        progress,
        step: currentStep,
        reason: args.blockedReason,
        mode: (args.mode as DiagnosticMode | undefined) ?? "system",
        currentUrl: args.currentUrl,
        selector: args.selector,
      });
    }

    await ctx.db.patch(progress._id, {
      ...buildCheckpoint(progress.currentStep, currentStep),
      lastSeenUrl: args.currentUrl,
      lastBlockedReason: args.blockedReason,
      lastBlockedMode: args.blockedReason
        ? ((args.mode as DiagnosticMode | undefined) ?? "system")
        : undefined,
      lastBlockedAt: args.blockedReason ? now : undefined,
      updatedAt: now,
    });

    return { progressId: progress._id };
  },
});

export const complete = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    tourId: v.id("tours"),
  },
  handler: async (ctx, args) => {
    const { progress } = await loadProgressContext(ctx, args);

    const now = Date.now();
    await ctx.db.patch(progress._id, {
      status: "completed",
      completedAt: now,
      checkpointStep: undefined,
      checkpointRoute: undefined,
      checkpointSelector: undefined,
      updatedAt: now,
    });

    return progress._id;
  },
});

export const dismiss = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    tourId: v.id("tours"),
  },
  handler: async (ctx, args) => {
    const { progress } = await loadProgressContext(ctx, args);

    await ctx.db.patch(progress._id, {
      status: "dismissed",
      checkpointStep: undefined,
      checkpointRoute: undefined,
      checkpointSelector: undefined,
      updatedAt: Date.now(),
    });

    return progress._id;
  },
});

export const snooze = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    tourId: v.id("tours"),
  },
  handler: async (ctx, args) => {
    const { progress } = await loadProgressContext(ctx, args);

    const now = Date.now();
    const snoozedUntil = now + 24 * 60 * 60 * 1000;

    await ctx.db.patch(progress._id, {
      status: "snoozed",
      snoozedUntil,
      updatedAt: now,
    });

    return progress._id;
  },
});

export const restart = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    tourId: v.id("tours"),
  },
  handler: async (ctx, args) => {
    const { progress, steps } = await loadProgressContext(ctx, args);

    await ctx.db.patch(progress._id, {
      currentStep: 0,
      status: "in_progress",
      ...buildCheckpoint(0, steps[0]),
      completedAt: undefined,
      snoozedUntil: undefined,
      lastBlockedReason: undefined,
      lastBlockedMode: undefined,
      lastBlockedAt: undefined,
      updatedAt: Date.now(),
    });

    return progress._id;
  },
});

export const getActive = query({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const visitorId = await resolveAuthorizedTourVisitor(ctx, {
      workspaceId: args.workspaceId,
      sessionToken: args.sessionToken,
      visitorId: args.visitorId,
    });

    const allProgress = await ctx.db
      .query("tourProgress")
      .withIndex("by_visitor", (q) => q.eq("visitorId", visitorId))
      .collect();

    const now = Date.now();
    type ActiveProgressItem = Doc<"tourProgress"> & {
      tour: Doc<"tours">;
      steps: Doc<"tourSteps">[];
      currentStep: number;
    };
    const activeProgress: ActiveProgressItem[] = [];

    for (const progress of allProgress) {
      if (progress.status === "in_progress") {
        const tour = (await ctx.db.get(progress.tourId)) as Doc<"tours"> | null;
        if (tour && tour.status === "active") {
          const steps = await getOrderedTourSteps(ctx, progress.tourId);
          activeProgress.push({
            ...progress,
            tour,
            steps,
          });
        }
      }

      if (progress.status === "snoozed" && progress.snoozedUntil && progress.snoozedUntil < now) {
        const tour = (await ctx.db.get(progress.tourId)) as Doc<"tours"> | null;
        if (tour && tour.status === "active") {
          const steps = await getOrderedTourSteps(ctx, progress.tourId);
          activeProgress.push({
            ...progress,
            tour,
            steps,
          });
        }
      }
    }

    return activeProgress;
  },
});

export const getAvailableTours = query({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    currentUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const visitorId = await resolveAuthorizedTourVisitor(ctx, {
      workspaceId: args.workspaceId,
      sessionToken: args.sessionToken,
      visitorId: args.visitorId,
    });

    const activeTours = await ctx.db
      .query("tours")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "active")
      )
      .collect();

    const allProgress = await ctx.db
      .query("tourProgress")
      .withIndex("by_visitor", (q) => q.eq("visitorId", visitorId))
      .collect();

    const progressByTour = new Map(allProgress.map((p) => [p.tourId.toString(), p]));
    const now = Date.now();
    type AvailableTourItem = {
      tour: Doc<"tours">;
      steps: Doc<"tourSteps">[];
      progress: Doc<"tourProgress"> | undefined;
    };
    const availableTours: AvailableTourItem[] = [];

    for (const tour of activeTours) {
      const progress = progressByTour.get(tour._id.toString());
      const displayMode = tour.displayMode ?? "first_time_only";
      const inProgress = progress?.status === "in_progress";

      if (displayMode === "first_time_only") {
        if (progress && !inProgress) {
          continue;
        }
      } else if (displayMode === "until_dismissed") {
        if (progress?.status === "dismissed") {
          continue;
        }
        if (
          progress?.status === "snoozed" &&
          progress.snoozedUntil &&
          progress.snoozedUntil > now
        ) {
          continue;
        }
      }

      if (!inProgress && tour.targetingRules?.pageUrl && args.currentUrl) {
        const routeMatch = evaluateRouteMatch(tour.targetingRules.pageUrl, args.currentUrl);
        if (!routeMatch.matches) {
          continue;
        }
      }

      if (tour.audienceRules) {
        const visitor = await ctx.db.get(visitorId);
        if (!visitor) {
          continue;
        }
        const matches = await evaluateRule(ctx, tour.audienceRules as AudienceRule, visitor);
        if (!matches) {
          continue;
        }
      }

      const steps = await getOrderedTourSteps(ctx, tour._id);

      availableTours.push({
        tour,
        steps,
        progress,
      });
    }

    availableTours.sort((a, b) => (a.tour.priority ?? 0) - (b.tour.priority ?? 0));

    return availableTours;
  },
});

export const listDiagnostics = query({
  args: {
    workspaceId: v.id("workspaces"),
    tourId: v.id("tours"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const tour = await ctx.db.get(args.tourId);
    if (!tour) {
      throw new Error("Tour not found");
    }
    if (tour.workspaceId !== args.workspaceId) {
      throw new Error("Tour does not belong to workspace");
    }

    const visitorId = await resolveAuthorizedTourVisitor(ctx, {
      workspaceId: args.workspaceId,
      sessionToken: args.sessionToken,
      visitorId: args.visitorId,
    });

    const progress = await ctx.db
      .query("tourProgress")
      .withIndex("by_visitor_tour", (q) => q.eq("visitorId", visitorId).eq("tourId", args.tourId))
      .first();

    if (!progress) {
      return [];
    }

    const diagnostics = await ctx.db
      .query("tourProgressDiagnostics")
      .withIndex("by_progress", (q) => q.eq("progressId", progress._id))
      .collect();

    return diagnostics
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, Math.max(1, Math.min(args.limit ?? 25, 100)));
  },
});

export const dismissPermanently = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    tourId: v.id("tours"),
  },
  handler: async (ctx, args) => {
    const tour = await ctx.db.get(args.tourId);
    if (!tour) {
      throw new Error("Tour not found");
    }
    if (tour.workspaceId !== args.workspaceId) {
      throw new Error("Tour does not belong to workspace");
    }
    const visitorId = await resolveAuthorizedTourVisitor(ctx, {
      workspaceId: args.workspaceId,
      sessionToken: args.sessionToken,
      visitorId: args.visitorId,
    });

    const progress = await ctx.db
      .query("tourProgress")
      .withIndex("by_visitor_tour", (q) => q.eq("visitorId", visitorId).eq("tourId", args.tourId))
      .first();

    const now = Date.now();

    if (progress) {
      await ctx.db.patch(progress._id, {
        status: "dismissed",
        checkpointStep: undefined,
        checkpointRoute: undefined,
        checkpointSelector: undefined,
        updatedAt: now,
      });
      return progress._id;
    }

    const progressId = await ctx.db.insert("tourProgress", {
      visitorId,
      tourId: args.tourId,
      currentStep: 0,
      status: "dismissed",
      createdAt: now,
      updatedAt: now,
    });
    return progressId;
  },
});
