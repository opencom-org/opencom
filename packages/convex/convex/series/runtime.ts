import { v } from "convex/values";
import { internalMutation, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { evaluateRule, AudienceRule, validateAudienceRule } from "../audienceRules";
import {
  DEFAULT_PROGRESS_SCAN_LIMIT,
  DEFAULT_WAITING_BATCH_LIMIT,
  MAX_BLOCK_EXECUTION_ATTEMPTS,
  MAX_PROGRESS_SCAN_LIMIT,
  MAX_SERIES_EXECUTION_DEPTH,
  MAX_WAITING_BATCH_LIMIT,
  seriesEntryTriggerValidator,
  SeriesEntryTrigger,
  SeriesProgressStatus,
  SeriesStatsKey,
  SeriesTriggerContext,
  BlockExecutionResult,
  SERIES_STATUS_TO_STATS_KEY,
} from "./contracts";
import {
  clampLimit,
  clampNonNegative,
  findEntryBlocks,
  getRetryDelayMs,
  hasTextContent,
  isSeriesRuntimeEnabled,
  isTerminalProgressStatus,
  loadSeriesGraph,
  normalizeSeriesStats,
  normalizeTagName,
  normalizeText,
  nowTs,
  serializeRuntimeGuardError,
  sortConnectionsDeterministically,
  sortProgressDeterministically,
} from "./shared";
import { runSeriesEvaluateEntry, scheduleSeriesProcessProgress } from "./scheduler";
import { upsertBlockTelemetry } from "./telemetry";

async function applySeriesStatsDelta(
  ctx: MutationCtx,
  seriesId: Id<"series">,
  delta: Partial<Record<SeriesStatsKey, number>>
): Promise<void> {
  const series = (await ctx.db.get(seriesId)) as Doc<"series"> | null;
  if (!series) {
    return;
  }

  const stats = normalizeSeriesStats(series);
  for (const [key, value] of Object.entries(delta) as Array<[SeriesStatsKey, number | undefined]>) {
    if (!value) continue;
    stats[key] = clampNonNegative(stats[key] + value);
  }

  await ctx.db.patch(seriesId, {
    stats,
    updatedAt: nowTs(),
  });
}

async function transitionProgressStatus(
  ctx: MutationCtx,
  progress: Doc<"seriesProgress">,
  nextStatus: SeriesProgressStatus,
  patch: Partial<Doc<"seriesProgress">> = {}
): Promise<void> {
  const now = nowTs();
  const transitionPatch: Partial<Doc<"seriesProgress">> = {
    ...patch,
    status: nextStatus,
  };

  if (nextStatus === "completed" && transitionPatch.completedAt === undefined) {
    transitionPatch.completedAt = now;
    transitionPatch.currentBlockId = undefined;
  }
  if (nextStatus === "exited" && transitionPatch.exitedAt === undefined) {
    transitionPatch.exitedAt = now;
    transitionPatch.currentBlockId = undefined;
  }
  if (nextStatus === "goal_reached" && transitionPatch.goalReachedAt === undefined) {
    transitionPatch.goalReachedAt = now;
    transitionPatch.currentBlockId = undefined;
  }
  if (nextStatus === "failed" && transitionPatch.failedAt === undefined) {
    transitionPatch.failedAt = now;
    transitionPatch.currentBlockId = undefined;
  }

  await ctx.db.patch(progress._id, transitionPatch);

  if (progress.status !== nextStatus) {
    const oldKey = SERIES_STATUS_TO_STATS_KEY[progress.status];
    const newKey = SERIES_STATUS_TO_STATS_KEY[nextStatus];
    const delta: Partial<Record<SeriesStatsKey, number>> = {};
    if (oldKey) {
      delta[oldKey] = (delta[oldKey] ?? 0) - 1;
    }
    if (newKey) {
      delta[newKey] = (delta[newKey] ?? 0) + 1;
    }
    await applySeriesStatsDelta(ctx, progress.seriesId, delta);
  }
}

async function appendProgressHistory(
  ctx: MutationCtx,
  progressId: Id<"seriesProgress">,
  blockId: Id<"seriesBlocks">,
  action: Doc<"seriesProgressHistory">["action"],
  result?: Doc<"seriesProgressHistory">["result"]
): Promise<void> {
  await ctx.db.insert("seriesProgressHistory", {
    progressId,
    blockId,
    action,
    result,
    createdAt: nowTs(),
  });
}

function getConnectionByCondition(
  connections: Doc<"seriesConnections">[],
  condition: "yes" | "no" | "default"
): Doc<"seriesConnections"> | undefined {
  return connections.find((connection) => connection.condition === condition);
}

function selectNextConnection(
  connections: Doc<"seriesConnections">[],
  preferredCondition?: "yes" | "no" | "default"
): Doc<"seriesConnections"> | undefined {
  if (connections.length === 0) {
    return undefined;
  }

  if (preferredCondition) {
    const preferred = getConnectionByCondition(connections, preferredCondition);
    if (preferred) {
      return preferred;
    }
  }

  const defaultBranch = getConnectionByCondition(connections, "default");
  if (defaultBranch) {
    return defaultBranch;
  }

  const unlabeled = connections.find((connection) => connection.condition === undefined);
  if (unlabeled) {
    return unlabeled;
  }

  return connections[0];
}

function durationToMs(waitDuration: number, waitUnit: string): number {
  if (waitUnit === "days") return waitDuration * 24 * 60 * 60 * 1000;
  if (waitUnit === "hours") return waitDuration * 60 * 60 * 1000;
  return waitDuration * 60 * 1000;
}

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

  if (trigger.fromValue !== undefined && normalizeText(trigger.fromValue) !== normalizeText(context.fromValue)) {
    return false;
  }

  if (trigger.toValue !== undefined && normalizeText(trigger.toValue) !== normalizeText(context.toValue)) {
    return false;
  }

  return true;
}

function seriesAcceptsTrigger(series: Doc<"series">, triggerContext?: SeriesTriggerContext): boolean {
  if (!series.entryTriggers || series.entryTriggers.length === 0) {
    return true;
  }

  if (!triggerContext) {
    return false;
  }

  return series.entryTriggers.some((trigger) => triggerMatches(trigger, triggerContext));
}

function toTriggerIdempotencyContext(triggerContext?: SeriesTriggerContext): string | undefined {
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

async function resolveLatestConversationIdForVisitor(
  ctx: MutationCtx,
  visitorId: Id<"visitors">
): Promise<Id<"conversations"> | undefined> {
  const conversations = await ctx.db
    .query("conversations")
    .withIndex("by_visitor", (q) => q.eq("visitorId", visitorId))
    .order("desc")
    .take(1);
  return conversations[0]?._id;
}

async function applyTagBlockMutation(
  ctx: MutationCtx,
  series: Doc<"series">,
  visitor: Doc<"visitors">,
  action: "add" | "remove",
  tagName: string
): Promise<void> {
  const normalizedTag = normalizeTagName(tagName);
  if (!normalizedTag) {
    return;
  }

  const existingTag = await ctx.db
    .query("tags")
    .withIndex("by_workspace_name", (q) => q.eq("workspaceId", series.workspaceId).eq("name", normalizedTag))
    .first();

  const tagId =
    existingTag?._id ??
    (await ctx.db.insert("tags", {
      workspaceId: series.workspaceId,
      name: normalizedTag,
      createdAt: nowTs(),
      updatedAt: nowTs(),
    }));

  const conversationId = await resolveLatestConversationIdForVisitor(ctx, visitor._id);
  if (!conversationId) {
    return;
  }

  const existingConversationTag = await ctx.db
    .query("conversationTags")
    .withIndex("by_conversation_tag", (q) => q.eq("conversationId", conversationId).eq("tagId", tagId))
    .first();

  if (action === "add" && !existingConversationTag) {
    await ctx.db.insert("conversationTags", {
      conversationId,
      tagId,
      appliedBy: "auto",
      createdAt: nowTs(),
    });
  }

  if (action === "remove" && existingConversationTag) {
    await ctx.db.delete(existingConversationTag._id);
  }
}

async function runContentBlockAdapter(
  ctx: MutationCtx,
  series: Doc<"series">,
  visitor: Doc<"visitors">,
  block: Doc<"seriesBlocks">
): Promise<{ deliveryAttempted: boolean; deliveryFailed: boolean; error?: string }> {
  const config = block.config ?? {};

  if (block.type === "email") {
    if (!hasTextContent(config.subject) || !hasTextContent(config.body)) {
      return {
        deliveryAttempted: false,
        deliveryFailed: true,
        error: "Email block requires subject and body.",
      };
    }

    if (!hasTextContent(visitor.email)) {
      return {
        deliveryAttempted: true,
        deliveryFailed: true,
        error: "Visitor email is required for email block delivery.",
      };
    }

    const emailConfig = await ctx.db
      .query("emailConfigs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", series.workspaceId))
      .first();
    if (!emailConfig?.enabled) {
      return {
        deliveryAttempted: true,
        deliveryFailed: true,
        error: "Email channel is not configured for workspace.",
      };
    }

    return { deliveryAttempted: true, deliveryFailed: false };
  }

  if (block.type === "push") {
    if (!hasTextContent(config.title) || !hasTextContent(config.body)) {
      return {
        deliveryAttempted: false,
        deliveryFailed: true,
        error: "Push block requires title and body.",
      };
    }

    const visitorPushToken = await ctx.db
      .query("visitorPushTokens")
      .withIndex("by_visitor", (q) => q.eq("visitorId", visitor._id))
      .first();
    if (!visitorPushToken) {
      return {
        deliveryAttempted: true,
        deliveryFailed: true,
        error: "No visitor push token found.",
      };
    }

    return { deliveryAttempted: true, deliveryFailed: false };
  }

  if (block.type === "chat" || block.type === "post" || block.type === "carousel") {
    return {
      deliveryAttempted: true,
      deliveryFailed: false,
    };
  }

  return {
    deliveryAttempted: false,
    deliveryFailed: true,
    error: `Unsupported content block type: ${block.type}`,
  };
}

async function executeCurrentBlock(
  ctx: MutationCtx,
  series: Doc<"series">,
  visitor: Doc<"visitors">,
  progress: Doc<"seriesProgress">,
  block: Doc<"seriesBlocks">
): Promise<BlockExecutionResult> {
  const config = block.config ?? {};
  const outgoing = sortConnectionsDeterministically(
    await ctx.db
      .query("seriesConnections")
      .withIndex("by_from_block", (q) => q.eq("fromBlockId", block._id))
      .collect()
  );

  if (block.type === "rule") {
    if (!config.rules || !validateAudienceRule(config.rules)) {
      return {
        status: "failed",
        error: "Rule block configuration is invalid.",
      };
    }

    const ruleMatch = await evaluateRule(ctx, config.rules as AudienceRule, visitor);
    const nextConnection = selectNextConnection(outgoing, ruleMatch ? "yes" : "no");
    const telemetryPatch: BlockExecutionResult["telemetryPatch"] = {
      ...(nextConnection?.condition === "yes" ? { yesBranchCount: 1 } : {}),
      ...(nextConnection?.condition === "no" ? { noBranchCount: 1 } : {}),
      ...(nextConnection?.condition === "default" || !nextConnection ? { defaultBranchCount: 1 } : {}),
    };

    return {
      status: "completed",
      nextBlockId: nextConnection?.toBlockId,
      telemetryPatch,
    };
  }

  if (block.type === "wait") {
    if (config.waitType === "duration") {
      const duration = Number(config.waitDuration ?? 0);
      const waitUnit = normalizeText(config.waitUnit) ?? "minutes";
      if (!Number.isFinite(duration) || duration <= 0) {
        return {
          status: "failed",
          error: "Duration wait block requires positive duration.",
        };
      }

      return {
        status: "waiting",
        waitUntil: nowTs() + durationToMs(duration, waitUnit),
      };
    }

    if (config.waitType === "until_date") {
      if (!Number.isFinite(config.waitUntilDate)) {
        return {
          status: "failed",
          error: "Until date wait block requires a valid date.",
        };
      }

      return {
        status: "waiting",
        waitUntil: Number(config.waitUntilDate),
      };
    }

    if (config.waitType === "until_event") {
      if (!hasTextContent(config.waitUntilEvent)) {
        return {
          status: "failed",
          error: "Until event wait block requires an event name.",
        };
      }

      return {
        status: "waiting",
        waitEventName: String(config.waitUntilEvent),
      };
    }

    return {
      status: "failed",
      error: "Unsupported wait block type.",
    };
  }

  if (block.type === "tag") {
    const tagAction = config.tagAction;
    const tagName = normalizeText(config.tagName);
    if ((tagAction !== "add" && tagAction !== "remove") || !hasTextContent(tagName)) {
      return {
        status: "failed",
        error: "Tag block requires tag action and tag name.",
      };
    }

    await applyTagBlockMutation(ctx, series, visitor, tagAction, tagName!);
    const nextConnection = selectNextConnection(outgoing, "default");
    return {
      status: "completed",
      nextBlockId: nextConnection?.toBlockId,
    };
  }

  if (
    block.type === "email" ||
    block.type === "push" ||
    block.type === "chat" ||
    block.type === "post" ||
    block.type === "carousel"
  ) {
    const priorCompletion = await ctx.db
      .query("seriesProgressHistory")
      .withIndex("by_progress", (q) => q.eq("progressId", progress._id))
      .filter((q) => q.and(q.eq(q.field("blockId"), block._id), q.eq(q.field("action"), "completed")))
      .first();

    if (priorCompletion) {
      const nextConnection = selectNextConnection(outgoing, "default");
      return {
        status: "completed",
        nextBlockId: nextConnection?.toBlockId,
        deliveryAttempted: false,
        deliveryFailed: false,
      };
    }

    const adapterResult = await runContentBlockAdapter(ctx, series, visitor, block);
    if (adapterResult.deliveryFailed) {
      return {
        status: "failed",
        error: adapterResult.error,
        deliveryAttempted: adapterResult.deliveryAttempted,
        deliveryFailed: true,
      };
    }

    const nextConnection = selectNextConnection(outgoing, "default");
    return {
      status: "completed",
      nextBlockId: nextConnection?.toBlockId,
      deliveryAttempted: adapterResult.deliveryAttempted,
      deliveryFailed: false,
    };
  }

  return {
    status: "failed",
    error: `Unsupported block type: ${block.type}`,
  };
}

async function processProgressRecord(
  ctx: MutationCtx,
  progressId: Id<"seriesProgress">,
  maxDepth = MAX_SERIES_EXECUTION_DEPTH
): Promise<{ processed: boolean; status: SeriesProgressStatus | "missing"; reason?: string }> {
  let depth = 0;

  while (depth < maxDepth) {
    const progress = (await ctx.db.get(progressId)) as Doc<"seriesProgress"> | null;
    if (!progress) {
      return { processed: false, status: "missing", reason: "progress_not_found" };
    }

    const now = nowTs();

    if (isTerminalProgressStatus(progress.status)) {
      return { processed: false, status: progress.status, reason: "already_terminal" };
    }

    const series = (await ctx.db.get(progress.seriesId)) as Doc<"series"> | null;
    if (!series) {
      return { processed: false, status: progress.status, reason: "series_not_found" };
    }
    if (series.status !== "active") {
      return { processed: false, status: progress.status, reason: "series_not_active" };
    }

    let block = progress.currentBlockId
      ? ((await ctx.db.get(progress.currentBlockId)) as Doc<"seriesBlocks"> | null)
      : null;

    if (progress.status === "waiting") {
      if (progress.waitEventName) {
        return { processed: false, status: progress.status, reason: "waiting_for_event" };
      }
      if (progress.waitUntil !== undefined && progress.waitUntil > now) {
        return { processed: false, status: progress.status, reason: "waiting_for_time" };
      }

      if (block && block.type === "wait") {
        const waitBlock = block;
        await appendProgressHistory(ctx, progress._id, block._id, "completed", {
          resumedAt: now,
        });
        await upsertBlockTelemetry(ctx, progress.seriesId, block._id, {
          completed: 1,
          lastResult: { status: "wait_resumed" },
        });

        const waitConnections = sortConnectionsDeterministically(
          await ctx.db
            .query("seriesConnections")
            .withIndex("by_from_block", (q) => q.eq("fromBlockId", waitBlock._id))
            .collect()
        );
        const nextConnection = selectNextConnection(waitConnections, "default");

        if (!nextConnection) {
          await transitionProgressStatus(ctx, progress, "completed", {
            completedAt: now,
            attemptCount: 0,
            waitUntil: undefined,
            waitEventName: undefined,
            lastExecutionError: undefined,
            lastBlockExecutedAt: now,
            idempotencyKeyContext: `${progress._id}:${block._id}:wait_completed`,
          });
          return { processed: true, status: "completed", reason: "wait_terminal_path" };
        }

        await transitionProgressStatus(ctx, progress, "active", {
          currentBlockId: nextConnection.toBlockId,
          attemptCount: 0,
          waitUntil: undefined,
          waitEventName: undefined,
          lastExecutionError: undefined,
          lastBlockExecutedAt: now,
          idempotencyKeyContext: `${progress._id}:${nextConnection.toBlockId}:entered`,
        });
        await appendProgressHistory(ctx, progress._id, nextConnection.toBlockId, "entered");

        depth += 1;
        continue;
      }
    }

    const visitor = (await ctx.db.get(progress.visitorId)) as Doc<"visitors"> | null;
    if (!visitor) {
      await transitionProgressStatus(ctx, progress, "failed", {
        failedAt: now,
        lastExecutionError: "Visitor not found for series progress.",
      });
      return { processed: true, status: "failed", reason: "visitor_not_found" };
    }

    if (series.exitRules) {
      const shouldExit = await evaluateRule(ctx, series.exitRules as AudienceRule, visitor);
      if (shouldExit) {
        await transitionProgressStatus(ctx, progress, "exited", {
          lastBlockExecutedAt: now,
          waitUntil: undefined,
          waitEventName: undefined,
        });
        if (progress.currentBlockId) {
          await appendProgressHistory(ctx, progress._id, progress.currentBlockId, "skipped", {
            reason: "exit_rules_matched",
          });
          await upsertBlockTelemetry(ctx, progress.seriesId, progress.currentBlockId, {
            skipped: 1,
            lastResult: { reason: "exit_rules_matched" },
          });
        }
        return { processed: true, status: "exited" };
      }
    }

    if (series.goalRules) {
      const goalReached = await evaluateRule(ctx, series.goalRules as AudienceRule, visitor);
      if (goalReached) {
        await transitionProgressStatus(ctx, progress, "goal_reached", {
          lastBlockExecutedAt: now,
          waitUntil: undefined,
          waitEventName: undefined,
        });
        if (progress.currentBlockId) {
          await appendProgressHistory(ctx, progress._id, progress.currentBlockId, "skipped", {
            reason: "goal_rules_matched",
          });
          await upsertBlockTelemetry(ctx, progress.seriesId, progress.currentBlockId, {
            skipped: 1,
            lastResult: { reason: "goal_rules_matched" },
          });
        }
        return { processed: true, status: "goal_reached" };
      }
    }

    if (!progress.currentBlockId) {
      await transitionProgressStatus(ctx, progress, "completed", {
        completedAt: now,
      });
      return { processed: true, status: "completed", reason: "no_current_block" };
    }

    block = block ?? ((await ctx.db.get(progress.currentBlockId)) as Doc<"seriesBlocks"> | null);
    if (!block) {
      await transitionProgressStatus(ctx, progress, "failed", {
        failedAt: now,
        lastExecutionError: "Current block not found.",
      });
      return { processed: true, status: "failed", reason: "block_not_found" };
    }

    await upsertBlockTelemetry(ctx, progress.seriesId, block._id, {
      entered: 1,
      lastResult: { status: "entered" },
    });

    const execution = await executeCurrentBlock(ctx, series, visitor, progress, block);
    const attemptCount = (progress.attemptCount ?? 0) + 1;

    const telemetryPatch = execution.telemetryPatch;
    await upsertBlockTelemetry(ctx, progress.seriesId, block._id, {
      completed: execution.status === "completed" ? 1 : 0,
      failed: execution.status === "failed" ? 1 : 0,
      deliveryAttempts: execution.deliveryAttempted ? 1 : 0,
      deliveryFailures: execution.deliveryFailed ? 1 : 0,
      ...(telemetryPatch?.yesBranchCount ? { yesBranchCount: telemetryPatch.yesBranchCount } : {}),
      ...(telemetryPatch?.noBranchCount ? { noBranchCount: telemetryPatch.noBranchCount } : {}),
      ...(telemetryPatch?.defaultBranchCount ? { defaultBranchCount: telemetryPatch.defaultBranchCount } : {}),
      lastResult: execution.error
        ? { status: execution.status, error: execution.error }
        : { status: execution.status },
    });

    if (execution.status === "failed") {
      await appendProgressHistory(ctx, progress._id, block._id, "failed", {
        error: execution.error ?? "Unknown error",
      });

      if (attemptCount >= MAX_BLOCK_EXECUTION_ATTEMPTS) {
        await transitionProgressStatus(ctx, progress, "failed", {
          attemptCount,
          failedAt: now,
          lastExecutionError: execution.error,
          lastBlockExecutedAt: now,
          waitUntil: undefined,
          waitEventName: undefined,
          idempotencyKeyContext: `${progress._id}:${block._id}:failed:${attemptCount}`,
        });
        return { processed: true, status: "failed", reason: "max_attempts_exceeded" };
      }

      const retryDelay = getRetryDelayMs(attemptCount);
      await transitionProgressStatus(ctx, progress, "waiting", {
        attemptCount,
        waitUntil: now + retryDelay,
        waitEventName: undefined,
        lastExecutionError: execution.error,
        lastBlockExecutedAt: now,
        idempotencyKeyContext: `${progress._id}:${block._id}:retry:${attemptCount}`,
      });

      await scheduleSeriesProcessProgress(ctx, {
        delayMs: retryDelay,
        progressId: progress._id,
      });
      return { processed: true, status: "waiting", reason: "retry_scheduled" };
    }

    if (execution.status === "completed") {
      await appendProgressHistory(ctx, progress._id, block._id, "completed", {
        nextBlockId: execution.nextBlockId ?? null,
      });
    }

    if (execution.status === "waiting") {
      await transitionProgressStatus(ctx, progress, "waiting", {
        attemptCount: 0,
        waitUntil: execution.waitUntil,
        waitEventName: execution.waitEventName,
        lastExecutionError: undefined,
        lastBlockExecutedAt: now,
        idempotencyKeyContext: `${progress._id}:${block._id}:waiting`,
      });

      if (execution.waitUntil) {
        const delay = Math.max(0, execution.waitUntil - now);
        await scheduleSeriesProcessProgress(ctx, {
          delayMs: delay,
          progressId: progress._id,
        });
      }
      return { processed: true, status: "waiting" };
    }

    if (!execution.nextBlockId) {
      await transitionProgressStatus(ctx, progress, "completed", {
        completedAt: now,
        attemptCount: 0,
        waitUntil: undefined,
        waitEventName: undefined,
        lastExecutionError: undefined,
        lastBlockExecutedAt: now,
        idempotencyKeyContext: `${progress._id}:${block._id}:completed`,
      });
      return { processed: true, status: "completed", reason: "terminal_path" };
    }

    await ctx.db.patch(progress._id, {
      currentBlockId: execution.nextBlockId,
      status: "active",
      attemptCount: 0,
      waitUntil: undefined,
      waitEventName: undefined,
      lastExecutionError: undefined,
      lastBlockExecutedAt: now,
      idempotencyKeyContext: `${progress._id}:${execution.nextBlockId}:entered`,
    });
    await appendProgressHistory(ctx, progress._id, execution.nextBlockId, "entered");

    depth += 1;
  }

  const latest = (await ctx.db.get(progressId)) as Doc<"seriesProgress"> | null;
  if (latest && !isTerminalProgressStatus(latest.status)) {
    await transitionProgressStatus(ctx, latest, "failed", {
      failedAt: nowTs(),
      lastExecutionError: "Series execution depth exceeded safety limit.",
      lastBlockExecutedAt: nowTs(),
    });
  }

  return {
    processed: false,
    status: latest?.status ?? "missing",
    reason: "max_execution_depth_exceeded",
  };
}

export const evaluateEntry = internalMutation({
  args: {
    seriesId: v.id("series"),
    visitorId: v.id("visitors"),
    triggerContext: v.optional(seriesEntryTriggerValidator),
  },
  handler: async (ctx, args) => {
    if (!isSeriesRuntimeEnabled()) {
      return { entered: false, reason: "runtime_disabled" as const };
    }

    const series = (await ctx.db.get(args.seriesId)) as Doc<"series"> | null;
    if (!series || series.status !== "active") {
      return { entered: false, reason: "series_not_active" as const };
    }

    if (!seriesAcceptsTrigger(series, args.triggerContext)) {
      return { entered: false, reason: "entry_trigger_not_matched" as const };
    }

    const visitor = (await ctx.db.get(args.visitorId)) as Doc<"visitors"> | null;
    if (!visitor) {
      return { entered: false, reason: "visitor_not_found" as const };
    }

    if (visitor.workspaceId !== series.workspaceId) {
      return { entered: false, reason: "workspace_mismatch" as const };
    }

    const existingProgress = await ctx.db
      .query("seriesProgress")
      .withIndex("by_visitor_series", (q) => q.eq("visitorId", args.visitorId).eq("seriesId", args.seriesId))
      .first();

    if (existingProgress) {
      return {
        entered: false,
        reason: "already_in_series" as const,
        progressId: existingProgress._id,
      };
    }

    if (series.entryRules) {
      const matches = await evaluateRule(ctx, series.entryRules as AudienceRule, visitor);
      if (!matches) {
        return { entered: false, reason: "entry_rules_not_met" as const };
      }
    }

    const { blocks, connections } = await loadSeriesGraph(ctx, args.seriesId);
    const entryBlocks = findEntryBlocks(blocks, connections);
    if (entryBlocks.length !== 1) {
      return { entered: false, reason: "invalid_entry_path" as const };
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
      .withIndex("by_visitor_series", (q) => q.eq("visitorId", args.visitorId).eq("seriesId", args.seriesId))
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
        reason: "already_in_series" as const,
        progressId: survivor?._id,
      };
    }

    await applySeriesStatsDelta(ctx, args.seriesId, {
      entered: 1,
      active: 1,
    });

    await processProgressRecord(ctx, progressId);

    return { entered: true, progressId };
  },
});

export const evaluateEnrollmentForVisitor = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.id("visitors"),
    triggerContext: seriesEntryTriggerValidator,
  },
  handler: async (ctx, args) => {
    if (!isSeriesRuntimeEnabled()) {
      return {
        evaluated: 0,
        entered: 0,
        reason: serializeRuntimeGuardError(),
      };
    }

    const visitor = (await ctx.db.get(args.visitorId)) as Doc<"visitors"> | null;
    if (!visitor || visitor.workspaceId !== args.workspaceId) {
      return {
        evaluated: 0,
        entered: 0,
        reason: "visitor_not_found",
      };
    }

    const activeSeries = await ctx.db
      .query("series")
      .withIndex("by_workspace_status", (q) => q.eq("workspaceId", args.workspaceId).eq("status", "active"))
      .collect();

    let entered = 0;
    for (const series of activeSeries) {
      const result = await runSeriesEvaluateEntry(ctx, {
        seriesId: series._id,
        visitorId: args.visitorId,
        triggerContext: args.triggerContext,
      });
      if (result?.entered) {
        entered += 1;
      }
    }

    return {
      evaluated: activeSeries.length,
      entered,
    };
  },
});

export const resumeWaitingForEvent = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.id("visitors"),
    eventName: v.string(),
  },
  handler: async (ctx, args) => {
    if (!isSeriesRuntimeEnabled()) {
      return {
        matched: 0,
        resumed: 0,
        reason: serializeRuntimeGuardError(),
      };
    }

    const waitingProgress = sortProgressDeterministically(
      await ctx.db
        .query("seriesProgress")
        .withIndex("by_visitor_status", (q) => q.eq("visitorId", args.visitorId).eq("status", "waiting"))
        .collect()
    );

    let matched = 0;
    let resumed = 0;
    for (const progress of waitingProgress) {
      if (!progress.currentBlockId) {
        continue;
      }
      if (progress.waitEventName !== args.eventName) {
        continue;
      }

      const series = (await ctx.db.get(progress.seriesId)) as Doc<"series"> | null;
      if (!series || series.workspaceId !== args.workspaceId || series.status !== "active") {
        continue;
      }

      matched += 1;
      await ctx.db.patch(progress._id, {
        waitEventName: undefined,
        waitUntil: nowTs(),
      });

      const result = await processProgressRecord(ctx, progress._id);
      if (result.processed) {
        resumed += 1;
      }
    }

    return {
      matched,
      resumed,
    };
  },
});

export const processProgress = internalMutation({
  args: {
    progressId: v.id("seriesProgress"),
    maxDepth: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!isSeriesRuntimeEnabled()) {
      return {
        processed: false,
        status: "missing" as const,
        reason: serializeRuntimeGuardError(),
      };
    }

    const maxDepth = clampLimit(args.maxDepth, MAX_SERIES_EXECUTION_DEPTH, MAX_SERIES_EXECUTION_DEPTH);
    return await processProgressRecord(ctx, args.progressId, maxDepth);
  },
});

export const processWaitingProgress = internalMutation({
  args: {
    seriesLimit: v.optional(v.number()),
    waitingLimitPerSeries: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!isSeriesRuntimeEnabled()) {
      return {
        processed: 0,
        reason: serializeRuntimeGuardError(),
      };
    }

    const now = nowTs();
    const seriesLimit = clampLimit(args.seriesLimit, DEFAULT_PROGRESS_SCAN_LIMIT, MAX_PROGRESS_SCAN_LIMIT);
    const waitingLimitPerSeries = clampLimit(
      args.waitingLimitPerSeries,
      DEFAULT_WAITING_BATCH_LIMIT,
      MAX_WAITING_BATCH_LIMIT
    );

    const allSeries = await ctx.db.query("series").order("desc").take(seriesLimit);
    let processed = 0;
    let scanned = 0;

    for (const series of allSeries) {
      if (series.status !== "active") continue;

      const waitingProgress = sortProgressDeterministically(
        await ctx.db
          .query("seriesProgress")
          .withIndex("by_status", (q) => q.eq("seriesId", series._id).eq("status", "waiting"))
          .take(waitingLimitPerSeries)
      );

      for (const progress of waitingProgress) {
        scanned += 1;
        if (!progress.currentBlockId) continue;
        if (progress.waitEventName) continue;
        if (progress.waitUntil !== undefined && progress.waitUntil > now) continue;

        const result = await processProgressRecord(ctx, progress._id);
        if (result.processed) {
          processed += 1;
        }
      }
    }

    return { processed, scanned };
  },
});
