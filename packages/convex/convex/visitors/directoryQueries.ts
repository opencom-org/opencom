import { v } from "convex/values";
import { query } from "../_generated/server";
import { hasPermission } from "../permissions";
import {
  DIRECTORY_DEFAULT_LIMIT,
  DIRECTORY_MAX_LIMIT,
  DIRECTORY_MAX_SCAN_LIMIT,
  MERGE_HISTORY_DEFAULT_LIMIT,
  MERGE_HISTORY_MAX_LIMIT,
  MERGE_HISTORY_MAX_SCAN,
  MERGE_HISTORY_MIN_SCAN,
  MERGE_HISTORY_SCAN_FACTOR,
  type VisitorMergeHistoryEntry,
  formatReadableVisitorId,
  getDirectoryAccessStatus,
  isVisitorOnline,
  toVisitorMergeHistoryEntry,
} from "./helpers";

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
