import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getAuthenticatedUserFromSession } from "../auth";
import { hasPermission, requirePermission } from "../permissions";
import { throwNotAuthenticated } from "../utils/errors";
import {
  SERIES_ORCHESTRATION_GUARD_ERROR_CODE,
  SERIES_READINESS_BLOCKED_ERROR_CODE,
  SeriesProgressStatus,
  SeriesReadinessResult,
  SeriesStatsShape,
  WAIT_RETRY_BASE_DELAY_MS,
  ReadinessIssue,
} from "./contracts";

export function nowTs(): number {
  return Date.now();
}

export function normalizeSeriesStats(series: Doc<"series">): SeriesStatsShape {
  return {
    entered: series.stats?.entered ?? 0,
    active: series.stats?.active ?? 0,
    waiting: series.stats?.waiting ?? 0,
    completed: series.stats?.completed ?? 0,
    exited: series.stats?.exited ?? 0,
    goalReached: series.stats?.goalReached ?? 0,
    failed: series.stats?.failed ?? 0,
  };
}

export function normalizeText(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return String(value);
}

export function normalizeTagName(value: string): string {
  return value.trim().toLowerCase();
}

export function isTerminalProgressStatus(status: SeriesProgressStatus): boolean {
  return (
    status === "completed" ||
    status === "exited" ||
    status === "goal_reached" ||
    status === "failed"
  );
}

export function getRetryDelayMs(attempt: number): number {
  return WAIT_RETRY_BASE_DELAY_MS * Math.max(1, attempt);
}

export function sortConnectionsDeterministically(connections: Doc<"seriesConnections">[]) {
  return [...connections].sort((left, right) => {
    if (left.createdAt !== right.createdAt) {
      return left.createdAt - right.createdAt;
    }
    return left._id.toString().localeCompare(right._id.toString());
  });
}

export function sortProgressDeterministically(progressList: Doc<"seriesProgress">[]) {
  return [...progressList].sort((left, right) => {
    const leftWait = left.waitUntil ?? Number.MAX_SAFE_INTEGER;
    const rightWait = right.waitUntil ?? Number.MAX_SAFE_INTEGER;
    if (leftWait !== rightWait) {
      return leftWait - rightWait;
    }
    return left._id.toString().localeCompare(right._id.toString());
  });
}

export function clampLimit(
  limit: number | undefined,
  defaultValue: number,
  maxValue: number
): number {
  const normalized = limit ?? defaultValue;
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return defaultValue;
  }
  return Math.min(Math.floor(normalized), maxValue);
}

export async function requireSeriesManagePermission(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">
) {
  const user = await getAuthenticatedUserFromSession(ctx);
  if (!user) {
    throwNotAuthenticated();
  }
  await requirePermission(ctx, user._id, workspaceId, "settings.workspace");
}

export async function canManageSeries(ctx: QueryCtx | MutationCtx, workspaceId: Id<"workspaces">) {
  const user = await getAuthenticatedUserFromSession(ctx);
  if (!user) {
    return false;
  }
  return await hasPermission(ctx, user._id, workspaceId, "settings.workspace");
}

export function isSeriesRuntimeEnabled(): boolean {
  return process.env.OPENCOM_ENABLE_SERIES_ORCHESTRATION !== "false";
}

export function clampNonNegative(value: number): number {
  return value < 0 ? 0 : value;
}

export function createReadinessIssue(
  code: string,
  message: string,
  remediation: string,
  context?: Pick<ReadinessIssue, "blockId" | "connectionId">
): ReadinessIssue {
  return {
    code,
    message,
    remediation,
    ...(context?.blockId ? { blockId: context.blockId } : {}),
    ...(context?.connectionId ? { connectionId: context.connectionId } : {}),
  };
}

export function toStringSet(values: Array<string | undefined>): Set<string> {
  return new Set(values.filter((value): value is string => Boolean(value)));
}

export function getOutgoingConnectionsForBlock(
  connections: Doc<"seriesConnections">[],
  blockId: Id<"seriesBlocks">
): Doc<"seriesConnections">[] {
  return sortConnectionsDeterministically(
    connections.filter((connection) => connection.fromBlockId === blockId)
  );
}

export function findEntryBlocks(
  blocks: Doc<"seriesBlocks">[],
  connections: Doc<"seriesConnections">[]
): Doc<"seriesBlocks">[] {
  const incoming = toStringSet(connections.map((connection) => connection.toBlockId as string));
  return blocks.filter((block) => !incoming.has(block._id as string));
}

export function hasTextContent(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function serializeReadinessError(readiness: SeriesReadinessResult): string {
  return JSON.stringify({
    code: SERIES_READINESS_BLOCKED_ERROR_CODE,
    blockers: readiness.blockers,
    warnings: readiness.warnings,
  });
}

export function serializeRuntimeGuardError(): string {
  return JSON.stringify({
    code: SERIES_ORCHESTRATION_GUARD_ERROR_CODE,
    message: "Series orchestration runtime is currently disabled by guard.",
  });
}

export async function loadSeriesGraph(
  ctx: QueryCtx | MutationCtx,
  seriesId: Id<"series">
): Promise<{ blocks: Doc<"seriesBlocks">[]; connections: Doc<"seriesConnections">[] }> {
  const blocks = await ctx.db
    .query("seriesBlocks")
    .withIndex("by_series", (q) => q.eq("seriesId", seriesId))
    .collect();

  const connections = await ctx.db
    .query("seriesConnections")
    .withIndex("by_series", (q) => q.eq("seriesId", seriesId))
    .collect();

  return {
    blocks,
    connections: sortConnectionsDeterministically(connections),
  };
}
