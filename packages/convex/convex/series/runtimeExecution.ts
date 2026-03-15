import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { evaluateRule, type AudienceRule, validateAudienceRule } from "../audienceRules";
import type { BlockExecutionResult } from "./contracts";
import {
  hasTextContent,
  normalizeTagName,
  normalizeText,
  nowTs,
  sortConnectionsDeterministically,
} from "./shared";
import { isBillingEnabled } from "../billing/types";
import { getCurrentPeriodBounds } from "../billing/usage";
import { checkEmailHardCap } from "../billing/gates";

function getConnectionByCondition(
  connections: Doc<"seriesConnections">[],
  condition: "yes" | "no" | "default"
): Doc<"seriesConnections"> | undefined {
  return connections.find((connection) => connection.condition === condition);
}

export function selectNextConnection(
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
  if (waitUnit === "days") {
    return waitDuration * 24 * 60 * 60 * 1000;
  }
  if (waitUnit === "hours") {
    return waitDuration * 60 * 60 * 1000;
  }
  return waitDuration * 60 * 1000;
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

    // Task 8.6: Check email hard cap before delivering email block
    await checkEmailHardCap(ctx, series.workspaceId);

    // Track email send toward billing usage limit.
    // Non-fatal — usage tracking failure must never block email delivery.
    if (isBillingEnabled()) {
      try {
        const period = await getCurrentPeriodBounds(ctx, series.workspaceId);
        if (period) {
          const existing = await ctx.db
            .query("usageRecords")
            .withIndex("by_workspace_dimension_period", (q) =>
              q
                .eq("workspaceId", series.workspaceId)
                .eq("dimension", "emails_sent")
                .eq("periodStart", period.periodStart)
            )
            .unique();
          if (existing) {
            await ctx.db.patch(existing._id, {
              value: existing.value + 1,
              lastUpdatedAt: Date.now(),
            });
          } else {
            await ctx.db.insert("usageRecords", {
              workspaceId: series.workspaceId,
              dimension: "emails_sent",
              periodStart: period.periodStart,
              periodEnd: period.periodEnd,
              value: 1,
              lastUpdatedAt: Date.now(),
            });
          }
        }
      } catch {
        // Non-fatal: billing tracking must never block email delivery
        console.warn("Email usage tracking failed for series email block");
      }
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

export async function executeCurrentBlock(
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
