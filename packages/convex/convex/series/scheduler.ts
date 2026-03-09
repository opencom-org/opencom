import { makeFunctionReference } from "convex/server";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { SeriesTriggerContext } from "./contracts";

export type SeriesEntryTriggerContext = SeriesTriggerContext;

export type SeriesEvaluateEntryResult = {
  entered: boolean;
  reason?: string;
  progressId?: Id<"seriesProgress">;
};

function getInternalRef(name: string): unknown {
  return makeFunctionReference(name);
}

function getShallowRunAfter(ctx: MutationCtx) {
  return ctx.scheduler.runAfter as unknown as (
    delayMs: number,
    functionRef: unknown,
    runArgs: Record<string, unknown>
  ) => Promise<unknown>;
}

function getShallowRunMutation(ctx: MutationCtx) {
  return ctx.runMutation as unknown as (
    mutationRef: unknown,
    mutationArgs: Record<string, unknown>
  ) => Promise<unknown>;
}

export async function scheduleSeriesEvaluateEnrollment(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    visitorId: Id<"visitors">;
    triggerContext: SeriesEntryTriggerContext;
  }
): Promise<void> {
  const runAfter = getShallowRunAfter(ctx);
  await runAfter(0, getInternalRef("series:evaluateEnrollmentForVisitor"), args);
}

export async function scheduleSeriesResumeWaitingForEvent(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    visitorId: Id<"visitors">;
    eventName: string;
  }
): Promise<void> {
  const runAfter = getShallowRunAfter(ctx);
  await runAfter(0, getInternalRef("series:resumeWaitingForEvent"), args);
}

export async function scheduleSeriesProcessProgress(
  ctx: MutationCtx,
  args: {
    delayMs: number;
    progressId: Id<"seriesProgress">;
  }
): Promise<void> {
  const runAfter = getShallowRunAfter(ctx);
  await runAfter(args.delayMs, getInternalRef("series:processProgress"), {
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
  const runMutation = getShallowRunMutation(ctx);
  return (await runMutation(getInternalRef("series:evaluateEntry"), args)) as SeriesEvaluateEntryResult;
}

export async function runSeriesEvaluateEnrollmentForVisitor(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    visitorId: Id<"visitors">;
    triggerContext: SeriesEntryTriggerContext;
  }
): Promise<unknown> {
  const runMutation = getShallowRunMutation(ctx);
  return await runMutation(getInternalRef("series:evaluateEnrollmentForVisitor"), args);
}

export async function runSeriesResumeWaitingForEvent(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    visitorId: Id<"visitors">;
    eventName: string;
  }
): Promise<unknown> {
  const runMutation = getShallowRunMutation(ctx);
  return await runMutation(getInternalRef("series:resumeWaitingForEvent"), args);
}

export async function runSeriesProcessWaitingProgress(
  ctx: MutationCtx,
  args: {
    seriesLimit?: number;
    waitingLimitPerSeries?: number;
  }
): Promise<unknown> {
  const runMutation = getShallowRunMutation(ctx);
  return await runMutation(getInternalRef("series:processWaitingProgress"), args);
}
