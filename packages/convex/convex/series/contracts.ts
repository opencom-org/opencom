import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { seriesRulesValidator } from "../validators";

export const DEFAULT_SERIES_LIST_LIMIT = 100;
export const MAX_SERIES_LIST_LIMIT = 500;
export const DEFAULT_GRAPH_ITEM_LIMIT = 500;
export const MAX_GRAPH_ITEM_LIMIT = 2000;
export const DEFAULT_HISTORY_LIMIT = 500;
export const MAX_HISTORY_LIMIT = 5000;
export const DEFAULT_PROGRESS_SCAN_LIMIT = 5000;
export const MAX_PROGRESS_SCAN_LIMIT = 20000;
export const DEFAULT_WAITING_BATCH_LIMIT = 1000;
export const MAX_WAITING_BATCH_LIMIT = 5000;
export const MAX_SERIES_EXECUTION_DEPTH = 50;
export const MAX_BLOCK_EXECUTION_ATTEMPTS = 3;
export const WAIT_RETRY_BASE_DELAY_MS = 30_000;

export const SERIES_READINESS_BLOCKED_ERROR_CODE = "SERIES_READINESS_BLOCKED";
export const SERIES_ORCHESTRATION_GUARD_ERROR_CODE = "SERIES_ORCHESTRATION_DISABLED_BY_GUARD";

export const seriesEntryTriggerValidator = v.object({
  source: v.union(
    v.literal("event"),
    v.literal("auto_event"),
    v.literal("visitor_attribute_changed"),
    v.literal("visitor_state_changed")
  ),
  eventName: v.optional(v.string()),
  attributeKey: v.optional(v.string()),
  fromValue: v.optional(v.string()),
  toValue: v.optional(v.string()),
});

export const seriesBlockConfigValidator = v.object({
  rules: v.optional(seriesRulesValidator),
  waitType: v.optional(
    v.union(v.literal("duration"), v.literal("until_date"), v.literal("until_event"))
  ),
  waitDuration: v.optional(v.number()),
  waitUnit: v.optional(v.union(v.literal("minutes"), v.literal("hours"), v.literal("days"))),
  waitUntilDate: v.optional(v.number()),
  waitUntilEvent: v.optional(v.string()),
  contentId: v.optional(v.string()),
  subject: v.optional(v.string()),
  body: v.optional(v.string()),
  title: v.optional(v.string()),
  tagAction: v.optional(v.union(v.literal("add"), v.literal("remove"))),
  tagName: v.optional(v.string()),
});

export const seriesBlockTypeValidator = v.union(
  v.literal("rule"),
  v.literal("wait"),
  v.literal("email"),
  v.literal("push"),
  v.literal("chat"),
  v.literal("post"),
  v.literal("carousel"),
  v.literal("tag")
);

export type SeriesProgressStatus = Doc<"seriesProgress">["status"];
export type SeriesEntryTrigger = NonNullable<Doc<"series">["entryTriggers"]>[number];

export type SeriesTriggerContext = {
  source: SeriesEntryTrigger["source"];
  eventName?: string;
  attributeKey?: string;
  fromValue?: string;
  toValue?: string;
};

export type ReadinessIssue = {
  code: string;
  message: string;
  remediation: string;
  blockId?: Id<"seriesBlocks">;
  connectionId?: Id<"seriesConnections">;
};

export type SeriesReadinessResult = {
  blockers: ReadinessIssue[];
  warnings: ReadinessIssue[];
  isReady: boolean;
};

export type BlockTelemetryPatch = {
  yesBranchCount?: number;
  noBranchCount?: number;
  defaultBranchCount?: number;
};

export type BlockExecutionResult = {
  status: "completed" | "waiting" | "failed";
  nextBlockId?: Id<"seriesBlocks">;
  waitUntil?: number;
  waitEventName?: string;
  error?: string;
  deliveryAttempted?: boolean;
  deliveryFailed?: boolean;
  telemetryPatch?: BlockTelemetryPatch;
};

export type SeriesStatsShape = {
  entered: number;
  active: number;
  waiting: number;
  completed: number;
  exited: number;
  goalReached: number;
  failed: number;
};

export type SeriesStatsKey = keyof SeriesStatsShape;

export const SERIES_STATUS_TO_STATS_KEY: Partial<Record<SeriesProgressStatus, SeriesStatsKey>> = {
  active: "active",
  waiting: "waiting",
  completed: "completed",
  exited: "exited",
  goal_reached: "goalReached",
  failed: "failed",
};
