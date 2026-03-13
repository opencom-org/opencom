import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { logAudit } from "./auditLogs";
import { encodeCursor, decodeCursor } from "./lib/apiHelpers";

const DEFAULT_SCAN_BATCH_SIZE = 200;

type DescCursor = {
  sortValue?: number;
  id?: string;
};

type VisitorFilterOptions = {
  email?: string;
  externalUserId?: string;
  customAttributeKey?: string;
  customAttributeValue?: string;
};

function decodeDescCursor(cursor?: string): DescCursor {
  if (!cursor) {
    return {};
  }

  const decoded = decodeCursor(cursor);
  if (decoded) {
    return { sortValue: decoded.sortValue, id: decoded.id };
  }

  const fallbackSortValue = Number.parseFloat(cursor);
  return Number.isFinite(fallbackSortValue) ? { sortValue: fallbackSortValue } : {};
}

function isAtOrPastCursor(
  sortValue: number | undefined,
  id: string,
  cursor: DescCursor
): boolean {
  return (
    cursor.sortValue !== undefined &&
    cursor.id !== undefined &&
    sortValue === cursor.sortValue &&
    id >= cursor.id
  );
}

async function collectDescendingPage<T extends { _id: string }>(options: {
  limit: number;
  cursor: DescCursor;
  getSortValue: (item: T) => number | undefined;
  fetchBatch: (upperBound: number | undefined, take: number) => Promise<T[]>;
  filterBatch?: (batch: T[]) => Promise<T[]> | T[];
}): Promise<T[]> {
  const results: T[] = [];
  let scanCursor = options.cursor;
  let batchSize = Math.max(options.limit * 3, DEFAULT_SCAN_BATCH_SIZE);

  while (results.length < options.limit + 1) {
    const batch = await options.fetchBatch(scanCursor.sortValue, batchSize);
    if (batch.length === 0) {
      break;
    }

    const visibleBatch = scanCursor.id
      ? batch.filter(
          (item) => !isAtOrPastCursor(options.getSortValue(item), item._id, scanCursor)
        )
      : batch;

    if (scanCursor.id && visibleBatch.length === 0 && batch.length === batchSize) {
      // The current window hasn't scanned far enough to move past the cursor
      // within a large same-timestamp tie. Expand and retry from the same
      // cursor instead of rewinding scanCursor to an earlier batch boundary.
      batchSize *= 2;
      continue;
    }

    const filteredBatch = options.filterBatch
      ? await options.filterBatch(visibleBatch)
      : visibleBatch;

    for (const item of filteredBatch) {
      results.push(item);
      if (results.length >= options.limit + 1) {
        return results;
      }
    }

    if (batch.length < batchSize) {
      break;
    }

    const lastBatchItem = batch[batch.length - 1];
    const nextCursor = {
      sortValue: options.getSortValue(lastBatchItem),
      id: lastBatchItem._id,
    };

    if (
      nextCursor.sortValue === scanCursor.sortValue &&
      nextCursor.id === scanCursor.id
    ) {
      // Keep expanding the fetch window until we move past the current tie on
      // the indexed sort value. Capping this causes large same-timestamp groups
      // to become unpageable.
      batchSize *= 2;
      continue;
    }

    scanCursor = nextCursor;
  }

  return results;
}

async function loadVisitorsById(
  ctx: any,
  visitorIds: Array<Id<"visitors"> | undefined>
): Promise<Map<string, Doc<"visitors">>> {
  const uniqueVisitorIds = Array.from(
    new Set(visitorIds.filter((visitorId): visitorId is Id<"visitors"> => !!visitorId))
  );

  const visitors = await Promise.all(
    uniqueVisitorIds.map(async (visitorId) => {
      const visitor = await ctx.db.get(visitorId);
      return visitor ? ([String(visitorId), visitor] as const) : null;
    })
  );

  return new Map(
    visitors.filter(
      (entry): entry is readonly [string, Doc<"visitors">] => entry !== null
    )
  );
}

function matchesVisitorFilters(
  visitor: Doc<"visitors"> | undefined,
  filters: VisitorFilterOptions
): boolean {
  if (filters.email && visitor?.email !== filters.email) {
    return false;
  }
  if (filters.externalUserId && visitor?.externalUserId !== filters.externalUserId) {
    return false;
  }
  if (
    filters.customAttributeKey &&
    filters.customAttributeValue !== undefined &&
    (visitor?.customAttributes as Record<string, unknown> | undefined)?.[
      filters.customAttributeKey
    ] !== filters.customAttributeValue
  ) {
    return false;
  }
  return true;
}

// ── Conversations ──────────────────────────────────────────────────

export const listConversationsForAutomation = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    cursor: v.optional(v.string()),
    limit: v.number(),
    updatedSince: v.optional(v.number()),
    status: v.optional(v.string()),
    assigneeId: v.optional(v.string()),
    channel: v.optional(v.string()),
    email: v.optional(v.string()),
    externalUserId: v.optional(v.string()),
    customAttributeKey: v.optional(v.string()),
    customAttributeValue: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit, 100);
    const cursor = decodeDescCursor(args.cursor);
    const needsVisitorFilters = Boolean(
      args.email ||
        args.externalUserId ||
        (args.customAttributeKey && args.customAttributeValue !== undefined)
    );
    const visitorFilters: VisitorFilterOptions = {
      email: args.email ?? undefined,
      externalUserId: args.externalUserId ?? undefined,
      customAttributeKey: args.customAttributeKey ?? undefined,
      customAttributeValue: args.customAttributeValue ?? undefined,
    };

    const conversations = await collectDescendingPage<Doc<"conversations">>({
      limit,
      cursor,
      getSortValue: (conversation) => conversation.updatedAt,
      fetchBatch: async (upperBound, take) => {
        let query = ctx.db
          .query("conversations")
          .withIndex("by_workspace_updated_at", (q) => {
            if (args.updatedSince !== undefined && upperBound !== undefined) {
              return q
                .eq("workspaceId", args.workspaceId)
                .gt("updatedAt", args.updatedSince)
                .lte("updatedAt", upperBound);
            }
            if (args.updatedSince !== undefined) {
              return q.eq("workspaceId", args.workspaceId).gt("updatedAt", args.updatedSince);
            }
            if (upperBound !== undefined) {
              return q.eq("workspaceId", args.workspaceId).lte("updatedAt", upperBound);
            }
            return q.eq("workspaceId", args.workspaceId);
          });

        if (args.status) {
          query = query.filter((q2) => q2.eq(q2.field("status"), args.status!));
        }
        if (args.channel) {
          query = query.filter((q2) => q2.eq(q2.field("channel"), args.channel!));
        }
        if (args.assigneeId) {
          query = query.filter((q2) => q2.eq(q2.field("assignedAgentId"), args.assigneeId!));
        }

        return query.order("desc").take(take);
      },
      filterBatch: async (batch) => {
        if (!needsVisitorFilters) {
          return batch;
        }

        const visitorMap = await loadVisitorsById(
          ctx,
          batch.map((conversation) => conversation.visitorId)
        );

        return batch.filter((conversation) =>
          matchesVisitorFilters(
            conversation.visitorId
              ? visitorMap.get(String(conversation.visitorId))
              : undefined,
            visitorFilters
          )
        );
      },
    });

    const hasMore = conversations.length > limit;
    const data = hasMore ? conversations.slice(0, limit) : conversations;

    // Get active claims and last inbound message for these conversations
    const claimMap = new Map<string, { credentialId: string; expiresAt: number }>();
    const inboundMap = new Map<string, { lastInboundMessageAt: number; lastInboundMessagePreview: string | null }>();
    for (const conv of data) {
      const claim = await ctx.db
        .query("automationConversationClaims")
        .withIndex("by_conversation_status", (q) =>
          q.eq("conversationId", conv._id).eq("status", "active")
        )
        .first();
      if (claim && claim.expiresAt > Date.now()) {
        claimMap.set(conv._id, {
          credentialId: claim.credentialId,
          expiresAt: claim.expiresAt,
        });
      }

      const lastInbound = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
        .order("desc")
        .filter((q) => q.eq(q.field("senderType"), "visitor"))
        .first();
      if (lastInbound) {
        inboundMap.set(conv._id, {
          lastInboundMessageAt: lastInbound.createdAt,
          lastInboundMessagePreview: lastInbound.content?.slice(0, 200) ?? null,
        });
      }
    }

    return {
      data: data.map((c) => {
        const activeClaim = claimMap.get(c._id) ?? null;
        const inbound = inboundMap.get(c._id);
        return {
          id: c._id,
          workspaceId: c.workspaceId,
          visitorId: c.visitorId,
          assignedAgentId: c.assignedAgentId,
          status: c.status,
          channel: c.channel,
          subject: c.subject,
          aiWorkflowState: c.aiWorkflowState,
          aiHandoffReason: c.aiHandoffReason,
          automationEligible: c.status === "open" && !activeClaim && c.aiWorkflowState !== "ai_handled",
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          lastMessageAt: c.lastMessageAt,
          lastInboundMessageAt: inbound?.lastInboundMessageAt ?? null,
          lastInboundMessagePreview: inbound?.lastInboundMessagePreview ?? null,
          claim: activeClaim,
        };
      }),
      nextCursor:
        hasMore && data.length > 0
          ? encodeCursor(data[data.length - 1].updatedAt, data[data.length - 1]._id)
          : null,
      hasMore,
    };
  },
});

export const getConversationForAutomation = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.workspaceId !== args.workspaceId) {
      return null;
    }

    const claim = await ctx.db
      .query("automationConversationClaims")
      .withIndex("by_conversation_status", (q) =>
        q.eq("conversationId", conv._id).eq("status", "active")
      )
      .first();

    const activeClaim =
      claim && claim.expiresAt > Date.now()
        ? { credentialId: claim.credentialId, expiresAt: claim.expiresAt }
        : null;

    // Look up last inbound message for enrichment
    const lastInboundMessage = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
      .order("desc")
      .filter((q) => q.eq(q.field("senderType"), "visitor"))
      .first();

    return {
      id: conv._id,
      workspaceId: conv.workspaceId,
      visitorId: conv.visitorId,
      assignedAgentId: conv.assignedAgentId,
      status: conv.status,
      channel: conv.channel,
      subject: conv.subject,
      aiWorkflowState: conv.aiWorkflowState,
      aiHandoffReason: conv.aiHandoffReason,
      automationEligible: conv.status === "open" && !activeClaim && conv.aiWorkflowState !== "ai_handled",
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      lastMessageAt: conv.lastMessageAt,
      lastInboundMessageAt: lastInboundMessage?.createdAt ?? null,
      lastInboundMessagePreview: lastInboundMessage?.content?.slice(0, 200) ?? null,
      claim: activeClaim,
    };
  },
});

export const updateConversationForAutomation = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    credentialId: v.optional(v.id("automationCredentials")),
    status: v.optional(
      v.union(v.literal("open"), v.literal("closed"), v.literal("snoozed"))
    ),
    assignedAgentId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.workspaceId !== args.workspaceId) {
      throw new Error("Conversation not found");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.status !== undefined) {
      updates.status = args.status;
      if (args.status === "closed") {
        updates.resolvedAt = Date.now();
      }
    }
    if (args.assignedAgentId !== undefined) {
      updates.assignedAgentId = args.assignedAgentId;
    }

    await ctx.db.patch(args.conversationId, updates);

    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorType: "api",
      action: "automation.conversation.updated",
      resourceType: "conversation",
      resourceId: String(args.conversationId),
      metadata: { credentialId: args.credentialId ? String(args.credentialId) : null },
    });

    return { id: args.conversationId };
  },
});

// ── Messages ───────────────────────────────────────────────────────

export const listMessagesForAutomation = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    cursor: v.optional(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.workspaceId !== args.workspaceId) {
      return { data: [], nextCursor: null, hasMore: false };
    }

    const limit = Math.min(args.limit, 100);
    let messagesQuery = ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId));

    // Decode compound cursor; fall back to bare number for backward compat
    let cursorTs: number | undefined;
    let cursorId: string | undefined;
    if (args.cursor) {
      const decoded = decodeCursor(args.cursor);
      if (decoded) {
        cursorTs = decoded.sortValue;
        cursorId = decoded.id;
      } else {
        cursorTs = Number.parseFloat(args.cursor);
      }
    }

    if (cursorTs !== undefined) {
      messagesQuery = messagesQuery.filter((q2) => q2.gte(q2.field("_creationTime"), cursorTs!));
    }
    const fetchSize = cursorId ? limit + 50 : limit + 1;
    let messages = await messagesQuery.order("asc").take(fetchSize);

    // For ascending: skip items at cursor timestamp with _id <= cursorId
    if (cursorId) {
      messages = messages.filter(
        (m) => !(m._creationTime === cursorTs && m._id <= cursorId!)
      );
    }

    const hasMore = messages.length > limit;
    const data = hasMore ? messages.slice(0, limit) : messages;

    return {
      data: data.map((m) => ({
        id: m._id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        senderType: m.senderType,
        content: m.content,
        createdAt: m.createdAt,
      })),
      nextCursor:
        hasMore && data.length > 0
          ? encodeCursor(data[data.length - 1]._creationTime, data[data.length - 1]._id)
          : null,
      hasMore,
    };
  },
});

export const sendMessageForAutomation = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    credentialId: v.id("automationCredentials"),
    actorName: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.workspaceId !== args.workspaceId) {
      throw new Error("Conversation not found");
    }

    // Require active claim for this credential
    const claim = await ctx.db
      .query("automationConversationClaims")
      .withIndex("by_conversation_status", (q) =>
        q.eq("conversationId", args.conversationId).eq("status", "active")
      )
      .first();

    if (!claim || claim.credentialId !== args.credentialId) {
      throw new Error("No active claim for this conversation. Claim the conversation first.");
    }

    if (claim.expiresAt < Date.now()) {
      throw new Error("Claim has expired. Renew or re-claim the conversation.");
    }

    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: `automation:${args.actorName}`,
      senderType: "bot",
      content: args.content,
      automationCredentialId: args.credentialId,
      createdAt: now,
    });

    await ctx.db.patch(args.conversationId, {
      updatedAt: now,
      lastMessageAt: now,
      unreadByVisitor: (conv.unreadByVisitor || 0) + 1,
    });

    // Extend claim lease on activity
    await ctx.db.patch(claim._id, {
      expiresAt: now + 5 * 60 * 1000, // 5 min from now
    });

    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorType: "api",
      action: "automation.message.sent",
      resourceType: "message",
      resourceId: String(messageId),
      metadata: { credentialId: String(args.credentialId) },
    });

    return { id: messageId };
  },
});

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const sendMessageIdempotent = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    credentialId: v.id("automationCredentials"),
    actorName: v.string(),
    content: v.string(),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check idempotency key if provided
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("automationIdempotencyKeys")
        .withIndex("by_workspace_key", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("key", args.idempotencyKey!)
        )
        .first();

      if (existing && existing.expiresAt >= Date.now()) {
        return { cached: true, result: existing.responseSnapshot };
      }
    }

    // Perform the message send (same logic as sendMessageForAutomation)
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.workspaceId !== args.workspaceId) {
      throw new Error("Conversation not found");
    }

    const claim = await ctx.db
      .query("automationConversationClaims")
      .withIndex("by_conversation_status", (q) =>
        q.eq("conversationId", args.conversationId).eq("status", "active")
      )
      .first();

    if (!claim || claim.credentialId !== args.credentialId) {
      throw new Error("No active claim for this conversation. Claim the conversation first.");
    }

    if (claim.expiresAt < Date.now()) {
      throw new Error("Claim has expired. Renew or re-claim the conversation.");
    }

    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: `automation:${args.actorName}`,
      senderType: "bot",
      content: args.content,
      automationCredentialId: args.credentialId,
      createdAt: now,
    });

    await ctx.db.patch(args.conversationId, {
      updatedAt: now,
      lastMessageAt: now,
      unreadByVisitor: (conv.unreadByVisitor || 0) + 1,
    });

    await ctx.db.patch(claim._id, {
      expiresAt: now + 5 * 60 * 1000,
    });

    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorType: "api",
      action: "automation.message.sent",
      resourceType: "message",
      resourceId: String(messageId),
      metadata: { credentialId: String(args.credentialId) },
    });

    const result = { id: messageId };

    // Store idempotency key if provided
    if (args.idempotencyKey) {
      await ctx.db.insert("automationIdempotencyKeys", {
        workspaceId: args.workspaceId,
        key: args.idempotencyKey,
        credentialId: args.credentialId,
        resourceType: "message",
        resourceId: String(messageId),
        responseSnapshot: result,
        expiresAt: now + IDEMPOTENCY_TTL_MS,
      });
    }

    return { cached: false, result };
  },
});

// ── Visitors ───────────────────────────────────────────────────────

export const listVisitorsForAutomation = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    cursor: v.optional(v.string()),
    limit: v.number(),
    updatedSince: v.optional(v.number()),
    email: v.optional(v.string()),
    externalUserId: v.optional(v.string()),
    customAttributeKey: v.optional(v.string()),
    customAttributeValue: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit, 100);
    const cursor = decodeDescCursor(args.cursor);

    const visitors = await collectDescendingPage<Doc<"visitors">>({
      limit,
      cursor,
      getSortValue: (visitor) => visitor.lastSeenAt,
      fetchBatch: async (upperBound, take) => {
        let query = ctx.db
          .query("visitors")
          .withIndex("by_workspace_last_seen", (q) => {
            if (args.updatedSince !== undefined && upperBound !== undefined) {
              return q
                .eq("workspaceId", args.workspaceId)
                .gt("lastSeenAt", args.updatedSince)
                .lte("lastSeenAt", upperBound);
            }
            if (args.updatedSince !== undefined) {
              return q.eq("workspaceId", args.workspaceId).gt("lastSeenAt", args.updatedSince);
            }
            if (upperBound !== undefined) {
              return q.eq("workspaceId", args.workspaceId).lte("lastSeenAt", upperBound);
            }
            return q.eq("workspaceId", args.workspaceId);
          });

        if (args.email) {
          query = query.filter((q2) => q2.eq(q2.field("email"), args.email!));
        }
        if (args.externalUserId) {
          query = query.filter((q2) => q2.eq(q2.field("externalUserId"), args.externalUserId!));
        }

        return query.order("desc").take(take);
      },
      filterBatch: (batch) => {
        if (!args.customAttributeKey || args.customAttributeValue === undefined) {
          return batch;
        }

        return batch.filter(
          (visitor) =>
            (visitor.customAttributes as Record<string, unknown> | undefined)?.[
              args.customAttributeKey!
            ] === args.customAttributeValue
        );
      },
    });

    const hasMore = visitors.length > limit;
    const data = hasMore ? visitors.slice(0, limit) : visitors;

    return {
      data: data.map((v) => ({
        id: v._id,
        workspaceId: v.workspaceId,
        email: v.email,
        name: v.name,
        externalUserId: v.externalUserId,
        location: v.location,
        customAttributes: v.customAttributes,
        firstSeenAt: v.firstSeenAt,
        lastSeenAt: v.lastSeenAt,
        createdAt: v.createdAt,
      })),
      nextCursor:
        hasMore && data.length > 0
          ? encodeCursor(
              data[data.length - 1].lastSeenAt ?? data[data.length - 1].createdAt,
              data[data.length - 1]._id
            )
          : null,
      hasMore,
    };
  },
});

export const getVisitorForAutomation = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.id("visitors"),
  },
  handler: async (ctx, args) => {
    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor || visitor.workspaceId !== args.workspaceId) {
      return null;
    }

    return {
      id: visitor._id,
      workspaceId: visitor.workspaceId,
      email: visitor.email,
      name: visitor.name,
      externalUserId: visitor.externalUserId,
      location: visitor.location,
      device: visitor.device,
      customAttributes: visitor.customAttributes,
      firstSeenAt: visitor.firstSeenAt,
      lastSeenAt: visitor.lastSeenAt,
      createdAt: visitor.createdAt,
      identityVerified: visitor.identityVerified,
    };
  },
});

export const createVisitorForAutomation = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    credentialId: v.optional(v.id("automationCredentials")),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    externalUserId: v.optional(v.string()),
    customAttributes: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const sessionId = `automation_${now}_${Math.random().toString(36).slice(2)}`;

    const id = await ctx.db.insert("visitors", {
      workspaceId: args.workspaceId,
      sessionId,
      email: args.email,
      name: args.name,
      externalUserId: args.externalUserId,
      customAttributes: args.customAttributes,
      createdAt: now,
      firstSeenAt: now,
      lastSeenAt: now,
    });

    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorType: "api",
      action: "automation.visitor.created",
      resourceType: "visitor",
      resourceId: String(id),
      metadata: { credentialId: args.credentialId ? String(args.credentialId) : null },
    });

    return { id };
  },
});

export const updateVisitorForAutomation = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    credentialId: v.optional(v.id("automationCredentials")),
    visitorId: v.id("visitors"),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    externalUserId: v.optional(v.string()),
    customAttributes: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor || visitor.workspaceId !== args.workspaceId) {
      throw new Error("Visitor not found");
    }

    const updates: Record<string, unknown> = {};
    if (args.email !== undefined) updates.email = args.email;
    if (args.name !== undefined) updates.name = args.name;
    if (args.externalUserId !== undefined) updates.externalUserId = args.externalUserId;
    if (args.customAttributes !== undefined) updates.customAttributes = args.customAttributes;
    updates.lastSeenAt = Date.now();

    await ctx.db.patch(args.visitorId, updates);

    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorType: "api",
      action: "automation.visitor.updated",
      resourceType: "visitor",
      resourceId: String(args.visitorId),
      metadata: { credentialId: args.credentialId ? String(args.credentialId) : null },
    });

    return { id: args.visitorId };
  },
});

// ── Tickets ────────────────────────────────────────────────────────

export const listTicketsForAutomation = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    cursor: v.optional(v.string()),
    limit: v.number(),
    updatedSince: v.optional(v.number()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    assigneeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit, 100);
    const cursor = decodeDescCursor(args.cursor);

    const tickets = await collectDescendingPage<Doc<"tickets">>({
      limit,
      cursor,
      getSortValue: (ticket) => ticket.updatedAt,
      fetchBatch: async (upperBound, take) => {
        let query = ctx.db
          .query("tickets")
          .withIndex("by_workspace_updated_at", (q) => {
            if (args.updatedSince !== undefined && upperBound !== undefined) {
              return q
                .eq("workspaceId", args.workspaceId)
                .gt("updatedAt", args.updatedSince)
                .lte("updatedAt", upperBound);
            }
            if (args.updatedSince !== undefined) {
              return q.eq("workspaceId", args.workspaceId).gt("updatedAt", args.updatedSince);
            }
            if (upperBound !== undefined) {
              return q.eq("workspaceId", args.workspaceId).lte("updatedAt", upperBound);
            }
            return q.eq("workspaceId", args.workspaceId);
          });

        if (args.status) {
          query = query.filter((q2) => q2.eq(q2.field("status"), args.status!));
        }
        if (args.priority) {
          query = query.filter((q2) => q2.eq(q2.field("priority"), args.priority!));
        }
        if (args.assigneeId) {
          query = query.filter((q2) => q2.eq(q2.field("assigneeId"), args.assigneeId!));
        }

        return query.order("desc").take(take);
      },
    });

    const hasMore = tickets.length > limit;
    const data = hasMore ? tickets.slice(0, limit) : tickets;

    return {
      data: data.map((t) => ({
        id: t._id,
        workspaceId: t.workspaceId,
        conversationId: t.conversationId,
        visitorId: t.visitorId,
        subject: t.subject,
        description: t.description,
        status: t.status,
        priority: t.priority,
        assigneeId: t.assigneeId,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        resolvedAt: t.resolvedAt,
      })),
      nextCursor:
        hasMore && data.length > 0
          ? encodeCursor(data[data.length - 1].updatedAt, data[data.length - 1]._id)
          : null,
      hasMore,
    };
  },
});

export const getTicketForAutomation = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    ticketId: v.id("tickets"),
  },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.workspaceId !== args.workspaceId) {
      return null;
    }

    return {
      id: ticket._id,
      workspaceId: ticket.workspaceId,
      conversationId: ticket.conversationId,
      visitorId: ticket.visitorId,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      assigneeId: ticket.assigneeId,
      formData: ticket.formData,
      resolutionSummary: ticket.resolutionSummary,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      resolvedAt: ticket.resolvedAt,
    };
  },
});

export const createTicketForAutomation = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    credentialId: v.optional(v.id("automationCredentials")),
    subject: v.string(),
    description: v.optional(v.string()),
    priority: v.optional(v.string()),
    visitorId: v.optional(v.id("visitors")),
    conversationId: v.optional(v.id("conversations")),
    assigneeId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("tickets", {
      workspaceId: args.workspaceId,
      subject: args.subject,
      description: args.description,
      status: "submitted",
      priority: (args.priority as "low" | "normal" | "high" | "urgent") ?? "normal",
      visitorId: args.visitorId,
      conversationId: args.conversationId,
      assigneeId: args.assigneeId,
      createdAt: now,
      updatedAt: now,
    });

    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorType: "api",
      action: "automation.ticket.created",
      resourceType: "ticket",
      resourceId: String(id),
      metadata: { credentialId: args.credentialId ? String(args.credentialId) : null },
    });

    return { id };
  },
});

export const updateTicketForAutomation = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    credentialId: v.optional(v.id("automationCredentials")),
    ticketId: v.id("tickets"),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    assigneeId: v.optional(v.id("users")),
    resolutionSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.workspaceId !== args.workspaceId) {
      throw new Error("Ticket not found");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.status !== undefined) {
      updates.status = args.status;
      if (args.status === "resolved") {
        updates.resolvedAt = Date.now();
      }
    }
    if (args.priority !== undefined) updates.priority = args.priority;
    if (args.assigneeId !== undefined) updates.assigneeId = args.assigneeId;
    if (args.resolutionSummary !== undefined)
      updates.resolutionSummary = args.resolutionSummary;

    await ctx.db.patch(args.ticketId, updates);

    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorType: "api",
      action: "automation.ticket.updated",
      resourceType: "ticket",
      resourceId: String(args.ticketId),
      metadata: { credentialId: args.credentialId ? String(args.credentialId) : null },
    });

    return { id: args.ticketId };
  },
});
