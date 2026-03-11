import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { evaluateRule, type AudienceRule } from "../audienceRules";
import {
  MAX_BLOCK_EXECUTION_ATTEMPTS,
  MAX_SERIES_EXECUTION_DEPTH,
  type SeriesProgressStatus,
} from "./contracts";
import { executeCurrentBlock, selectNextConnection } from "./runtimeExecution";
import { appendProgressHistory, transitionProgressStatus } from "./runtimeProgressState";
import { scheduleSeriesProcessProgress } from "./scheduler";
import { getRetryDelayMs, isTerminalProgressStatus, nowTs, sortConnectionsDeterministically } from "./shared";
import { upsertBlockTelemetry } from "./telemetry";

export async function processProgressRecord(
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

    block =
      block ?? ((await ctx.db.get(progress.currentBlockId)) as Doc<"seriesBlocks"> | null);
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
      ...(telemetryPatch?.yesBranchCount
        ? { yesBranchCount: telemetryPatch.yesBranchCount }
        : {}),
      ...(telemetryPatch?.noBranchCount
        ? { noBranchCount: telemetryPatch.noBranchCount }
        : {}),
      ...(telemetryPatch?.defaultBranchCount
        ? { defaultBranchCount: telemetryPatch.defaultBranchCount }
        : {}),
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
        return {
          processed: true,
          status: "failed",
          reason: "max_attempts_exceeded",
        };
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
