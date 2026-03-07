import { evaluateRouteMatch } from "@opencom/types";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { evaluateRule, type AudienceRule } from "./audienceRules";
import {
  getTourInWorkspace,
  getVisitorTourProgress,
  resolveAuthorizedTourVisitor,
} from "./tourProgressAccess";
import { getOrderedTourSteps } from "./tourProgressShared";

type TourQueryArgs = {
  workspaceId: Id<"workspaces">;
  visitorId?: Id<"visitors">;
  sessionToken?: string;
};

type TourScopedQueryArgs = TourQueryArgs & {
  tourId: Id<"tours">;
};

function shouldIncludeActiveProgress(progress: Doc<"tourProgress">, now: number) {
  if (progress.status === "in_progress") {
    return true;
  }

  return (
    progress.status === "snoozed" &&
    progress.snoozedUntil !== undefined &&
    progress.snoozedUntil < now
  );
}

function shouldSkipAvailableTour(
  progress: Doc<"tourProgress"> | undefined,
  displayMode: "first_time_only" | "until_dismissed",
  now: number
) {
  const inProgress = progress?.status === "in_progress";

  if (displayMode === "first_time_only") {
    return Boolean(progress && !inProgress);
  }

  if (progress?.status === "dismissed") {
    return true;
  }

  return Boolean(
    progress?.status === "snoozed" &&
      progress.snoozedUntil !== undefined &&
      progress.snoozedUntil > now
  );
}

export async function getActiveTourProgress(ctx: QueryCtx, args: TourQueryArgs) {
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
  const activeProgress: Array<
    Doc<"tourProgress"> & {
      tour: Doc<"tours">;
      steps: Doc<"tourSteps">[];
    }
  > = [];

  for (const progress of allProgress) {
    if (!shouldIncludeActiveProgress(progress, now)) {
      continue;
    }

    const tour = (await ctx.db.get(progress.tourId)) as Doc<"tours"> | null;
    if (!tour || tour.status !== "active") {
      continue;
    }

    const steps = await getOrderedTourSteps(ctx, progress.tourId);
    activeProgress.push({
      ...progress,
      tour,
      steps,
    });
  }

  return activeProgress;
}

export type GetAvailableToursArgs = TourQueryArgs & {
  currentUrl?: string;
};

export async function getAvailableTours(ctx: QueryCtx, args: GetAvailableToursArgs) {
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

  const progressByTour = new Map(allProgress.map((progress) => [progress.tourId.toString(), progress]));
  const now = Date.now();
  const availableTours: Array<{
    tour: Doc<"tours">;
    steps: Doc<"tourSteps">[];
    progress: Doc<"tourProgress"> | undefined;
  }> = [];
  let visitor: Doc<"visitors"> | null | undefined;

  for (const tour of activeTours) {
    const progress = progressByTour.get(tour._id.toString());
    const displayMode = (tour.displayMode ?? "first_time_only") as
      | "first_time_only"
      | "until_dismissed";

    if (shouldSkipAvailableTour(progress, displayMode, now)) {
      continue;
    }

    if (progress?.status !== "in_progress" && tour.targetingRules?.pageUrl && args.currentUrl) {
      const routeMatch = evaluateRouteMatch(tour.targetingRules.pageUrl, args.currentUrl, {
        matchWhenCurrentUrlMissing: true,
      });
      if (!routeMatch.matches) {
        continue;
      }
    }

    if (tour.audienceRules) {
      if (visitor === undefined) {
        visitor = (await ctx.db.get(visitorId)) as Doc<"visitors"> | null;
      }
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

  availableTours.sort((left, right) => (left.tour.priority ?? 0) - (right.tour.priority ?? 0));

  return availableTours;
}

export type ListTourDiagnosticsArgs = TourScopedQueryArgs & {
  limit?: number;
};

export async function listTourDiagnostics(ctx: QueryCtx, args: ListTourDiagnosticsArgs) {
  await getTourInWorkspace(ctx, {
    workspaceId: args.workspaceId,
    tourId: args.tourId,
  });

  const visitorId = await resolveAuthorizedTourVisitor(ctx, {
    workspaceId: args.workspaceId,
    sessionToken: args.sessionToken,
    visitorId: args.visitorId,
  });

  const progress = await getVisitorTourProgress(ctx, {
    visitorId,
    tourId: args.tourId,
  });

  if (!progress) {
    return [];
  }

  const diagnostics = await ctx.db
    .query("tourProgressDiagnostics")
    .withIndex("by_progress", (q) => q.eq("progressId", progress._id))
    .collect();

  return diagnostics
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, Math.max(1, Math.min(args.limit ?? 25, 100)));
}
