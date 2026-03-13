import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { validateAudienceRule } from "../audienceRules";
import type { ReadinessIssue, SeriesReadinessResult } from "./contracts";
import {
  createReadinessIssue,
  findEntryBlocks,
  getOutgoingConnectionsForBlock,
  hasTextContent,
  loadSeriesGraph,
  toStringSet,
} from "./shared";

export async function evaluateSeriesReadiness(
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
    const queue = [entryBlocks[0]._id];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      const key = current as string;
      if (reachable.has(key)) {
        continue;
      }
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
