import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getAuthenticatedUserFromSession } from "../auth";
import { hasPermission } from "../permissions";
import { customAttributesValidator } from "../validators";
import { formatReadableVisitorId } from "../visitorReadableId";
import { scheduleSeriesEvaluateEnrollment } from "../series/scheduler";

export const locationValidator = v.optional(
  v.object({
    city: v.optional(v.string()),
    region: v.optional(v.string()),
    country: v.optional(v.string()),
    countryCode: v.optional(v.string()),
  })
);

export const deviceValidator = v.optional(
  v.object({
    browser: v.optional(v.string()),
    os: v.optional(v.string()),
    deviceType: v.optional(v.string()),
    platform: v.optional(v.string()),
  })
);

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

export const DIRECTORY_DEFAULT_LIMIT = 20;
export const DIRECTORY_MAX_LIMIT = 50;
export const DIRECTORY_MAX_SCAN_LIMIT = 500;
export const MERGE_REASON_EMAIL_MATCH = "email_match";
export const MERGE_HISTORY_DEFAULT_LIMIT = 20;
export const MERGE_HISTORY_MAX_LIMIT = 100;
export const MERGE_HISTORY_SCAN_FACTOR = 15;
export const MERGE_HISTORY_MIN_SCAN = 100;
export const MERGE_HISTORY_MAX_SCAN = 2000;

export function isVisitorOnline(lastSeenAt?: number): boolean {
  if (!lastSeenAt) {
    return false;
  }
  return Date.now() - lastSeenAt < ONLINE_THRESHOLD_MS;
}

export async function getDirectoryAccessStatus(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">
): Promise<{ status: "ok"; userId: Id<"users"> } | { status: "unauthenticated" | "forbidden" }> {
  const user = await getAuthenticatedUserFromSession(ctx);
  if (!user) {
    return { status: "unauthenticated" };
  }

  const canRead = await hasPermission(ctx, user._id, workspaceId, "users.read");
  if (!canRead) {
    return { status: "forbidden" };
  }

  return { status: "ok", userId: user._id };
}

export type VisitorTriggerChange = {
  attributeKey: string;
  fromValue?: string;
  toValue?: string;
};

type VisitorMergeTransferSummary = {
  reassignedConversations: number;
  reassignedSessions: number;
  migratedPushTokens: number;
  reassignedEvents: number;
};

export type VisitorMergeHistoryEntry = {
  auditLogId: Id<"auditLogs">;
  sourceVisitorId: string;
  sourceVisitorReadableId: string | null;
  targetVisitorId: string;
  targetVisitorReadableId: string | null;
  workspaceId: string;
  mergedAt: number;
  reason: string;
  reassignedConversations: number;
  reassignedSessions: number;
  migratedPushTokens: number;
  reassignedEvents: number;
};

function normalizeTriggerValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function collectStateChanges(
  before: {
    email?: string;
    name?: string;
    externalUserId?: string;
  },
  after: {
    email?: string;
    name?: string;
    externalUserId?: string;
  }
): VisitorTriggerChange[] {
  const fields: Array<keyof typeof before> = ["email", "name", "externalUserId"];
  return fields
    .map((field) => ({
      attributeKey: field,
      fromValue: normalizeTriggerValue(before[field]),
      toValue: normalizeTriggerValue(after[field]),
    }))
    .filter((change) => change.fromValue !== change.toValue);
}

export function collectCustomAttributeChanges(
  previousAttributes: Record<string, unknown> | undefined,
  patchAttributes: Record<string, unknown> | undefined
): VisitorTriggerChange[] {
  if (!patchAttributes) {
    return [];
  }

  return Object.entries(patchAttributes)
    .map(([attributeKey, to]) => {
      const from = previousAttributes?.[attributeKey];
      return {
        attributeKey,
        fromValue: normalizeTriggerValue(from),
        toValue: normalizeTriggerValue(to),
      };
    })
    .filter((change) => change.fromValue !== change.toValue);
}

export async function scheduleSeriesTriggerChanges(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    visitorId: Id<"visitors">;
    source: "visitor_attribute_changed" | "visitor_state_changed";
    changes: VisitorTriggerChange[];
  }
): Promise<void> {
  for (const change of args.changes) {
    await scheduleSeriesEvaluateEnrollment(ctx, {
      workspaceId: args.workspaceId,
      visitorId: args.visitorId,
      triggerContext: {
        source: args.source,
        attributeKey: change.attributeKey,
        fromValue: change.fromValue,
        toValue: change.toValue,
      },
    });
  }
}

function compareVisitorsForCanonicalChoice(a: Doc<"visitors">, b: Doc<"visitors">): number {
  if (a.createdAt !== b.createdAt) {
    return a.createdAt - b.createdAt;
  }
  if (a._creationTime !== b._creationTime) {
    return a._creationTime - b._creationTime;
  }
  return String(a._id).localeCompare(String(b._id));
}

export async function findCanonicalVisitorByEmail(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    email: string;
    sourceVisitorId: Id<"visitors">;
  }
): Promise<Doc<"visitors"> | null> {
  const candidates = await ctx.db
    .query("visitors")
    .withIndex("by_email", (q) => q.eq("workspaceId", args.workspaceId).eq("email", args.email))
    .collect();

  const canonicalCandidates = candidates
    .filter((candidate) => candidate._id !== args.sourceVisitorId)
    .sort(compareVisitorsForCanonicalChoice);

  return canonicalCandidates[0] ?? null;
}

export async function reassignVisitorLinksBeforeDeletion(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    sourceVisitorId: Id<"visitors">;
    targetVisitorId: Id<"visitors">;
    now: number;
  }
): Promise<VisitorMergeTransferSummary> {
  let reassignedConversations = 0;
  let reassignedSessions = 0;
  let migratedPushTokens = 0;
  let reassignedEvents = 0;

  const conversations = await ctx.db
    .query("conversations")
    .withIndex("by_visitor", (q) => q.eq("visitorId", args.sourceVisitorId))
    .collect();
  for (const conversation of conversations) {
    if (conversation.workspaceId !== args.workspaceId) {
      continue;
    }
    await ctx.db.patch(conversation._id, {
      visitorId: args.targetVisitorId,
    });
    reassignedConversations += 1;
  }

  const sessions = await ctx.db
    .query("widgetSessions")
    .withIndex("by_visitor", (q) => q.eq("visitorId", args.sourceVisitorId))
    .collect();
  for (const session of sessions) {
    if (session.workspaceId !== args.workspaceId) {
      continue;
    }
    await ctx.db.patch(session._id, {
      visitorId: args.targetVisitorId,
    });
    reassignedSessions += 1;
  }

  const targetPushTokens = await ctx.db
    .query("visitorPushTokens")
    .withIndex("by_visitor", (q) => q.eq("visitorId", args.targetVisitorId))
    .collect();
  const targetPushTokenByToken = new Map(targetPushTokens.map((token) => [token.token, token]));

  const sourcePushTokens = await ctx.db
    .query("visitorPushTokens")
    .withIndex("by_visitor", (q) => q.eq("visitorId", args.sourceVisitorId))
    .collect();
  for (const sourceToken of sourcePushTokens) {
    const targetToken = targetPushTokenByToken.get(sourceToken.token);
    if (targetToken) {
      const shouldEnableTarget =
        sourceToken.notificationsEnabled === true && targetToken.notificationsEnabled === false;
      if (shouldEnableTarget || targetToken.workspaceId !== args.workspaceId) {
        await ctx.db.patch(targetToken._id, {
          ...(shouldEnableTarget ? { notificationsEnabled: true } : {}),
          ...(targetToken.workspaceId !== args.workspaceId
            ? { workspaceId: args.workspaceId }
            : {}),
          updatedAt: args.now,
        });
      }
      await ctx.db.delete(sourceToken._id);
      continue;
    }

    await ctx.db.patch(sourceToken._id, {
      visitorId: args.targetVisitorId,
      workspaceId: args.workspaceId,
      updatedAt: args.now,
    });
    migratedPushTokens += 1;
    targetPushTokenByToken.set(sourceToken.token, sourceToken);
  }

  const events = await ctx.db
    .query("events")
    .withIndex("by_visitor", (q) => q.eq("visitorId", args.sourceVisitorId))
    .collect();
  for (const event of events) {
    if (event.workspaceId !== args.workspaceId) {
      continue;
    }
    await ctx.db.patch(event._id, {
      visitorId: args.targetVisitorId,
    });
    reassignedEvents += 1;
  }

  return {
    reassignedConversations,
    reassignedSessions,
    migratedPushTokens,
    reassignedEvents,
  };
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function toVisitorMergeHistoryEntry(log: Doc<"auditLogs">): VisitorMergeHistoryEntry | null {
  if (log.action !== "visitor.merged") {
    return null;
  }

  const metadata = log.metadata as Record<string, unknown> | undefined;
  const sourceVisitorId = readOptionalString(metadata?.sourceVisitorId);
  const targetVisitorId =
    readOptionalString(metadata?.targetVisitorId) ?? readOptionalString(log.resourceId);

  if (!sourceVisitorId || !targetVisitorId) {
    return null;
  }

  return {
    auditLogId: log._id,
    sourceVisitorId,
    sourceVisitorReadableId: readOptionalString(metadata?.sourceVisitorReadableId),
    targetVisitorId,
    targetVisitorReadableId: readOptionalString(metadata?.targetVisitorReadableId),
    workspaceId: String(log.workspaceId),
    mergedAt: readOptionalNumber(metadata?.mergedAt) ?? log.timestamp,
    reason: readOptionalString(metadata?.reason) ?? MERGE_REASON_EMAIL_MATCH,
    reassignedConversations: readOptionalNumber(metadata?.reassignedConversations) ?? 0,
    reassignedSessions: readOptionalNumber(metadata?.reassignedSessions) ?? 0,
    migratedPushTokens: readOptionalNumber(metadata?.migratedPushTokens) ?? 0,
    reassignedEvents: readOptionalNumber(metadata?.reassignedEvents) ?? 0,
  };
}

export { customAttributesValidator, formatReadableVisitorId };
