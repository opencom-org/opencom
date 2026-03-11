import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getAuthenticatedUserFromSession } from "./auth";
import { requirePermission } from "./permissions";
import { getOrderedTourSteps, type ProgressContext, type VisitorAuthArgs } from "./tourProgressShared";
import { resolveVisitorFromSession } from "./widgetSessions";

export async function getTourInWorkspace(
  ctx: QueryCtx | MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    tourId: Id<"tours">;
  }
): Promise<Doc<"tours">> {
  const tour = (await ctx.db.get(args.tourId)) as Doc<"tours"> | null;
  if (!tour) {
    throw new Error("Tour not found");
  }
  if (tour.workspaceId !== args.workspaceId) {
    throw new Error("Tour does not belong to workspace");
  }
  return tour;
}

export async function resolveAuthorizedTourVisitor(
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

export async function getVisitorTourProgress(
  ctx: QueryCtx | MutationCtx,
  args: {
    visitorId: Id<"visitors">;
    tourId: Id<"tours">;
  }
): Promise<Doc<"tourProgress"> | null> {
  return await ctx.db
    .query("tourProgress")
    .withIndex("by_visitor_tour", (q) => q.eq("visitorId", args.visitorId).eq("tourId", args.tourId))
    .first();
}

export async function loadProgressContext(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    visitorId?: Id<"visitors">;
    sessionToken?: string;
    tourId: Id<"tours">;
  }
): Promise<ProgressContext> {
  const tour = await getTourInWorkspace(ctx, {
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
    throw new Error("Tour progress not found");
  }

  const steps = await getOrderedTourSteps(ctx, args.tourId);

  return { tour, visitorId, progress, steps };
}
