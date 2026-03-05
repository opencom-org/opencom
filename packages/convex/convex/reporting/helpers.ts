import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getAuthenticatedUserFromSession } from "../auth";
import { requirePermission } from "../permissions";

export const DEFAULT_REPORTING_SCAN_LIMIT = 5000;
export const MAX_REPORTING_SCAN_LIMIT = 20000;
export const DEFAULT_AI_RESPONSES_PER_CONVERSATION_LIMIT = 200;
export const MAX_AI_RESPONSES_PER_CONVERSATION_LIMIT = 1000;
export const DEFAULT_GAPS_LIMIT = 20;
export const MAX_GAPS_LIMIT = 100;

export type ReportingGranularity = "day" | "week" | "month";

export async function requireReportingReadAccess(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">
): Promise<void> {
  const user = await getAuthenticatedUserFromSession(ctx);
  if (!user) {
    throw new Error("Not authenticated");
  }
  await requirePermission(ctx, user._id, workspaceId, "conversations.read");
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

export function getPeriodKey(timestamp: number, granularity: ReportingGranularity): string {
  const date = new Date(timestamp);
  if (granularity === "day") {
    return date.toISOString().split("T")[0];
  }
  if (granularity === "week") {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    return weekStart.toISOString().split("T")[0];
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
