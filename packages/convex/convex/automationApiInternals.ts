import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// ── Conversations ──────────────────────────────────────────────────

export const listConversationsForAutomation = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    cursor: v.optional(v.string()),
    limit: v.number(),
    updatedSince: v.optional(v.number()),
    status: v.optional(v.string()),
    assigneeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit, 100);
    let query;

    if (args.status) {
      query = ctx.db
        .query("conversations")
        .withIndex("by_status", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq("status", args.status as "open" | "closed" | "snoozed")
        );
    } else {
      query = ctx.db
        .query("conversations")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId));
    }

    let conversations = await query.order("desc").take(limit + 1 + (args.cursor ? 1000 : 0));

    // Cursor-based pagination using _creationTime
    if (args.cursor) {
      const cursorTime = Number.parseFloat(args.cursor);
      conversations = conversations.filter((c) => c._creationTime < cursorTime);
      conversations = conversations.slice(0, limit + 1);
    }

    if (args.updatedSince) {
      conversations = conversations.filter((c) => c.updatedAt >= args.updatedSince!);
    }

    if (args.assigneeId) {
      conversations = conversations.filter(
        (c) => c.assignedAgentId === args.assigneeId
      );
    }

    const hasMore = conversations.length > limit;
    const data = hasMore ? conversations.slice(0, limit) : conversations;

    // Get active claims for these conversations
    const claimMap = new Map<string, { credentialId: string; expiresAt: number }>();
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
    }

    return {
      data: data.map((c) => ({
        id: c._id,
        workspaceId: c.workspaceId,
        visitorId: c.visitorId,
        assignedAgentId: c.assignedAgentId,
        status: c.status,
        channel: c.channel,
        subject: c.subject,
        aiWorkflowState: c.aiWorkflowState,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        lastMessageAt: c.lastMessageAt,
        claim: claimMap.get(c._id) ?? null,
      })),
      nextCursor:
        hasMore && data.length > 0
          ? String(data[data.length - 1]._creationTime)
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
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      lastMessageAt: conv.lastMessageAt,
      claim: activeClaim,
    };
  },
});

export const updateConversationForAutomation = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
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
    let messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .take(limit + 1 + (args.cursor ? 10000 : 0));

    if (args.cursor) {
      const cursorTime = Number.parseFloat(args.cursor);
      messages = messages.filter((m) => m._creationTime > cursorTime);
      messages = messages.slice(0, limit + 1);
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
          ? String(data[data.length - 1]._creationTime)
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

    return { id: messageId };
  },
});

// ── Visitors ───────────────────────────────────────────────────────

export const listVisitorsForAutomation = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    cursor: v.optional(v.string()),
    limit: v.number(),
    updatedSince: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit, 100);
    let visitors = await ctx.db
      .query("visitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(limit + 1 + (args.cursor ? 1000 : 0));

    if (args.cursor) {
      const cursorTime = Number.parseFloat(args.cursor);
      visitors = visitors.filter((v) => v._creationTime < cursorTime);
      visitors = visitors.slice(0, limit + 1);
    }

    if (args.updatedSince) {
      visitors = visitors.filter(
        (v) => (v.lastSeenAt ?? v.createdAt) >= args.updatedSince!
      );
    }

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
          ? String(data[data.length - 1]._creationTime)
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

    return { id };
  },
});

export const updateVisitorForAutomation = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
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
    return { id: args.visitorId };
  },
});

// ── Tickets ────────────────────────────────────────────────────────

export const listTicketsForAutomation = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    cursor: v.optional(v.string()),
    limit: v.number(),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit, 100);
    let query;

    if (args.status) {
      query = ctx.db
        .query("tickets")
        .withIndex("by_status", (q) =>
          q
            .eq("workspaceId", args.workspaceId)
            .eq(
              "status",
              args.status as
                | "submitted"
                | "in_progress"
                | "waiting_on_customer"
                | "resolved"
            )
        );
    } else {
      query = ctx.db
        .query("tickets")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId));
    }

    let tickets = await query.order("desc").take(limit + 1 + (args.cursor ? 1000 : 0));

    if (args.cursor) {
      const cursorTime = Number.parseFloat(args.cursor);
      tickets = tickets.filter((t) => t._creationTime < cursorTime);
      tickets = tickets.slice(0, limit + 1);
    }

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
          ? String(data[data.length - 1]._creationTime)
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

    return { id };
  },
});

export const updateTicketForAutomation = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
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
    return { id: args.ticketId };
  },
});
