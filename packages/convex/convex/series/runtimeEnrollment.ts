import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { evaluateRule, type AudienceRule } from "../audienceRules";
import type { SeriesEntryTrigger, SeriesTriggerContext } from "./contracts";
import { processProgressRecord } from "./runtimeProcessing";
import { applySeriesStatsDelta } from "./runtimeProgressState";
import { findEntryBlocks, loadSeriesGraph, normalizeText, nowTs } from "./shared";

function triggerMatches(trigger: SeriesEntryTrigger, context: SeriesTriggerContext): boolean {
  if (trigger.source !== context.source) {
    return false;
  }

  if (trigger.source === "event" || trigger.source === "auto_event") {
    if (!trigger.eventName) {
      return true;
    }
    return trigger.eventName === context.eventName;
  }

  if (trigger.attributeKey && trigger.attributeKey !== context.attributeKey) {
    return false;
  }

  if (
    trigger.fromValue !== undefined &&
    normalizeText(trigger.fromValue) !== normalizeText(context.fromValue)
  ) {
    return false;
  }

  if (
    trigger.toValue !== undefined &&
    normalizeText(trigger.toValue) !== normalizeText(context.toValue)
  ) {
    return false;
  }

  return true;
}

export function seriesAcceptsTrigger(
  series: Doc<"series">,
  triggerContext?: SeriesTriggerContext
): boolean {
  if (!series.entryTriggers || series.entryTriggers.length === 0) {
    return true;
  }

  if (!triggerContext) {
    return false;
  }

  return series.entryTriggers.some((trigger) => triggerMatches(trigger, triggerContext));
}

function toTriggerIdempotencyContext(
  triggerContext?: SeriesTriggerContext
): string | undefined {
  if (!triggerContext) {
    return undefined;
  }

  return [
    triggerContext.source,
    triggerContext.eventName ?? "",
    triggerContext.attributeKey ?? "",
    normalizeText(triggerContext.fromValue) ?? "",
    normalizeText(triggerContext.toValue) ?? "",
  ].join("|");
}

export async function evaluateSeriesEntry(
  ctx: MutationCtx,
  args: {
    seriesId: Id<"series">;
    visitorId: Id<"visitors">;
    triggerContext?: SeriesTriggerContext;
  }
): Promise<
  | { entered: true; progressId: Id<"seriesProgress"> }
  | { entered: false; reason: string; progressId?: Id<"seriesProgress"> }
> {
  const series = (await ctx.db.get(args.seriesId)) as Doc<"series"> | null;
  if (!series || series.status !== "active") {
    return { entered: false, reason: "series_not_active" };
  }

  if (!seriesAcceptsTrigger(series, args.triggerContext)) {
    return { entered: false, reason: "entry_trigger_not_matched" };
  }

  const visitor = (await ctx.db.get(args.visitorId)) as Doc<"visitors"> | null;
  if (!visitor) {
    return { entered: false, reason: "visitor_not_found" };
  }

  if (visitor.workspaceId !== series.workspaceId) {
    return { entered: false, reason: "workspace_mismatch" };
  }

  const existingProgress = await ctx.db
    .query("seriesProgress")
    .withIndex("by_visitor_series", (q) =>
      q.eq("visitorId", args.visitorId).eq("seriesId", args.seriesId)
    )
    .first();

  if (existingProgress) {
    return {
      entered: false,
      reason: "already_in_series",
      progressId: existingProgress._id,
    };
  }

  if (series.entryRules) {
    const matches = await evaluateRule(ctx, series.entryRules as AudienceRule, visitor);
    if (!matches) {
      return { entered: false, reason: "entry_rules_not_met" };
    }
  }

  const { blocks, connections } = await loadSeriesGraph(ctx, args.seriesId);
  const entryBlocks = findEntryBlocks(blocks, connections);
  if (entryBlocks.length !== 1) {
    return { entered: false, reason: "invalid_entry_path" };
  }

  const now = nowTs();
  const idempotencyKeyContext = toTriggerIdempotencyContext(args.triggerContext);

  const progressId = await ctx.db.insert("seriesProgress", {
    visitorId: args.visitorId,
    seriesId: args.seriesId,
    currentBlockId: entryBlocks[0]._id,
    status: "active",
    attemptCount: 0,
    idempotencyKeyContext,
    lastTriggerSource: args.triggerContext?.source,
    lastTriggerEventName: args.triggerContext?.eventName,
    enteredAt: now,
  });

  await ctx.db.insert("seriesProgressHistory", {
    progressId,
    blockId: entryBlocks[0]._id,
    action: "entered",
    createdAt: now,
  });

  const allProgress = await ctx.db
    .query("seriesProgress")
    .withIndex("by_visitor_series", (q) =>
      q.eq("visitorId", args.visitorId).eq("seriesId", args.seriesId)
    )
    .collect();

  const ordered = [...allProgress].sort((left, right) => {
    if (left.enteredAt !== right.enteredAt) {
      return left.enteredAt - right.enteredAt;
    }
    return left._id.toString().localeCompare(right._id.toString());
  });

  const survivor = ordered[0];
  for (let index = 1; index < ordered.length; index += 1) {
    await ctx.db.delete(ordered[index]._id);
  }

  if (!survivor || survivor._id !== progressId) {
    return {
      entered: false,
      reason: "already_in_series",
      progressId: survivor?._id,
    };
  }

  await applySeriesStatsDelta(ctx, args.seriesId, {
    entered: 1,
    active: 1,
  });

  await processProgressRecord(ctx, progressId);

  return { entered: true, progressId };
}
