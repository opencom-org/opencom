import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  advanceTourProgress,
  checkpointTourProgress,
  completeTourProgress,
  dismissTourPermanently,
  dismissTourProgress,
  restartTourProgress,
  skipTourStep,
  snoozeTourProgress,
  startTourProgress,
} from "./tourProgressMutations";
import {
  getActiveTourProgress,
  getAvailableTours as getAvailableToursQuery,
  listTourDiagnostics,
} from "./tourProgressQueries";
import { tourAdvanceModeValidator, tourDiagnosticReasonValidator } from "./validators";

const visitorAccessArgs = {
  workspaceId: v.id("workspaces"),
  visitorId: v.optional(v.id("visitors")),
  sessionToken: v.optional(v.string()),
};

const tourAccessArgs = {
  ...visitorAccessArgs,
  tourId: v.id("tours"),
};

export const start = mutation({
  args: {
    ...tourAccessArgs,
    force: v.optional(v.boolean()),
    currentUrl: v.optional(v.string()),
  },
  handler: startTourProgress,
});

export const advance = mutation({
  args: {
    ...tourAccessArgs,
    mode: v.optional(
      v.union(v.literal("click"), v.literal("elementClick"), v.literal("fieldFill"))
    ),
    targetMatched: v.optional(v.boolean()),
    fieldValue: v.optional(v.string()),
    selector: v.optional(v.string()),
    currentUrl: v.optional(v.string()),
  },
  handler: advanceTourProgress,
});

export const skipStep = mutation({
  args: {
    ...tourAccessArgs,
    reason: tourDiagnosticReasonValidator,
    selector: v.optional(v.string()),
    currentUrl: v.optional(v.string()),
  },
  handler: skipTourStep,
});

export const checkpoint = mutation({
  args: {
    ...tourAccessArgs,
    currentUrl: v.optional(v.string()),
    selector: v.optional(v.string()),
    blockedReason: v.optional(tourDiagnosticReasonValidator),
    mode: v.optional(tourAdvanceModeValidator),
  },
  handler: checkpointTourProgress,
});

export const complete = mutation({
  args: tourAccessArgs,
  handler: completeTourProgress,
});

export const dismiss = mutation({
  args: tourAccessArgs,
  handler: dismissTourProgress,
});

export const snooze = mutation({
  args: tourAccessArgs,
  handler: snoozeTourProgress,
});

export const restart = mutation({
  args: tourAccessArgs,
  handler: restartTourProgress,
});

export const getActive = query({
  args: visitorAccessArgs,
  handler: getActiveTourProgress,
});

export const getAvailableTours = query({
  args: {
    ...visitorAccessArgs,
    currentUrl: v.optional(v.string()),
  },
  handler: getAvailableToursQuery,
});

export const listDiagnostics = query({
  args: {
    ...tourAccessArgs,
    limit: v.optional(v.number()),
  },
  handler: listTourDiagnostics,
});

export const dismissPermanently = mutation({
  args: tourAccessArgs,
  handler: dismissTourPermanently,
});
