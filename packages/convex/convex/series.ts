import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  MutationCtx,
  QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { evaluateRule, AudienceRule, validateAudienceRule } from "./audienceRules";
import { getAuthenticatedUserFromSession } from "./auth";
import { hasPermission, requirePermission } from "./permissions";
import { audienceRulesOrSegmentValidator, seriesRulesValidator } from "./validators";

const DEFAULT_SERIES_LIST_LIMIT = 100;
const MAX_SERIES_LIST_LIMIT = 500;
const DEFAULT_GRAPH_ITEM_LIMIT = 500;
const MAX_GRAPH_ITEM_LIMIT = 2000;
const DEFAULT_HISTORY_LIMIT = 500;
const MAX_HISTORY_LIMIT = 5000;
const DEFAULT_PROGRESS_SCAN_LIMIT = 5000;
const MAX_PROGRESS_SCAN_LIMIT = 20000;
const DEFAULT_WAITING_BATCH_LIMIT = 1000;
const MAX_WAITING_BATCH_LIMIT = 5000;
const MAX_SERIES_EXECUTION_DEPTH = 50;
const MAX_BLOCK_EXECUTION_ATTEMPTS = 3;
const WAIT_RETRY_BASE_DELAY_MS = 30_000;

const seriesEntryTriggerValidator = v.object({
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

const seriesBlockConfigValidator = v.object({
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

const seriesBlockTypeValidator = v.union(
  v.literal("rule"),
  v.literal("wait"),
  v.literal("email"),
  v.literal("push"),
  v.literal("chat"),
  v.literal("post"),
  v.literal("carousel"),
  v.literal("tag")
);

type SeriesProgressStatus = Doc<"seriesProgress">["status"];
type SeriesEntryTrigger = NonNullable<Doc<"series">["entryTriggers"]>[number];

type SeriesTriggerContext = {
  source: SeriesEntryTrigger["source"];
  eventName?: string;
  attributeKey?: string;
  fromValue?: string;
  toValue?: string;
};

type ReadinessIssue = {
  code: string;
  message: string;
  remediation: string;
  blockId?: Id<"seriesBlocks">;
  connectionId?: Id<"seriesConnections">;
};

type SeriesReadinessResult = {
  blockers: ReadinessIssue[];
  warnings: ReadinessIssue[];
  isReady: boolean;
};

type BlockExecutionResult = {
  status: "completed" | "waiting" | "failed";
  nextBlockId?: Id<"seriesBlocks">;
  waitUntil?: number;
  waitEventName?: string;
  error?: string;
  deliveryAttempted?: boolean;
  deliveryFailed?: boolean;
  telemetryPatch?: Partial<Doc<"seriesBlockTelemetry">>;
};

function nowTs(): number {
  return Date.now();
}

function normalizeSeriesStats(series: Doc<"series">) {
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

function normalizeText(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return String(value);
}

function normalizeTagName(value: string): string {
  return value.trim().toLowerCase();
}

function isTerminalProgressStatus(status: SeriesProgressStatus): boolean {
  return (
    status === "completed" ||
    status === "exited" ||
    status === "goal_reached" ||
    status === "failed"
  );
}

function getRetryDelayMs(attempt: number): number {
  return WAIT_RETRY_BASE_DELAY_MS * Math.max(1, attempt);
}

function sortConnectionsDeterministically(connections: Doc<"seriesConnections">[]) {
  return [...connections].sort((left, right) => {
    if (left.createdAt !== right.createdAt) {
      return left.createdAt - right.createdAt;
    }
    return left._id.toString().localeCompare(right._id.toString());
  });
}

function sortProgressDeterministically(progressList: Doc<"seriesProgress">[]) {
  return [...progressList].sort((left, right) => {
    const leftWait = left.waitUntil ?? Number.MAX_SAFE_INTEGER;
    const rightWait = right.waitUntil ?? Number.MAX_SAFE_INTEGER;
    if (leftWait !== rightWait) {
      return leftWait - rightWait;
    }
    return left._id.toString().localeCompare(right._id.toString());
  });
}

function clampLimit(limit: number | undefined, defaultValue: number, maxValue: number): number {
  const normalized = limit ?? defaultValue;
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return defaultValue;
  }
  return Math.min(Math.floor(normalized), maxValue);
}

async function requireSeriesManagePermission(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">
) {
  const user = await getAuthenticatedUserFromSession(ctx);
  if (!user) {
    throw new Error("Not authenticated");
  }
  await requirePermission(ctx, user._id, workspaceId, "settings.workspace");
}

async function canManageSeries(ctx: QueryCtx | MutationCtx, workspaceId: Id<"workspaces">) {
  const user = await getAuthenticatedUserFromSession(ctx);
  if (!user) {
    return false;
  }
  return await hasPermission(ctx, user._id, workspaceId, "settings.workspace");
}

const SERIES_READINESS_BLOCKED_ERROR_CODE = "SERIES_READINESS_BLOCKED";
const SERIES_ORCHESTRATION_GUARD_ERROR_CODE = "SERIES_ORCHESTRATION_DISABLED_BY_GUARD";

type SeriesStatsShape = ReturnType<typeof normalizeSeriesStats>;
type SeriesStatsKey = keyof SeriesStatsShape;

const SERIES_STATUS_TO_STATS_KEY: Partial<Record<SeriesProgressStatus, SeriesStatsKey>> = {
  active: "active",
  waiting: "waiting",
  completed: "completed",
  exited: "exited",
  goal_reached: "goalReached",
  failed: "failed",
};

function isSeriesRuntimeEnabled(): boolean {
  return process.env.OPENCOM_ENABLE_SERIES_ORCHESTRATION !== "false";
}

function clampNonNegative(value: number): number {
  return value < 0 ? 0 : value;
}

function createReadinessIssue(
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

function toStringSet(values: Array<string | undefined>): Set<string> {
  return new Set(values.filter((value): value is string => Boolean(value)));
}

function getOutgoingConnectionsForBlock(
  connections: Doc<"seriesConnections">[],
  blockId: Id<"seriesBlocks">
): Doc<"seriesConnections">[] {
  return sortConnectionsDeterministically(
    connections.filter((connection) => connection.fromBlockId === blockId)
  );
}

function findEntryBlocks(
  blocks: Doc<"seriesBlocks">[],
  connections: Doc<"seriesConnections">[]
): Doc<"seriesBlocks">[] {
  const incoming = toStringSet(connections.map((connection) => connection.toBlockId as string));
  return blocks.filter((block) => !incoming.has(block._id as string));
}

function hasTextContent(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function serializeReadinessError(readiness: SeriesReadinessResult): string {
  return JSON.stringify({
    code: SERIES_READINESS_BLOCKED_ERROR_CODE,
    blockers: readiness.blockers,
    warnings: readiness.warnings,
  });
}

function serializeRuntimeGuardError(): string {
  return JSON.stringify({
    code: SERIES_ORCHESTRATION_GUARD_ERROR_CODE,
    message: "Series orchestration runtime is currently disabled by guard.",
  });
}

async function loadSeriesGraph(
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

async function evaluateSeriesReadiness(
  ctx: QueryCtx | MutationCtx,
  series: Doc<"series">
): Promise<SeriesReadinessResult> {
  const blockers: ReadinessIssue[] = [];
  const warnings: ReadinessIssue[] = [];

  const { blocks, connections } = await loadSeriesGraph(ctx, series._id);

  if (blocks.length === 0) {
    blockers.push(
      createReadinessIssue(
        "SERIES_GRAPH_EMPTY",
        "Series must contain at least one block before activation.",
        "Add a starting block in the builder, then connect downstream steps."
      )
    );
  }

  const blockIds = toStringSet(blocks.map((block) => block._id as string));
  const entryBlocks = findEntryBlocks(blocks, connections);
  if (entryBlocks.length === 0 && blocks.length > 0) {
    blockers.push(
      createReadinessIssue(
        "SERIES_NO_ENTRY_PATH",
        "Series graph has no entry block.",
        "Ensure at least one block has no incoming connection."
      )
    );
  }
  if (entryBlocks.length > 1) {
    blockers.push(
      createReadinessIssue(
        "SERIES_MULTIPLE_ENTRY_PATHS",
        "Series graph has multiple entry blocks.",
        "Connect the graph so only one block remains as the unique entry point."
      )
    );
  }

  for (const connection of connections) {
    if (
      !blockIds.has(connection.fromBlockId as string) ||
      !blockIds.has(connection.toBlockId as string)
    ) {
      blockers.push(
        createReadinessIssue(
          "SERIES_INVALID_CONNECTION",
          "Series graph contains a connection to a missing block.",
          "Delete and recreate the invalid connection.",
          { connectionId: connection._id }
        )
      );
    }
  }

  if (entryBlocks.length === 1) {
    const reachable = new Set<string>();
    const queue: Id<"seriesBlocks">[] = [entryBlocks[0]._id];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      const key = current as string;
      if (reachable.has(key)) continue;
      reachable.add(key);
      for (const outgoing of getOutgoingConnectionsForBlock(connections, current)) {
        queue.push(outgoing.toBlockId);
      }
    }

    for (const block of blocks) {
      if (!reachable.has(block._id as string)) {
        blockers.push(
          createReadinessIssue(
            "SERIES_UNREACHABLE_BLOCK",
            `Block ${block.type} is unreachable from the series entry path.`,
            "Connect this block into the main path or remove it.",
            { blockId: block._id }
          )
        );
      }
    }
  }

  for (const block of blocks) {
    const config = block.config ?? {};
    const outgoing = getOutgoingConnectionsForBlock(connections, block._id);

    if (block.type === "rule") {
      if (!config.rules || !validateAudienceRule(config.rules)) {
        blockers.push(
          createReadinessIssue(
            "SERIES_RULE_CONFIG_INVALID",
            "Rule block is missing valid audience rule conditions.",
            "Configure a valid yes/no rule expression in the block editor.",
            { blockId: block._id }
          )
        );
      }

      const conditioned = outgoing.filter((connection) => connection.condition !== undefined);
      const yesCount = conditioned.filter((connection) => connection.condition === "yes").length;
      const noCount = conditioned.filter((connection) => connection.condition === "no").length;
      const defaultCount = conditioned.filter(
        (connection) => connection.condition === "default"
      ).length;

      if (yesCount !== 1 || noCount !== 1) {
        blockers.push(
          createReadinessIssue(
            "SERIES_RULE_BRANCHES_REQUIRED",
            "Rule blocks require exactly one yes branch and one no branch.",
            "Add one yes and one no connection from this rule block.",
            { blockId: block._id }
          )
        );
      }

      if (defaultCount > 1) {
        blockers.push(
          createReadinessIssue(
            "SERIES_RULE_DEFAULT_BRANCH_DUPLICATE",
            "Rule block has multiple default branches.",
            "Keep only one default branch for deterministic fallback behavior.",
            { blockId: block._id }
          )
        );
      }
    } else {
      const invalidConditionalConnection = outgoing.find(
        (connection) => connection.condition === "yes" || connection.condition === "no"
      );
      if (invalidConditionalConnection) {
        blockers.push(
          createReadinessIssue(
            "SERIES_NON_RULE_CONDITIONAL_BRANCH",
            "Only rule blocks can use yes/no conditional connections.",
            "Change this connection condition to default (or remove the condition).",
            { connectionId: invalidConditionalConnection._id, blockId: block._id }
          )
        );
      }
    }

    if (block.type === "wait") {
      if (!config.waitType) {
        blockers.push(
          createReadinessIssue(
            "SERIES_WAIT_TYPE_REQUIRED",
            "Wait block is missing wait type.",
            "Set wait type to duration, until date, or until event.",
            { blockId: block._id }
          )
        );
      }
      if (config.waitType === "duration") {
        if (
          !Number.isFinite(config.waitDuration) ||
          Number(config.waitDuration) <= 0 ||
          !config.waitUnit
        ) {
          blockers.push(
            createReadinessIssue(
              "SERIES_WAIT_DURATION_INVALID",
              "Duration wait block requires a positive duration and unit.",
              "Set wait duration and choose minutes/hours/days.",
              { blockId: block._id }
            )
          );
        }
      }
      if (config.waitType === "until_date" && !Number.isFinite(config.waitUntilDate)) {
        blockers.push(
          createReadinessIssue(
            "SERIES_WAIT_UNTIL_DATE_REQUIRED",
            "Until date wait block is missing a target timestamp.",
            "Set a valid target date/time for this wait block.",
            { blockId: block._id }
          )
        );
      }
      if (config.waitType === "until_event" && !hasTextContent(config.waitUntilEvent)) {
        blockers.push(
          createReadinessIssue(
            "SERIES_WAIT_UNTIL_EVENT_REQUIRED",
            "Until event wait block is missing event name.",
            "Set an event name that should resume progress.",
            { blockId: block._id }
          )
        );
      }
    }

    if (block.type === "email") {
      if (!hasTextContent(config.subject) || !hasTextContent(config.body)) {
        blockers.push(
          createReadinessIssue(
            "SERIES_EMAIL_CONTENT_REQUIRED",
            "Email block requires both subject and body.",
            "Fill in email subject and body before activation.",
            { blockId: block._id }
          )
        );
      }
    }

    if (block.type === "push") {
      if (!hasTextContent(config.title) || !hasTextContent(config.body)) {
        blockers.push(
          createReadinessIssue(
            "SERIES_PUSH_CONTENT_REQUIRED",
            "Push block requires both title and body.",
            "Fill in push title and body before activation.",
            { blockId: block._id }
          )
        );
      }
    }

    if (
      (block.type === "chat" || block.type === "post" || block.type === "carousel") &&
      !hasTextContent(config.body)
    ) {
      warnings.push(
        createReadinessIssue(
          "SERIES_CONTENT_BODY_RECOMMENDED",
          `${block.type} block has no body configured.`,
          "Add body content so visitors receive a meaningful message.",
          { blockId: block._id }
        )
      );
    }

    if (block.type === "tag") {
      if (!config.tagAction || !hasTextContent(config.tagName)) {
        blockers.push(
          createReadinessIssue(
            "SERIES_TAG_CONFIG_REQUIRED",
            "Tag block requires both tag action and tag name.",
            "Choose add/remove and provide a tag name.",
            { blockId: block._id }
          )
        );
      }
    }

    if (outgoing.length === 0 && block.type !== "wait") {
      warnings.push(
        createReadinessIssue(
          "SERIES_PATH_TERMINATES",
          `Block ${block.type} has no outgoing connection and will terminate the series path.`,
          "Add a downstream connection if continuation is intended.",
          { blockId: block._id }
        )
      );
    }
  }

  if ((series.entryTriggers?.length ?? 0) === 0) {
    warnings.push(
      createReadinessIssue(
        "SERIES_ENTRY_TRIGGER_RECOMMENDED",
        "Series has no entry triggers configured.",
        "Define at least one trigger source so matching visitors can enroll automatically."
      )
    );
  }

  if (blocks.some((block) => block.type === "email")) {
    const emailConfig = await ctx.db
      .query("emailConfigs")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", series.workspaceId))
      .first();
    if (!emailConfig?.enabled) {
      blockers.push(
        createReadinessIssue(
          "SERIES_EMAIL_CHANNEL_NOT_CONFIGURED",
          "Series references email blocks but email channel is not enabled.",
          "Configure and enable email channel in workspace integrations settings."
        )
      );
    }
  }

  if (blocks.some((block) => block.type === "push")) {
    const pushToken = await ctx.db
      .query("visitorPushTokens")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", series.workspaceId))
      .first();
    if (!pushToken) {
      warnings.push(
        createReadinessIssue(
          "SERIES_PUSH_DELIVERY_UNVERIFIED",
          "Series references push blocks but no visitor push tokens are currently registered.",
          "Verify push token registration in at least one target environment before activation."
        )
      );
    }
  }

  return {
    blockers,
    warnings,
    isReady: blockers.length === 0,
  };
}

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

async function upsertBlockTelemetry(
  ctx: MutationCtx,
  seriesId: Id<"series">,
  blockId: Id<"seriesBlocks">,
  patch: {
    entered?: number;
    completed?: number;
    skipped?: number;
    failed?: number;
    deliveryAttempts?: number;
    deliveryFailures?: number;
    yesBranchCount?: number;
    noBranchCount?: number;
    defaultBranchCount?: number;
    lastResult?: Doc<"seriesBlockTelemetry">["lastResult"];
  }
): Promise<void> {
  const existing = await ctx.db
    .query("seriesBlockTelemetry")
    .withIndex("by_series_block", (q) => q.eq("seriesId", seriesId).eq("blockId", blockId))
    .first();

  if (!existing) {
    await ctx.db.insert("seriesBlockTelemetry", {
      seriesId,
      blockId,
      entered: patch.entered ?? 0,
      completed: patch.completed ?? 0,
      skipped: patch.skipped ?? 0,
      failed: patch.failed ?? 0,
      deliveryAttempts: patch.deliveryAttempts ?? 0,
      deliveryFailures: patch.deliveryFailures ?? 0,
      yesBranchCount: patch.yesBranchCount,
      noBranchCount: patch.noBranchCount,
      defaultBranchCount: patch.defaultBranchCount,
      lastResult: patch.lastResult,
      updatedAt: nowTs(),
    });
    return;
  }

  await ctx.db.patch(existing._id, {
    entered: existing.entered + (patch.entered ?? 0),
    completed: existing.completed + (patch.completed ?? 0),
    skipped: existing.skipped + (patch.skipped ?? 0),
    failed: existing.failed + (patch.failed ?? 0),
    deliveryAttempts: existing.deliveryAttempts + (patch.deliveryAttempts ?? 0),
    deliveryFailures: existing.deliveryFailures + (patch.deliveryFailures ?? 0),
    yesBranchCount: (existing.yesBranchCount ?? 0) + (patch.yesBranchCount ?? 0),
    noBranchCount: (existing.noBranchCount ?? 0) + (patch.noBranchCount ?? 0),
    defaultBranchCount: (existing.defaultBranchCount ?? 0) + (patch.defaultBranchCount ?? 0),
    ...(patch.lastResult !== undefined ? { lastResult: patch.lastResult } : {}),
    updatedAt: nowTs(),
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

function seriesAcceptsTrigger(
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
    .withIndex("by_workspace_name", (q) =>
      q.eq("workspaceId", series.workspaceId).eq("name", normalizedTag)
    )
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
    .withIndex("by_conversation_tag", (q) =>
      q.eq("conversationId", conversationId).eq("tagId", tagId)
    )
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
      ...(nextConnection?.condition === "default" || !nextConnection
        ? { defaultBranchCount: 1 }
        : {}),
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
      .filter((q) =>
        q.and(q.eq(q.field("blockId"), block._id), q.eq(q.field("action"), "completed"))
      )
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

      await ctx.scheduler.runAfter(retryDelay, (internal as any).series.processProgress, {
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
        await ctx.scheduler.runAfter(delay, (internal as any).series.processProgress, {
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

// Task 5.1: Create series
export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    entryTriggers: v.optional(v.array(seriesEntryTriggerValidator)),
    entryRules: v.optional(audienceRulesOrSegmentValidator),
    exitRules: v.optional(audienceRulesOrSegmentValidator),
    goalRules: v.optional(audienceRulesOrSegmentValidator),
  },
  handler: async (ctx, args) => {
    await requireSeriesManagePermission(ctx, args.workspaceId);

    // Validate rules if provided
    if (args.entryRules !== undefined && !validateAudienceRule(args.entryRules)) {
      throw new Error("Invalid entry rules");
    }
    if (args.exitRules !== undefined && !validateAudienceRule(args.exitRules)) {
      throw new Error("Invalid exit rules");
    }
    if (args.goalRules !== undefined && !validateAudienceRule(args.goalRules)) {
      throw new Error("Invalid goal rules");
    }

    const now = Date.now();
    return await ctx.db.insert("series", {
      workspaceId: args.workspaceId,
      name: args.name,
      description: args.description,
      entryTriggers: args.entryTriggers,
      entryRules: args.entryRules,
      exitRules: args.exitRules,
      goalRules: args.goalRules,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Task 5.2: Update series
export const update = mutation({
  args: {
    id: v.id("series"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    entryTriggers: v.optional(v.array(seriesEntryTriggerValidator)),
    entryRules: v.optional(audienceRulesOrSegmentValidator),
    exitRules: v.optional(audienceRulesOrSegmentValidator),
    goalRules: v.optional(audienceRulesOrSegmentValidator),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = (await ctx.db.get(id)) as Doc<"series"> | null;
    if (!existing) throw new Error("Series not found");
    await requireSeriesManagePermission(ctx, existing.workspaceId);

    // Validate rules if provided
    if (args.entryRules !== undefined && !validateAudienceRule(args.entryRules)) {
      throw new Error("Invalid entry rules");
    }
    if (args.exitRules !== undefined && !validateAudienceRule(args.exitRules)) {
      throw new Error("Invalid exit rules");
    }
    if (args.goalRules !== undefined && !validateAudienceRule(args.goalRules)) {
      throw new Error("Invalid goal rules");
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return id;
  },
});

// Task 5.3: Activate series
export const activate = mutation({
  args: { id: v.id("series") },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.id)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");
    await requireSeriesManagePermission(ctx, series.workspaceId);

    if (!isSeriesRuntimeEnabled()) {
      throw new Error(serializeRuntimeGuardError());
    }

    const readiness = await evaluateSeriesReadiness(ctx, series);
    if (!readiness.isReady) {
      throw new Error(serializeReadinessError(readiness));
    }

    await ctx.db.patch(args.id, {
      status: "active",
      updatedAt: nowTs(),
      stats: normalizeSeriesStats(series),
    });
  },
});

// Pause series
export const pause = mutation({
  args: { id: v.id("series") },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.id)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");
    await requireSeriesManagePermission(ctx, series.workspaceId);

    await ctx.db.patch(args.id, { status: "paused", updatedAt: Date.now() });
  },
});

// Archive series
export const archive = mutation({
  args: { id: v.id("series") },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.id)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");
    await requireSeriesManagePermission(ctx, series.workspaceId);

    await ctx.db.patch(args.id, { status: "archived", updatedAt: Date.now() });
  },
});

// List series
export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(
      v.union(v.literal("draft"), v.literal("active"), v.literal("paused"), v.literal("archived"))
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const canManage = await canManageSeries(ctx, args.workspaceId);
    if (!canManage) {
      return [];
    }

    const limit = clampLimit(args.limit, DEFAULT_SERIES_LIST_LIMIT, MAX_SERIES_LIST_LIMIT);
    let seriesList;

    if (args.status) {
      seriesList = await ctx.db
        .query("series")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", args.status!)
        )
        .order("desc")
        .take(limit);
    } else {
      seriesList = await ctx.db
        .query("series")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .order("desc")
        .take(limit);
    }

    return seriesList.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get single series
export const get = query({
  args: { id: v.id("series") },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.id)) as Doc<"series"> | null;
    if (!series) {
      return null;
    }
    const canManage = await canManageSeries(ctx, series.workspaceId);
    if (!canManage) {
      return null;
    }
    return series;
  },
});

// Runtime readiness diagnostics for activation validation
export const getReadiness = query({
  args: { id: v.id("series") },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.id)) as Doc<"series"> | null;
    if (!series) {
      return null;
    }

    const canManage = await canManageSeries(ctx, series.workspaceId);
    if (!canManage) {
      throw new Error("Permission denied: settings.workspace");
    }

    return await evaluateSeriesReadiness(ctx, series);
  },
});

// Get series with blocks and connections
export const getWithBlocks = query({
  args: {
    id: v.id("series"),
    blockLimit: v.optional(v.number()),
    connectionLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.id)) as Doc<"series"> | null;
    if (!series) return null;
    const canManage = await canManageSeries(ctx, series.workspaceId);
    if (!canManage) return null;

    const blockLimit = clampLimit(args.blockLimit, DEFAULT_GRAPH_ITEM_LIMIT, MAX_GRAPH_ITEM_LIMIT);
    const connectionLimit = clampLimit(
      args.connectionLimit,
      DEFAULT_GRAPH_ITEM_LIMIT,
      MAX_GRAPH_ITEM_LIMIT
    );
    const blocks = await ctx.db
      .query("seriesBlocks")
      .withIndex("by_series", (q) => q.eq("seriesId", args.id))
      .order("desc")
      .take(blockLimit);

    const connections = await ctx.db
      .query("seriesConnections")
      .withIndex("by_series", (q) => q.eq("seriesId", args.id))
      .order("desc")
      .take(connectionLimit);

    return {
      ...series,
      blocks,
      connections,
    };
  },
});

// Delete series
export const remove = mutation({
  args: { id: v.id("series") },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.id)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");
    await requireSeriesManagePermission(ctx, series.workspaceId);

    // Delete blocks
    const blocks = await ctx.db
      .query("seriesBlocks")
      .withIndex("by_series", (q) => q.eq("seriesId", args.id))
      .collect();

    for (const block of blocks) {
      await ctx.db.delete(block._id);
    }

    // Delete connections
    const connections = await ctx.db
      .query("seriesConnections")
      .withIndex("by_series", (q) => q.eq("seriesId", args.id))
      .collect();

    for (const connection of connections) {
      await ctx.db.delete(connection._id);
    }

    // Delete progress records
    const progressRecords = await ctx.db
      .query("seriesProgress")
      .withIndex("by_series", (q) => q.eq("seriesId", args.id))
      .collect();

    for (const progress of progressRecords) {
      // Delete history
      const history = await ctx.db
        .query("seriesProgressHistory")
        .withIndex("by_progress", (q) => q.eq("progressId", progress._id))
        .collect();

      for (const h of history) {
        await ctx.db.delete(h._id);
      }

      await ctx.db.delete(progress._id);
    }

    await ctx.db.delete(args.id);
  },
});

// Add block to series
export const addBlock = mutation({
  args: {
    seriesId: v.id("series"),
    type: seriesBlockTypeValidator,
    position: v.object({
      x: v.number(),
      y: v.number(),
    }),
    config: seriesBlockConfigValidator,
  },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.seriesId)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");
    await requireSeriesManagePermission(ctx, series.workspaceId);

    const now = Date.now();
    return await ctx.db.insert("seriesBlocks", {
      seriesId: args.seriesId,
      type: args.type,
      position: args.position,
      config: args.config,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update block
export const updateBlock = mutation({
  args: {
    id: v.id("seriesBlocks"),
    position: v.optional(
      v.object({
        x: v.number(),
        y: v.number(),
      })
    ),
    config: v.optional(seriesBlockConfigValidator),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = (await ctx.db.get(id)) as Doc<"seriesBlocks"> | null;
    if (!existing) throw new Error("Block not found");
    const series = (await ctx.db.get(existing.seriesId)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");
    await requireSeriesManagePermission(ctx, series.workspaceId);

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return id;
  },
});

// Delete block
export const removeBlock = mutation({
  args: { id: v.id("seriesBlocks") },
  handler: async (ctx, args) => {
    const block = (await ctx.db.get(args.id)) as Doc<"seriesBlocks"> | null;
    if (!block) throw new Error("Block not found");
    const series = (await ctx.db.get(block.seriesId)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");
    await requireSeriesManagePermission(ctx, series.workspaceId);

    // Delete connections involving this block
    const fromConnections = await ctx.db
      .query("seriesConnections")
      .withIndex("by_from_block", (q) => q.eq("fromBlockId", args.id))
      .collect();

    const toConnections = await ctx.db
      .query("seriesConnections")
      .withIndex("by_to_block", (q) => q.eq("toBlockId", args.id))
      .collect();

    for (const conn of [...fromConnections, ...toConnections]) {
      await ctx.db.delete(conn._id);
    }

    await ctx.db.delete(args.id);
  },
});

// Add connection between blocks
export const addConnection = mutation({
  args: {
    seriesId: v.id("series"),
    fromBlockId: v.id("seriesBlocks"),
    toBlockId: v.id("seriesBlocks"),
    condition: v.optional(v.union(v.literal("yes"), v.literal("no"), v.literal("default"))),
  },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.seriesId)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");
    await requireSeriesManagePermission(ctx, series.workspaceId);

    const fromBlock = (await ctx.db.get(args.fromBlockId)) as Doc<"seriesBlocks"> | null;
    const toBlock = (await ctx.db.get(args.toBlockId)) as Doc<"seriesBlocks"> | null;
    if (!fromBlock || !toBlock) {
      throw new Error("Block not found");
    }
    if (fromBlock.seriesId !== args.seriesId || toBlock.seriesId !== args.seriesId) {
      throw new Error("Blocks must belong to the target series");
    }

    return await ctx.db.insert("seriesConnections", {
      seriesId: args.seriesId,
      fromBlockId: args.fromBlockId,
      toBlockId: args.toBlockId,
      condition: args.condition,
      createdAt: Date.now(),
    });
  },
});

// Delete connection
export const removeConnection = mutation({
  args: { id: v.id("seriesConnections") },
  handler: async (ctx, args) => {
    const connection = (await ctx.db.get(args.id)) as Doc<"seriesConnections"> | null;
    if (!connection) throw new Error("Connection not found");
    const series = (await ctx.db.get(connection.seriesId)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");
    await requireSeriesManagePermission(ctx, series.workspaceId);

    await ctx.db.delete(args.id);
  },
});

// Task 5.4: Evaluate series entry for a visitor
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

    // Check if visitor is already in this series
    const existingProgress = await ctx.db
      .query("seriesProgress")
      .withIndex("by_visitor_series", (q) =>
        q.eq("visitorId", args.visitorId).eq("seriesId", args.seriesId)
      )
      .first();

    if (existingProgress) {
      return {
        entered: false,
        reason: "already_in_series" as const,
        progressId: existingProgress._id,
      };
    }

    // Check entry rules
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

    // Create progress record
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

    // Record history
    await ctx.db.insert("seriesProgressHistory", {
      progressId,
      blockId: entryBlocks[0]._id,
      action: "entered",
      createdAt: now,
    });

    // Enrollment idempotency: keep oldest progress if concurrent enrollment races occur.
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
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "active")
      )
      .collect();

    let entered = 0;
    for (const series of activeSeries) {
      const result = await ctx.runMutation((internal as any).series.evaluateEntry, {
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
        .withIndex("by_visitor_status", (q) =>
          q.eq("visitorId", args.visitorId).eq("status", "waiting")
        )
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

    const maxDepth = clampLimit(
      args.maxDepth,
      MAX_SERIES_EXECUTION_DEPTH,
      MAX_SERIES_EXECUTION_DEPTH
    );
    return await processProgressRecord(ctx, args.progressId, maxDepth);
  },
});

// Task 5.5: Process wait blocks (called by scheduled job)
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
    const seriesLimit = clampLimit(
      args.seriesLimit,
      DEFAULT_PROGRESS_SCAN_LIMIT,
      MAX_PROGRESS_SCAN_LIMIT
    );
    const waitingLimitPerSeries = clampLimit(
      args.waitingLimitPerSeries,
      DEFAULT_WAITING_BATCH_LIMIT,
      MAX_WAITING_BATCH_LIMIT
    );

    // Find all progress records that are waiting and ready to continue
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

// Task 5.8: Track user progress through series
export const getProgress = internalQuery({
  args: {
    seriesId: v.id("series"),
    visitorId: v.id("visitors"),
    historyLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.seriesId)) as Doc<"series"> | null;
    if (!series) {
      return null;
    }

    const progress = await ctx.db
      .query("seriesProgress")
      .withIndex("by_visitor_series", (q) =>
        q.eq("visitorId", args.visitorId).eq("seriesId", args.seriesId)
      )
      .first();

    if (!progress) return null;

    const historyLimit = clampLimit(args.historyLimit, DEFAULT_HISTORY_LIMIT, MAX_HISTORY_LIMIT);
    const history = await ctx.db
      .query("seriesProgressHistory")
      .withIndex("by_progress", (q) => q.eq("progressId", progress._id))
      .order("desc")
      .take(historyLimit);

    return {
      ...progress,
      history: history.sort((a, b) => a.createdAt - b.createdAt),
    };
  },
});

// Task 5.9: Exit user from series
export const exitProgress = internalMutation({
  args: {
    progressId: v.id("seriesProgress"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const progress = (await ctx.db.get(args.progressId)) as Doc<"seriesProgress"> | null;
    if (!progress) throw new Error("Progress not found");
    const series = (await ctx.db.get(progress.seriesId)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");

    const now = Date.now();

    await ctx.db.patch(args.progressId, {
      status: "exited",
      exitedAt: now,
    });

    // Update series stats
    if (series.stats) {
      await ctx.db.patch(progress.seriesId, {
        stats: {
          ...series.stats,
          exited: series.stats.exited + 1,
        },
      });
    }
  },
});

// Task 5.10: Mark goal reached
export const markGoalReached = internalMutation({
  args: {
    progressId: v.id("seriesProgress"),
  },
  handler: async (ctx, args) => {
    const progress = (await ctx.db.get(args.progressId)) as Doc<"seriesProgress"> | null;
    if (!progress) throw new Error("Progress not found");
    const series = (await ctx.db.get(progress.seriesId)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");

    const now = Date.now();

    await ctx.db.patch(args.progressId, {
      status: "goal_reached",
      goalReachedAt: now,
    });

    // Update series stats
    if (series.stats) {
      await ctx.db.patch(progress.seriesId, {
        stats: {
          ...series.stats,
          goalReached: series.stats.goalReached + 1,
        },
      });
    }
  },
});

// Get series stats
export const getStats = query({
  args: {
    id: v.id("series"),
    scanLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.id)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");
    const canManage = await canManageSeries(ctx, series.workspaceId);
    if (!canManage) {
      throw new Error("Permission denied: settings.workspace");
    }

    const scanLimit = clampLimit(
      args.scanLimit,
      DEFAULT_PROGRESS_SCAN_LIMIT,
      MAX_PROGRESS_SCAN_LIMIT
    );
    const progressRecords = await ctx.db
      .query("seriesProgress")
      .withIndex("by_series", (q) => q.eq("seriesId", args.id))
      .order("desc")
      .take(scanLimit);
    const truncated = progressRecords.length >= scanLimit;

    return {
      total: progressRecords.length,
      active: progressRecords.filter((p) => p.status === "active").length,
      waiting: progressRecords.filter((p) => p.status === "waiting").length,
      completed: progressRecords.filter((p) => p.status === "completed").length,
      exited: progressRecords.filter((p) => p.status === "exited").length,
      goalReached: progressRecords.filter((p) => p.status === "goal_reached").length,
      failed: progressRecords.filter((p) => p.status === "failed").length,
      completionRate:
        progressRecords.length > 0
          ? (progressRecords.filter((p) => p.status === "completed").length /
              progressRecords.length) *
            100
          : 0,
      goalRate:
        progressRecords.length > 0
          ? (progressRecords.filter((p) => p.status === "goal_reached").length /
              progressRecords.length) *
            100
          : 0,
      truncated,
    };
  },
});

export const getTelemetry = query({
  args: {
    id: v.id("series"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.id)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");

    const canManage = await canManageSeries(ctx, series.workspaceId);
    if (!canManage) {
      throw new Error("Permission denied: settings.workspace");
    }

    const limit = clampLimit(args.limit, DEFAULT_GRAPH_ITEM_LIMIT, MAX_GRAPH_ITEM_LIMIT);
    const telemetryRows = await ctx.db
      .query("seriesBlockTelemetry")
      .withIndex("by_series", (q) => q.eq("seriesId", args.id))
      .order("desc")
      .take(limit);

    const blockRows = await ctx.db
      .query("seriesBlocks")
      .withIndex("by_series", (q) => q.eq("seriesId", args.id))
      .collect();
    const blockMap = new Map(blockRows.map((block) => [block._id, block] as const));

    const totals = telemetryRows.reduce(
      (acc, row) => {
        acc.entered += row.entered;
        acc.completed += row.completed;
        acc.skipped += row.skipped;
        acc.failed += row.failed;
        acc.deliveryAttempts += row.deliveryAttempts;
        acc.deliveryFailures += row.deliveryFailures;
        return acc;
      },
      {
        entered: 0,
        completed: 0,
        skipped: 0,
        failed: 0,
        deliveryAttempts: 0,
        deliveryFailures: 0,
      }
    );

    return {
      totals,
      blocks: telemetryRows.map((row) => ({
        ...row,
        block: blockMap.get(row.blockId) ?? null,
      })),
    };
  },
});

// Duplicate series
export const duplicate = mutation({
  args: { id: v.id("series") },
  handler: async (ctx, args) => {
    const series = (await ctx.db.get(args.id)) as Doc<"series"> | null;
    if (!series) throw new Error("Series not found");
    await requireSeriesManagePermission(ctx, series.workspaceId);

    const now = Date.now();

    // Create new series
    const newSeriesId = await ctx.db.insert("series", {
      workspaceId: series.workspaceId,
      name: `${series.name} (Copy)`,
      description: series.description,
      entryTriggers: series.entryTriggers,
      entryRules: series.entryRules,
      exitRules: series.exitRules,
      goalRules: series.goalRules,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });

    // Copy blocks
    const blocks = await ctx.db
      .query("seriesBlocks")
      .withIndex("by_series", (q) => q.eq("seriesId", args.id))
      .collect();

    const blockIdMap = new Map<string, Id<"seriesBlocks">>();

    for (const block of blocks) {
      const newBlockId = await ctx.db.insert("seriesBlocks", {
        seriesId: newSeriesId,
        type: block.type,
        position: block.position,
        config: block.config,
        createdAt: now,
        updatedAt: now,
      });
      blockIdMap.set(block._id as string, newBlockId);
    }

    // Copy connections
    const connections = await ctx.db
      .query("seriesConnections")
      .withIndex("by_series", (q) => q.eq("seriesId", args.id))
      .collect();

    for (const conn of connections) {
      const newFromId = blockIdMap.get(conn.fromBlockId as string);
      const newToId = blockIdMap.get(conn.toBlockId as string);

      if (newFromId && newToId) {
        await ctx.db.insert("seriesConnections", {
          seriesId: newSeriesId,
          fromBlockId: newFromId,
          toBlockId: newToId,
          condition: conn.condition,
          createdAt: now,
        });
      }
    }

    return newSeriesId;
  },
});
