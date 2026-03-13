import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { SeriesProgressStatus, SeriesStatsKey } from "./contracts";
import { SERIES_STATUS_TO_STATS_KEY } from "./contracts";
import { clampNonNegative, normalizeSeriesStats, nowTs } from "./shared";

export async function applySeriesStatsDelta(
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
    if (!value) {
      continue;
    }
    stats[key] = clampNonNegative(stats[key] + value);
  }

  await ctx.db.patch(seriesId, {
    stats,
    updatedAt: nowTs(),
  });
}

export async function transitionProgressStatus(
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

export async function appendProgressHistory(
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
