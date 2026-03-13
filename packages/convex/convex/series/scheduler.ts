import { makeFunctionReference, type FunctionReference } from "convex/server";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { SeriesTriggerContext } from "./contracts";

export type SeriesEntryTriggerContext = SeriesTriggerContext;

export type SeriesEvaluateEntryResult = {
  entered: boolean;
  reason?: string;
  progressId?: Id<"seriesProgress">;
};

type InternalMutationRef<
  Args extends Record<string, unknown>,
  Return = unknown,
> = FunctionReference<"mutation", "internal", Args, Return>;

type SeriesEvaluateEnrollmentArgs = {
  workspaceId: Id<"workspaces">;
  visitorId: Id<"visitors">;
  triggerContext: SeriesEntryTriggerContext;
};

type SeriesResumeWaitingForEventArgs = {
  workspaceId: Id<"workspaces">;
  visitorId: Id<"visitors">;
  eventName: string;
};

type SeriesProcessProgressArgs = {
  progressId: Id<"seriesProgress">;
  maxDepth?: number;
};

type SeriesEvaluateEntryArgs = {
  seriesId: Id<"series">;
  visitorId: Id<"visitors">;
  triggerContext?: SeriesEntryTriggerContext;
};

type SeriesProcessWaitingProgressArgs = {
  seriesLimit?: number;
  waitingLimitPerSeries?: number;
};

const EVALUATE_ENROLLMENT_FOR_VISITOR_REF = makeFunctionReference<
  "mutation",
  SeriesEvaluateEnrollmentArgs,
  unknown
>(
  "series:evaluateEnrollmentForVisitor"
) as unknown as InternalMutationRef<SeriesEvaluateEnrollmentArgs>;

const RESUME_WAITING_FOR_EVENT_REF = makeFunctionReference<
  "mutation",
  SeriesResumeWaitingForEventArgs,
  unknown
>(
  "series:resumeWaitingForEvent"
) as unknown as InternalMutationRef<SeriesResumeWaitingForEventArgs>;

const PROCESS_PROGRESS_REF = makeFunctionReference<"mutation", SeriesProcessProgressArgs, unknown>(
  "series:processProgress"
) as unknown as InternalMutationRef<SeriesProcessProgressArgs>;

const EVALUATE_ENTRY_REF = makeFunctionReference<
  "mutation",
  SeriesEvaluateEntryArgs,
  SeriesEvaluateEntryResult
>("series:evaluateEntry") as unknown as InternalMutationRef<
  SeriesEvaluateEntryArgs,
  SeriesEvaluateEntryResult
>;

const PROCESS_WAITING_PROGRESS_REF = makeFunctionReference<
  "mutation",
  SeriesProcessWaitingProgressArgs,
  unknown
>(
  "series:processWaitingProgress"
) as unknown as InternalMutationRef<SeriesProcessWaitingProgressArgs>;

function getShallowRunAfter(ctx: MutationCtx) {
  return ctx.scheduler.runAfter as <Args extends Record<string, unknown>, Return = unknown>(
    delayMs: number,
    functionRef: InternalMutationRef<Args, Return>,
    runArgs: Args
  ) => Promise<unknown>;
}

function getShallowRunMutation(ctx: MutationCtx) {
  return ctx.runMutation as <Args extends Record<string, unknown>, Return = unknown>(
    mutationRef: InternalMutationRef<Args, Return>,
    mutationArgs: Args
  ) => Promise<Return>;
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
  await runAfter(0, EVALUATE_ENROLLMENT_FOR_VISITOR_REF, args);
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
  await runAfter(0, RESUME_WAITING_FOR_EVENT_REF, args);
}

export async function scheduleSeriesProcessProgress(
  ctx: MutationCtx,
  args: {
    delayMs: number;
    progressId: Id<"seriesProgress">;
  }
): Promise<void> {
  const runAfter = getShallowRunAfter(ctx);
  await runAfter(args.delayMs, PROCESS_PROGRESS_REF, {
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
  return await runMutation(EVALUATE_ENTRY_REF, args);
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
  return await runMutation(EVALUATE_ENROLLMENT_FOR_VISITOR_REF, args);
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
  return await runMutation(RESUME_WAITING_FOR_EVENT_REF, args);
}

export async function runSeriesProcessWaitingProgress(
  ctx: MutationCtx,
  args: {
    seriesLimit?: number;
    waitingLimitPerSeries?: number;
  }
): Promise<unknown> {
  const runMutation = getShallowRunMutation(ctx);
  return await runMutation(PROCESS_WAITING_PROGRESS_REF, args);
}
