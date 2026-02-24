import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { getAuthenticatedUserFromSession } from "./auth";
import { requirePermission, hasPermission } from "./permissions";
import { resolveVisitorFromSession } from "./widgetSessions";

// Helper function to create a new conversation (shared by getOrCreateForVisitor and createForVisitor)
async function createConversationInternal(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  visitorId: Id<"visitors">
) {
  const now = Date.now();
  const id = await ctx.db.insert("conversations", {
    workspaceId,
    visitorId,
    status: "open",
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
    aiWorkflowState: "none",
  });

  await ctx.db.insert("messages", {
    conversationId: id,
    senderId: "system",
    senderType: "bot",
    content: "Hi! How can we help you today?",
    createdAt: now,
  });

  await ctx.scheduler.runAfter(0, internal.notifications.notifyNewConversation, {
    conversationId: id,
  });

  return await ctx.db.get(id);
}

export const list = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(v.union(v.literal("open"), v.literal("closed"), v.literal("snoozed"))),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return [];
    }

    const canRead = await hasPermission(ctx, user._id, args.workspaceId, "conversations.read");
    if (!canRead) {
      return [];
    }

    if (args.status) {
      return await ctx.db
        .query("conversations")
        .withIndex("by_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", args.status!)
        )
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("conversations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: {
    id: v.id("conversations"),
    visitorId: v.optional(v.id("visitors")),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.id);
    if (!conversation) return null;

    // Visitor path: allow if visitor owns the conversation
    if (args.visitorId && conversation.visitorId === args.visitorId) {
      const visitor = await ctx.db.get(args.visitorId);
      if (visitor) return conversation;
    }

    // Agent path: require auth + permission
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) return null;

    const canRead = await hasPermission(
      ctx,
      user._id,
      conversation.workspaceId,
      "conversations.read"
    );
    if (!canRead) return null;

    return conversation;
  },
});

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, user._id, args.workspaceId, "conversations.reply");

    const now = Date.now();

    return await ctx.db.insert("conversations", {
      workspaceId: args.workspaceId,
      visitorId: args.visitorId,
      userId: args.userId,
      status: "open",
      createdAt: now,
      updatedAt: now,
      aiWorkflowState: "none",
    });
  },
});

export const getOrCreateForVisitor = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const resolved = await resolveVisitorFromSession(ctx, {
      sessionToken: args.sessionToken,
      workspaceId: args.workspaceId,
    });
    const resolvedVisitorId = resolved.visitorId;

    // Validate that the visitor belongs to the specified workspace
    const visitor = await ctx.db.get(resolvedVisitorId);
    if (!visitor || visitor.workspaceId !== args.workspaceId) {
      throw new Error("Not authorized: visitor does not belong to this workspace");
    }

    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_visitor", (q) => q.eq("visitorId", resolvedVisitorId!))
      .filter((q) => q.eq(q.field("status"), "open"))
      .first();

    if (existing) {
      return existing;
    }

    return await createConversationInternal(ctx, args.workspaceId, resolvedVisitorId);
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("conversations"),
    status: v.union(v.literal("open"), v.literal("closed"), v.literal("snoozed")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const conversation = await ctx.db.get(args.id);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    await requirePermission(ctx, user._id, conversation.workspaceId, "conversations.close");

    const now = Date.now();
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };

    if (args.status === "closed") {
      patch.resolvedAt = now;
    } else if (args.status === "open") {
      patch.resolvedAt = undefined;
    }

    await ctx.db.patch(args.id, patch);
  },
});

export const assign = mutation({
  args: {
    id: v.id("conversations"),
    agentId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const conversation = await ctx.db.get(args.id);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    await requirePermission(ctx, user._id, conversation.workspaceId, "conversations.assign");

    await ctx.db.patch(args.id, {
      assignedAgentId: args.agentId,
      updatedAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.notifications.notifyAssignment, {
      conversationId: args.id,
      assignedAgentId: args.agentId,
      actorUserId: user._id,
    });
  },
});

export const markAsRead = mutation({
  args: {
    id: v.id("conversations"),
    readerType: v.union(v.literal("visitor"), v.literal("agent")),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.id);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (args.readerType === "visitor") {
      // Visitor path: resolve via session token
      if (!args.sessionToken || !conversation.workspaceId) {
        throw new Error("Session token required");
      }
      const resolved = await resolveVisitorFromSession(ctx, {
        sessionToken: args.sessionToken,
        workspaceId: conversation.workspaceId,
      });
      if (conversation.visitorId !== resolved.visitorId) {
        throw new Error("Not authorized");
      }
      await ctx.db.patch(args.id, { unreadByVisitor: 0 });
    } else {
      // Agent path: require auth
      const user = await getAuthenticatedUserFromSession(ctx);
      if (!user) {
        throw new Error("Not authenticated");
      }
      await requirePermission(ctx, user._id, conversation.workspaceId, "conversations.read");
      await ctx.db.patch(args.id, { unreadByAgent: 0 });
    }
  },
});

export const getTotalUnreadForVisitor = query({
  args: {
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    if (!args.sessionToken || !args.workspaceId) {
      return 0;
    }

    const resolved = await resolveVisitorFromSession(ctx, {
      sessionToken: args.sessionToken,
      workspaceId: args.workspaceId,
    });
    const resolvedVisitorId = resolved.visitorId;

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_visitor", (q) => q.eq("visitorId", resolvedVisitorId!))
      .collect();

    return conversations.reduce((total, conv) => total + (conv.unreadByVisitor || 0), 0);
  },
});

export const listByVisitor = query({
  args: {
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    if (!args.sessionToken || !args.workspaceId) {
      return [];
    }

    const resolved = await resolveVisitorFromSession(ctx, {
      sessionToken: args.sessionToken,
      workspaceId: args.workspaceId,
    });
    const resolvedVisitorId = resolved.visitorId;

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_visitor", (q) => q.eq("visitorId", resolvedVisitorId!))
      .order("desc")
      .collect();

    if (conversations.length === 0) {
      return [];
    }

    // Batch fetch last messages for all conversations
    const lastMessagePromises = conversations.map((conv) =>
      ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
        .order("desc")
        .first()
    );
    const lastMessages = await Promise.all(lastMessagePromises);

    // Create a map for quick lookup
    const lastMessageMap = new Map(
      conversations.map((conv, i) => [conv._id.toString(), lastMessages[i]])
    );

    const enriched = conversations.map((conv) => ({
      ...conv,
      lastMessage: lastMessageMap.get(conv._id.toString()) ?? null,
    }));

    return enriched.sort(
      (a, b) => (b.lastMessageAt || b.createdAt) - (a.lastMessageAt || a.createdAt)
    );
  },
});

export const createForVisitor = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const resolved = await resolveVisitorFromSession(ctx, {
      sessionToken: args.sessionToken,
      workspaceId: args.workspaceId,
    });
    const resolvedVisitorId = resolved.visitorId;

    // Validate that the visitor belongs to the specified workspace
    const visitor = await ctx.db.get(resolvedVisitorId);
    if (!visitor || visitor.workspaceId !== args.workspaceId) {
      throw new Error("Not authorized: visitor does not belong to this workspace");
    }

    return await createConversationInternal(ctx, args.workspaceId, resolvedVisitorId);
  },
});

const DEFAULT_INBOX_LIMIT = 50;
const MAX_INBOX_LIMIT = 100;
const MAX_INBOX_SCAN_LIMIT = 5000;
type InboxAIWorkflowState = "none" | "ai_handled" | "handoff";

type InboxSortableConversation = {
  _id: Id<"conversations">;
  workspaceId: Id<"workspaces">;
  createdAt: number;
  lastMessageAt?: number;
  visitorId?: Id<"visitors">;
  aiWorkflowState?: InboxAIWorkflowState;
  aiHandoffReason?: string;
  aiLastConfidence?: number;
  aiLastResponseAt?: number;
};

type InboxAIWorkflowShape = {
  aiWorkflowState?: InboxAIWorkflowState;
  aiHandoffReason?: string;
  aiLastConfidence?: number;
  aiLastResponseAt?: number;
};

function getInboxSortTimestamp(conversation: InboxSortableConversation): number {
  return conversation.lastMessageAt ?? conversation.createdAt;
}

function compareInboxConversations(
  left: InboxSortableConversation,
  right: InboxSortableConversation
): number {
  const leftTs = getInboxSortTimestamp(left);
  const rightTs = getInboxSortTimestamp(right);
  if (rightTs !== leftTs) {
    return rightTs - leftTs;
  }
  return right._id.toString().localeCompare(left._id.toString());
}

export function paginateInboxConversations<T extends InboxSortableConversation>(
  conversations: T[],
  limit: number,
  cursor?: string
): {
  page: T[];
  nextCursor: string | null;
  sortedIds: string[];
} {
  const sorted = [...conversations].sort(compareInboxConversations);
  const startIndex = cursor
    ? Math.max(sorted.findIndex((conversation) => conversation._id.toString() === cursor) + 1, 0)
    : 0;
  const page = sorted.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < sorted.length;
  return {
    page,
    nextCursor: hasMore ? (page[page.length - 1]?._id.toString() ?? null) : null,
    sortedIds: sorted.map((conversation) => conversation._id.toString()),
  };
}

export function normalizeInboxAIWorkflowState(conversation: InboxAIWorkflowShape): {
  state: InboxAIWorkflowState;
  handoffReason: string | null;
  confidence: number | null;
  lastResponseAt: number | null;
} {
  return {
    state: conversation.aiWorkflowState ?? "none",
    handoffReason: conversation.aiHandoffReason ?? null,
    confidence: conversation.aiLastConfidence ?? null,
    lastResponseAt: conversation.aiLastResponseAt ?? null,
  };
}

export const listForInbox = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(v.union(v.literal("open"), v.literal("closed"), v.literal("snoozed"))),
    aiWorkflowState: v.optional(v.union(v.literal("ai_handled"), v.literal("handoff"))),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return { conversations: [], nextCursor: null };
    }

    const canRead = await hasPermission(ctx, user._id, args.workspaceId, "conversations.read");
    if (!canRead) {
      return { conversations: [], nextCursor: null };
    }

    const limit = Math.min(Math.max(args.limit ?? DEFAULT_INBOX_LIMIT, 1), MAX_INBOX_LIMIT);
    const scanLimit = Math.min(Math.max(limit * 20, 500), MAX_INBOX_SCAN_LIMIT);

    let query;
    if (args.aiWorkflowState && args.status) {
      query = ctx.db
        .query("conversations")
        .withIndex("by_workspace_ai_state_status", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("aiWorkflowState", args.aiWorkflowState!)
            .eq("status", args.status!)
        )
        .order("desc");
    } else if (args.aiWorkflowState) {
      query = ctx.db
        .query("conversations")
        .withIndex("by_workspace_ai_state", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("aiWorkflowState", args.aiWorkflowState!)
        )
        .order("desc");
    } else if (args.status) {
      query = ctx.db
        .query("conversations")
        .withIndex("by_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", args.status!)
        )
        .order("desc");
    } else {
      query = ctx.db
        .query("conversations")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .order("desc");
    }

    const fetchedConversations = await query.take(scanLimit);
    const scopedConversations = fetchedConversations.filter((conversation) => {
      if (conversation.workspaceId !== args.workspaceId) {
        return false;
      }
      if (args.status && conversation.status !== args.status) {
        return false;
      }
      if (args.aiWorkflowState && conversation.aiWorkflowState !== args.aiWorkflowState) {
        return false;
      }
      return true;
    });
    const { page: conversations, nextCursor } = paginateInboxConversations(
      scopedConversations,
      limit,
      args.cursor
    );

    if (conversations.length === 0) {
      return { conversations: [], nextCursor: null };
    }

    // Batch fetch visitors
    const visitorIds = [
      ...new Set(conversations.filter((c) => c.visitorId).map((c) => c.visitorId!)),
    ] as Id<"visitors">[];
    const visitorPromises = visitorIds.map((id) => ctx.db.get(id));
    const visitors = await Promise.all(visitorPromises);
    const visitorMap = new Map(visitorIds.map((id, i) => [id.toString(), visitors[i]]));

    // Batch fetch last messages
    const lastMessagePromises = conversations.map((conv) =>
      ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
        .order("desc")
        .first()
    );
    const lastMessages = await Promise.all(lastMessagePromises);
    const lastMessageMap = new Map(
      conversations.map((conv, i) => [conv._id.toString(), lastMessages[i]])
    );

    const enriched = conversations.map((conv) => ({
      ...conv,
      visitor: conv.visitorId ? (visitorMap.get(conv.visitorId.toString()) ?? null) : null,
      lastMessage: lastMessageMap.get(conv._id.toString()) ?? null,
      aiWorkflow: normalizeInboxAIWorkflowState(conv),
    }));

    return { conversations: enriched, nextCursor };
  },
});
