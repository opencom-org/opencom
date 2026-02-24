import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { getAuthenticatedUserFromSession } from "./auth";
import { getWorkspaceMembership, hasPermission } from "./permissions";
import { requireValidOrigin } from "./originValidation";
import { resolveVisitorFromSession } from "./widgetSessions";
import { customAttributesValidator } from "./validators";
import { formatReadableVisitorId } from "./visitorReadableId";
import { logAudit } from "./auditLogs";

const locationValidator = v.optional(
  v.object({
    city: v.optional(v.string()),
    region: v.optional(v.string()),
    country: v.optional(v.string()),
    countryCode: v.optional(v.string()),
  })
);

const deviceValidator = v.optional(
  v.object({
    browser: v.optional(v.string()),
    os: v.optional(v.string()),
    deviceType: v.optional(v.string()),
    platform: v.optional(v.string()),
  })
);

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const DIRECTORY_DEFAULT_LIMIT = 20;
const DIRECTORY_MAX_LIMIT = 50;
const DIRECTORY_MAX_SCAN_LIMIT = 500;
const MERGE_REASON_EMAIL_MATCH = "email_match";
const MERGE_HISTORY_DEFAULT_LIMIT = 20;
const MERGE_HISTORY_MAX_LIMIT = 100;
const MERGE_HISTORY_SCAN_FACTOR = 15;
const MERGE_HISTORY_MIN_SCAN = 100;
const MERGE_HISTORY_MAX_SCAN = 2000;

function isVisitorOnline(lastSeenAt?: number): boolean {
  if (!lastSeenAt) {
    return false;
  }
  return Date.now() - lastSeenAt < ONLINE_THRESHOLD_MS;
}

async function getDirectoryAccessStatus(
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

type VisitorTriggerChange = {
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

type VisitorMergeHistoryEntry = {
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

function collectStateChanges(
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

function collectCustomAttributeChanges(
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

async function scheduleSeriesTriggerChanges(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    visitorId: Id<"visitors">;
    source: "visitor_attribute_changed" | "visitor_state_changed";
    changes: VisitorTriggerChange[];
  }
): Promise<void> {
  for (const change of args.changes) {
    await ctx.scheduler.runAfter(0, (internal as any).series.evaluateEnrollmentForVisitor, {
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

async function findCanonicalVisitorByEmail(
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

async function reassignVisitorLinksBeforeDeletion(
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

function toVisitorMergeHistoryEntry(log: Doc<"auditLogs">): VisitorMergeHistoryEntry | null {
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

export const getBySession = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const visitor = visitors[0] ?? null;
    if (!visitor) return null;

    // Allow if caller is authenticated agent with workspace membership
    const user = await getAuthenticatedUserFromSession(ctx);
    if (user) {
      const membership = await getWorkspaceMembership(ctx, user._id, visitor.workspaceId);
      if (membership) return visitor;
    }

    // For visitor-side callers, the session itself serves as proof of ownership
    // (the caller must know the sessionId to query it)
    return visitor;
  },
});

export const get = query({
  args: {
    id: v.id("visitors"),
  },
  handler: async (ctx, args) => {
    const visitor = await ctx.db.get(args.id);
    if (!visitor) return null;

    // Allow if caller is authenticated agent with workspace membership
    const user = await getAuthenticatedUserFromSession(ctx);
    if (user) {
      const membership = await getWorkspaceMembership(ctx, user._id, visitor.workspaceId);
      if (membership) return visitor;
    }

    // Unauthenticated callers cannot read visitor data by ID alone
    return null;
  },
});

// getOrCreate has been removed — use widgetSessions.boot instead.

export const identify = mutation({
  args: {
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    externalUserId: v.optional(v.string()),
    userHash: v.optional(v.string()), // HMAC-SHA256 hash for identity verification
    location: locationValidator,
    device: deviceValidator,
    referrer: v.optional(v.string()),
    currentUrl: v.optional(v.string()),
    customAttributes: v.optional(customAttributesValidator),
    origin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let resolvedVisitorId = args.visitorId;

    if (args.sessionToken && resolvedVisitorId) {
      const visitor = await ctx.db.get(resolvedVisitorId);
      if (visitor) {
        const resolved = await resolveVisitorFromSession(ctx, {
          sessionToken: args.sessionToken,
          workspaceId: visitor.workspaceId,
        });
        resolvedVisitorId = resolved.visitorId;
      }
    }

    if (!resolvedVisitorId) {
      throw new Error("Visitor ID required");
    }

    const visitor = await ctx.db.get(resolvedVisitorId);
    if (!visitor) {
      throw new Error("Visitor not found");
    }
    if (!visitor.readableId) {
      await ctx.db.patch(resolvedVisitorId, {
        readableId: formatReadableVisitorId(resolvedVisitorId),
      });
    }
    await requireValidOrigin(ctx, visitor.workspaceId, args.origin);

    const now = Date.now();

    // Verify identity if userHash is provided (task 5.5)
    if (args.externalUserId && args.userHash) {
      const result = await ctx.runMutation(internal.identityVerification.verifyIdentity, {
        workspaceId: visitor.workspaceId,
        visitorId: resolvedVisitorId!,
        userId: args.externalUserId,
        userHash: args.userHash,
      });

      // Check if verification is required and failed
      if (!result.verified && !result.skipped) {
        const workspace = await ctx.db.get(visitor.workspaceId);
        if (workspace?.identityVerificationMode === "required") {
          throw new Error("Identity verification failed");
        }
      }
    } else if (args.externalUserId && !args.userHash) {
      // userId provided without userHash — reject in required mode
      const workspace = await ctx.db.get(visitor.workspaceId);
      if (
        workspace?.identityVerificationEnabled &&
        workspace?.identityVerificationMode === "required"
      ) {
        throw new Error("Identity verification failed: userHash is required");
      }
    }

    if (args.email && args.email !== visitor.email) {
      const sourceVisitorId = resolvedVisitorId!;
      const canonicalByEmail = await findCanonicalVisitorByEmail(ctx, {
        workspaceId: visitor.workspaceId,
        email: args.email,
        sourceVisitorId,
      });

      if (canonicalByEmail) {
        const sourceCustomAttributes = visitor.customAttributes as
          | Record<string, unknown>
          | undefined;
        const canonicalCustomAttributes = canonicalByEmail.customAttributes as
          | Record<string, unknown>
          | undefined;
        const patchCustomAttributes = args.customAttributes as Record<string, unknown> | undefined;
        const mergedCustomAttributes = {
          ...(sourceCustomAttributes ?? {}),
          ...(canonicalCustomAttributes ?? {}),
          ...(patchCustomAttributes ?? {}),
        };
        const hasMergedCustomAttributes = Object.keys(mergedCustomAttributes).length > 0;
        const canonicalReadableId =
          canonicalByEmail.readableId ?? formatReadableVisitorId(canonicalByEmail._id);

        const stateChanges = collectStateChanges(
          {
            email: canonicalByEmail.email,
            name: canonicalByEmail.name,
            externalUserId: canonicalByEmail.externalUserId,
          },
          {
            email: args.email,
            name: args.name ?? canonicalByEmail.name ?? visitor.name,
            externalUserId:
              args.externalUserId ?? canonicalByEmail.externalUserId ?? visitor.externalUserId,
          }
        );
        const attributeChanges = collectCustomAttributeChanges(
          canonicalCustomAttributes,
          hasMergedCustomAttributes ? mergedCustomAttributes : undefined
        );

        const transferSummary = await reassignVisitorLinksBeforeDeletion(ctx, {
          workspaceId: visitor.workspaceId,
          sourceVisitorId,
          targetVisitorId: canonicalByEmail._id,
          now,
        });

        await ctx.db.patch(canonicalByEmail._id, {
          ...(canonicalByEmail.readableId ? {} : { readableId: canonicalReadableId }),
          lastSeenAt: now,
          ...(args.name
            ? { name: args.name }
            : !canonicalByEmail.name && visitor.name
              ? { name: visitor.name }
              : {}),
          ...(args.externalUserId
            ? { externalUserId: args.externalUserId }
            : !canonicalByEmail.externalUserId && visitor.externalUserId
              ? { externalUserId: visitor.externalUserId }
              : {}),
          ...(args.location
            ? { location: args.location }
            : !canonicalByEmail.location && visitor.location
              ? { location: visitor.location }
              : {}),
          ...(args.device
            ? { device: args.device }
            : !canonicalByEmail.device && visitor.device
              ? { device: visitor.device }
              : {}),
          ...(args.referrer
            ? { referrer: args.referrer }
            : !canonicalByEmail.referrer && visitor.referrer
              ? { referrer: visitor.referrer }
              : {}),
          ...(args.currentUrl
            ? { currentUrl: args.currentUrl }
            : !canonicalByEmail.currentUrl && visitor.currentUrl
              ? { currentUrl: visitor.currentUrl }
              : {}),
          ...(hasMergedCustomAttributes ? { customAttributes: mergedCustomAttributes as any } : {}),
        });

        await ctx.db.delete(sourceVisitorId);

        await scheduleSeriesTriggerChanges(ctx, {
          workspaceId: visitor.workspaceId,
          visitorId: canonicalByEmail._id,
          source: "visitor_state_changed",
          changes: stateChanges,
        });
        await scheduleSeriesTriggerChanges(ctx, {
          workspaceId: visitor.workspaceId,
          visitorId: canonicalByEmail._id,
          source: "visitor_attribute_changed",
          changes: attributeChanges,
        });

        await logAudit(ctx, {
          workspaceId: visitor.workspaceId,
          actorType: "api",
          action: "visitor.merged",
          resourceType: "visitor",
          resourceId: canonicalByEmail._id,
          metadata: {
            sourceVisitorId,
            sourceVisitorReadableId: visitor.readableId ?? formatReadableVisitorId(sourceVisitorId),
            targetVisitorId: canonicalByEmail._id,
            targetVisitorReadableId: canonicalReadableId,
            workspaceId: visitor.workspaceId,
            reason: MERGE_REASON_EMAIL_MATCH,
            mergedAt: now,
            reassignedConversations: transferSummary.reassignedConversations,
            reassignedSessions: transferSummary.reassignedSessions,
            migratedPushTokens: transferSummary.migratedPushTokens,
            reassignedEvents: transferSummary.reassignedEvents,
          },
        });

        return await ctx.db.get(canonicalByEmail._id);
      }
    }

    const stateChanges = collectStateChanges(
      {
        email: visitor.email,
        name: visitor.name,
        externalUserId: visitor.externalUserId,
      },
      {
        email: args.email ?? visitor.email,
        name: args.name ?? visitor.name,
        externalUserId: args.externalUserId ?? visitor.externalUserId,
      }
    );
    const attributeChanges = collectCustomAttributeChanges(
      visitor.customAttributes as Record<string, unknown> | undefined,
      args.customAttributes as Record<string, unknown> | undefined
    );

    await ctx.db.patch(resolvedVisitorId!, {
      lastSeenAt: now,
      ...(args.email && { email: args.email }),
      ...(args.name && { name: args.name }),
      ...(args.externalUserId && { externalUserId: args.externalUserId }),
      ...(args.location && { location: args.location }),
      ...(args.device && { device: args.device }),
      ...(args.referrer && { referrer: args.referrer }),
      ...(args.currentUrl && { currentUrl: args.currentUrl }),
      ...(args.customAttributes && {
        customAttributes: {
          ...visitor.customAttributes,
          ...args.customAttributes,
        },
      }),
    });

    await scheduleSeriesTriggerChanges(ctx, {
      workspaceId: visitor.workspaceId,
      visitorId: resolvedVisitorId!,
      source: "visitor_state_changed",
      changes: stateChanges,
    });
    await scheduleSeriesTriggerChanges(ctx, {
      workspaceId: visitor.workspaceId,
      visitorId: resolvedVisitorId!,
      source: "visitor_attribute_changed",
      changes: attributeChanges,
    });

    return await ctx.db.get(resolvedVisitorId!);
  },
});

export const updateLocation = mutation({
  args: {
    visitorId: v.id("visitors"),
    sessionToken: v.optional(v.string()),
    location: v.object({
      city: v.optional(v.string()),
      region: v.optional(v.string()),
      country: v.optional(v.string()),
      countryCode: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor) {
      throw new Error("Visitor not found");
    }

    const authUser = await getAuthenticatedUserFromSession(ctx);
    if (authUser) {
      const canRead = await hasPermission(ctx, authUser._id, visitor.workspaceId, "users.read");
      if (!canRead) {
        throw new Error("Permission denied");
      }
    } else {
      const resolved = await resolveVisitorFromSession(ctx, {
        sessionToken: args.sessionToken,
        workspaceId: visitor.workspaceId,
      });
      if (resolved.visitorId !== args.visitorId) {
        throw new Error("Not authorized to update location for this visitor");
      }
    }

    await ctx.db.patch(args.visitorId, {
      location: args.location,
      lastSeenAt: Date.now(),
    });
  },
});

export const heartbeat = mutation({
  args: {
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    origin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let resolvedVisitorId = args.visitorId;

    if (args.sessionToken && resolvedVisitorId) {
      const visitor = await ctx.db.get(resolvedVisitorId);
      if (visitor) {
        try {
          const resolved = await resolveVisitorFromSession(ctx, {
            sessionToken: args.sessionToken,
            workspaceId: visitor.workspaceId,
          });
          resolvedVisitorId = resolved.visitorId;
        } catch {
          return; // Silently fail for heartbeat
        }
      }
    }

    if (!resolvedVisitorId) return;

    const visitor = await ctx.db.get(resolvedVisitorId);
    if (!visitor) return;
    await requireValidOrigin(ctx, visitor.workspaceId, args.origin);
    await ctx.db.patch(resolvedVisitorId!, {
      lastSeenAt: Date.now(),
    });
  },
});

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return [];
    }
    const canRead = await hasPermission(ctx, user._id, args.workspaceId, "users.read");
    if (!canRead) {
      return [];
    }

    const limit = args.limit ?? 100;
    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(limit);
    return visitors;
  },
});

export const search = query({
  args: {
    workspaceId: v.id("workspaces"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return [];
    }
    const canRead = await hasPermission(ctx, user._id, args.workspaceId, "users.read");
    if (!canRead) {
      return [];
    }

    const limit = Math.min(args.limit ?? 20, 50); // Rate limit: max 50 results
    const queryText = args.query.trim();

    if (queryText.length < 2) {
      return []; // Require at least 2 characters to search
    }

    // Try search index for name matches first
    const nameMatches = await ctx.db
      .query("visitors")
      .withSearchIndex("search_visitors", (q) =>
        q.search("name", queryText).eq("workspaceId", args.workspaceId)
      )
      .take(limit);

    // Also check email index for exact email prefix matches
    const emailMatches = await ctx.db
      .query("visitors")
      .withIndex("by_email", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) =>
        q.or(q.eq(q.field("email"), queryText), q.eq(q.field("email"), queryText.toLowerCase()))
      )
      .take(limit);

    // Merge results, deduplicate by ID
    const seen = new Set<string>();
    const results: typeof nameMatches = [];

    for (const visitor of [...nameMatches, ...emailMatches]) {
      if (!seen.has(visitor._id)) {
        seen.add(visitor._id);
        results.push(visitor);
        if (results.length >= limit) break;
      }
    }

    return results;
  },
});

export const listDirectory = query({
  args: {
    workspaceId: v.id("workspaces"),
    search: v.optional(v.string()),
    presence: v.optional(v.union(v.literal("all"), v.literal("online"), v.literal("offline"))),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const access = await getDirectoryAccessStatus(ctx, args.workspaceId);
    if (access.status !== "ok") {
      return {
        status: access.status,
        visitors: [],
        totalCount: 0,
        hasMore: false,
        nextOffset: null,
      };
    }

    const limit = Math.max(1, Math.min(args.limit ?? DIRECTORY_DEFAULT_LIMIT, DIRECTORY_MAX_LIMIT));
    const offset = Math.max(0, args.offset ?? 0);
    const search = args.search?.trim().toLowerCase() ?? "";
    const presence = args.presence ?? "all";

    const candidates = await ctx.db
      .query("visitors")
      .withIndex("by_workspace_last_seen", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(DIRECTORY_MAX_SCAN_LIMIT);

    const filtered = candidates.filter((visitor) => {
      const readableId = (visitor.readableId ?? formatReadableVisitorId(visitor._id)).toLowerCase();
      const matchesSearch =
        search.length === 0 ||
        readableId.includes(search) ||
        String(visitor._id).toLowerCase().includes(search) ||
        visitor.name?.toLowerCase().includes(search) ||
        visitor.email?.toLowerCase().includes(search) ||
        visitor.externalUserId?.toLowerCase().includes(search);
      if (!matchesSearch) {
        return false;
      }

      const online = isVisitorOnline(visitor.lastSeenAt);
      if (presence === "online") {
        return online;
      }
      if (presence === "offline") {
        return !online;
      }
      return true;
    });

    const page = filtered.slice(offset, offset + limit).map((visitor) => ({
      ...visitor,
      isOnline: isVisitorOnline(visitor.lastSeenAt),
      lastActiveAt: visitor.lastSeenAt ?? visitor.firstSeenAt ?? visitor.createdAt,
    }));

    const totalCount = filtered.length;
    const hasMore = offset + limit < totalCount;

    return {
      status: "ok" as const,
      visitors: page,
      totalCount,
      hasMore,
      nextOffset: hasMore ? offset + limit : null,
    };
  },
});

export const getMergeHistory = query({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.id("visitors"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const access = await getDirectoryAccessStatus(ctx, args.workspaceId);
    if (access.status !== "ok") {
      return {
        status: access.status,
        entries: [],
      };
    }

    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor) {
      return {
        status: "not_found" as const,
        entries: [],
      };
    }

    if (visitor.workspaceId !== args.workspaceId) {
      return {
        status: "forbidden" as const,
        entries: [],
      };
    }

    const limit = Math.max(
      1,
      Math.min(args.limit ?? MERGE_HISTORY_DEFAULT_LIMIT, MERGE_HISTORY_MAX_LIMIT)
    );
    const scanLimit = Math.min(
      MERGE_HISTORY_MAX_SCAN,
      Math.max(MERGE_HISTORY_MIN_SCAN, limit * MERGE_HISTORY_SCAN_FACTOR)
    );
    const visitorId = String(args.visitorId);

    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_workspace_timestamp", (q) =>
        q.eq("workspaceId", args.workspaceId).gte("timestamp", 0)
      )
      .order("desc")
      .take(scanLimit);

    const entries = logs
      .map(toVisitorMergeHistoryEntry)
      .filter((entry): entry is VisitorMergeHistoryEntry => !!entry)
      .filter((entry) => entry.targetVisitorId === visitorId || entry.sourceVisitorId === visitorId)
      .slice(0, limit);

    return {
      status: "ok" as const,
      entries,
    };
  },
});

export const getDirectoryDetail = query({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.id("visitors"),
  },
  handler: async (ctx, args) => {
    const access = await getDirectoryAccessStatus(ctx, args.workspaceId);
    if (access.status !== "ok") {
      return {
        status: access.status,
        visitor: null,
        linkedConversations: [],
        linkedTickets: [],
        resourceAccess: { conversations: false, tickets: false },
      };
    }

    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor) {
      return {
        status: "not_found" as const,
        visitor: null,
        linkedConversations: [],
        linkedTickets: [],
        resourceAccess: { conversations: false, tickets: false },
      };
    }

    if (visitor.workspaceId !== args.workspaceId) {
      return {
        status: "forbidden" as const,
        visitor: null,
        linkedConversations: [],
        linkedTickets: [],
        resourceAccess: { conversations: false, tickets: false },
      };
    }

    const canReadLinkedResources = await hasPermission(
      ctx,
      access.userId,
      args.workspaceId,
      "conversations.read"
    );

    let linkedConversations: Array<{
      _id: string;
      status: string;
      channel?: string;
      subject?: string;
      updatedAt: number;
      lastMessageAt?: number;
      lastMessagePreview?: string;
    }> = [];
    if (canReadLinkedResources) {
      const conversations = (
        await ctx.db
          .query("conversations")
          .withIndex("by_visitor", (q) => q.eq("visitorId", args.visitorId))
          .order("desc")
          .take(10)
      ).filter((conversation) => conversation.workspaceId === args.workspaceId);

      const lastMessages = await Promise.all(
        conversations.map(async (conversation) =>
          ctx.db
            .query("messages")
            .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
            .order("desc")
            .first()
        )
      );

      linkedConversations = conversations.map((conversation, index) => ({
        _id: conversation._id,
        status: conversation.status,
        channel: conversation.channel,
        subject: conversation.subject,
        updatedAt: conversation.updatedAt,
        lastMessageAt: conversation.lastMessageAt,
        lastMessagePreview: lastMessages[index]?.content,
      }));
    }

    let linkedTickets: Array<{
      _id: string;
      subject: string;
      status: string;
      priority: string;
      updatedAt: number;
    }> = [];
    if (canReadLinkedResources) {
      linkedTickets = (
        await ctx.db
          .query("tickets")
          .withIndex("by_visitor", (q) => q.eq("visitorId", args.visitorId))
          .order("desc")
          .take(10)
      )
        .filter((ticket) => ticket.workspaceId === args.workspaceId)
        .map((ticket) => ({
          _id: ticket._id,
          subject: ticket.subject,
          status: ticket.status,
          priority: ticket.priority,
          updatedAt: ticket.updatedAt,
        }));
    }

    return {
      status: "ok" as const,
      visitor: {
        ...visitor,
        isOnline: isVisitorOnline(visitor.lastSeenAt),
        lastActiveAt: visitor.lastSeenAt ?? visitor.firstSeenAt ?? visitor.createdAt,
      },
      linkedConversations,
      linkedTickets,
      resourceAccess: {
        conversations: canReadLinkedResources,
        tickets: canReadLinkedResources,
      },
    };
  },
});

export const isOnline = query({
  args: {
    visitorId: v.id("visitors"),
  },
  handler: async (ctx, args) => {
    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor || !visitor.lastSeenAt) {
      return false;
    }
    return Date.now() - visitor.lastSeenAt < ONLINE_THRESHOLD_MS;
  },
});
