import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";

export type SeriesEntryTriggerContext = {
  source: "event" | "auto_event" | "visitor_attribute_changed" | "visitor_state_changed";
  eventName?: string;
  attributeKey?: string;
  fromValue?: string;
  toValue?: string;
};

export type SeriesEvaluateEntryResult = {
  entered: boolean;
  reason?: string;
  progressId?: Id<"seriesProgress">;
};

export async function scheduleSeriesEvaluateEnrollment(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    visitorId: Id<"visitors">;
    triggerContext: SeriesEntryTriggerContext;
  }
): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.series.evaluateEnrollmentForVisitor, args);
}

export async function scheduleSeriesResumeWaitingForEvent(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    visitorId: Id<"visitors">;
    eventName: string;
  }
): Promise<void> {
  await ctx.scheduler.runAfter(0, internal.series.resumeWaitingForEvent, args);
}

export async function scheduleSeriesProcessProgress(
  ctx: MutationCtx,
  args: {
    delayMs: number;
    progressId: Id<"seriesProgress">;
  }
): Promise<void> {
  await ctx.scheduler.runAfter(args.delayMs, internal.series.processProgress, {
    progressId: args.progressId,
  });
}

export async function runSeriesEvaluateEntry(
  ctx: MutationCtx,
  args: {
    seriesId: Id<"series">;
    visitorId: Id<"visitors">;
    triggerContext?: SeriesEntryTriggerContext;
  }
): Promise<SeriesEvaluateEntryResult> {
  return await ctx.runMutation(internal.series.evaluateEntry, args);
}
