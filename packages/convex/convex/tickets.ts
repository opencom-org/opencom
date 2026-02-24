import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { resolveVisitorFromSession } from "./widgetSessions";
import { getAuthenticatedUserFromSession } from "./auth";
import { hasPermission, requirePermission } from "./permissions";
import { formDataValidator } from "./validators";
import { authMutation, authQuery } from "./lib/authWrappers";

const ticketStatusValidator = v.union(
  v.literal("submitted"),
  v.literal("in_progress"),
  v.literal("waiting_on_customer"),
  v.literal("resolved")
);

const ticketPriorityValidator = v.union(
  v.literal("low"),
  v.literal("normal"),
  v.literal("high"),
  v.literal("urgent")
);

type TicketAccessArgs = {
  visitorId?: Id<"visitors">;
  sessionToken?: string;
};

type TicketAccessResult =
  | { accessType: "agent"; userId: Id<"users"> }
  | { accessType: "visitor"; visitorId: Id<"visitors"> };

type WorkspaceTicketAccessArgs = {
  workspaceId: Id<"workspaces">;
  visitorId?: Id<"visitors">;
  sessionToken?: string;
  permission: "conversations.read" | "conversations.reply";
};

type WorkspaceTicketAccessResult =
  | { accessType: "agent"; userId: Id<"users">; visitorId?: Id<"visitors"> }
  | { accessType: "visitor"; visitorId: Id<"visitors"> };

async function requireWorkspaceTicketAccess(
  ctx: QueryCtx | MutationCtx,
  args: WorkspaceTicketAccessArgs
): Promise<WorkspaceTicketAccessResult> {
  const authUser = await getAuthenticatedUserFromSession(ctx);
  if (authUser) {
    await requirePermission(ctx, authUser._id, args.workspaceId, args.permission);
    return {
      accessType: "agent",
      userId: authUser._id,
      visitorId: args.visitorId,
    };
  }

  const resolved = await resolveVisitorFromSession(ctx, {
    sessionToken: args.sessionToken,
    workspaceId: args.workspaceId,
  });
  if (args.visitorId && args.visitorId !== resolved.visitorId) {
    throw new Error("Not authorized to access this ticket");
  }

  return { accessType: "visitor", visitorId: resolved.visitorId };
}

async function getTicketDirectoryAccessStatus(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">
): Promise<{ status: "ok"; userId: Id<"users"> } | { status: "unauthenticated" | "forbidden" }> {
  const user = await getAuthenticatedUserFromSession(ctx);
  if (!user) {
    return { status: "unauthenticated" };
  }

  const canRead = await hasPermission(ctx, user._id, workspaceId, "conversations.read");
  if (!canRead) {
    return { status: "forbidden" };
  }

  return { status: "ok", userId: user._id };
}

async function listTicketsWithEnrichment(
  ctx: QueryCtx,
  args: {
    workspaceId: Id<"workspaces">;
    status?: "submitted" | "in_progress" | "waiting_on_customer" | "resolved";
    assigneeId?: Id<"users">;
  }
) {
  let tickets;

  if (args.status) {
    tickets = await ctx.db
      .query("tickets")
      .withIndex("by_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", args.status!)
      )
      .order("desc")
      .collect();
  } else if (args.assigneeId) {
    tickets = await ctx.db
      .query("tickets")
      .withIndex("by_assignee", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("assigneeId", args.assigneeId!)
      )
      .order("desc")
      .collect();
  } else {
    tickets = await ctx.db
      .query("tickets")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .collect();
  }

  const visitorIds: Id<"visitors">[] = Array.from(
    new Set(
      tickets
        .map((ticket) => ticket.visitorId)
        .filter((id): id is Id<"visitors"> => typeof id === "string")
    )
  );
  const assigneeIds: Id<"users">[] = Array.from(
    new Set(
      tickets
        .map((ticket) => ticket.assigneeId)
        .filter((id): id is Id<"users"> => typeof id === "string")
    )
  );

  const [visitorEntries, assigneeEntries] = await Promise.all([
    Promise.all(
      visitorIds.map(async (id) => {
        const visitor = (await ctx.db.get(id)) as Doc<"visitors"> | null;
        return [id, visitor] as const;
      })
    ),
    Promise.all(
      assigneeIds.map(async (id) => {
        const assignee = (await ctx.db.get(id)) as Doc<"users"> | null;
        return [id, assignee] as const;
      })
    ),
  ]);

  const visitorsById = new Map(visitorEntries);
  const assigneesById = new Map(assigneeEntries);

  return tickets.map((ticket) => ({
    ...ticket,
    visitor: ticket.visitorId ? (visitorsById.get(ticket.visitorId) ?? null) : null,
    assignee: ticket.assigneeId ? (assigneesById.get(ticket.assigneeId) ?? null) : null,
  }));
}

async function requireTicketReadAccess(
  ctx: QueryCtx | MutationCtx,
  ticket: Doc<"tickets">,
  args: TicketAccessArgs
): Promise<TicketAccessResult> {
  const authUser = await getAuthenticatedUserFromSession(ctx);
  if (authUser) {
    await requirePermission(ctx, authUser._id, ticket.workspaceId, "conversations.read");
    return { accessType: "agent", userId: authUser._id };
  }

  const resolved = await resolveVisitorFromSession(ctx, {
    sessionToken: args.sessionToken,
    workspaceId: ticket.workspaceId,
  });
  if (args.visitorId && args.visitorId !== resolved.visitorId) {
    throw new Error("Not authorized to access this ticket");
  }
  if (!ticket.visitorId || ticket.visitorId !== resolved.visitorId) {
    throw new Error("Not authorized to access this ticket");
  }

  return { accessType: "visitor", visitorId: resolved.visitorId };
}

export const create = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    subject: v.string(),
    description: v.optional(v.string()),
    priority: v.optional(ticketPriorityValidator),
    formId: v.optional(v.id("ticketForms")),
    formData: v.optional(formDataValidator),
  },
  handler: async (ctx, args) => {
    const access = await requireWorkspaceTicketAccess(ctx, {
      workspaceId: args.workspaceId,
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
      permission: "conversations.reply",
    });
    const resolvedVisitorId = access.visitorId;

    if (resolvedVisitorId) {
      const visitor = (await ctx.db.get(resolvedVisitorId)) as Doc<"visitors"> | null;
      if (!visitor || visitor.workspaceId !== args.workspaceId) {
        throw new Error("Visitor not found in workspace");
      }
    }

    const now = Date.now();

    const ticketId = await ctx.db.insert("tickets", {
      workspaceId: args.workspaceId,
      visitorId: resolvedVisitorId,
      subject: args.subject,
      description: args.description,
      status: "submitted",
      priority: args.priority || "normal",
      formId: args.formId,
      formData: args.formData,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.notifications.notifyTicketCreated, {
      ticketId,
    });

    return ticketId;
  },
});

export const update = authMutation({
  args: {
    id: v.id("tickets"),
    status: v.optional(ticketStatusValidator),
    priority: v.optional(ticketPriorityValidator),
    assigneeId: v.optional(v.id("users")),
    teamId: v.optional(v.string()),
  },
  permission: "conversations.reply",
  resolveWorkspaceId: async (ctx, args) => {
    const ticket = await ctx.db.get(args.id);
    return ticket?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const ticket = (await ctx.db.get(args.id)) as Doc<"tickets"> | null;
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    const now = Date.now();
    const updates: Record<string, unknown> = {
      updatedAt: now,
    };

    if (args.status !== undefined) {
      updates.status = args.status;
      if (args.status === "resolved") {
        updates.resolvedAt = now;
      }
    }
    if (args.priority !== undefined) {
      updates.priority = args.priority;
    }
    if (args.assigneeId !== undefined) {
      updates.assigneeId = args.assigneeId;
    }
    if (args.teamId !== undefined) {
      updates.teamId = args.teamId;
    }

    await ctx.db.patch(args.id, updates);

    if (args.status !== undefined && args.status !== ticket.status) {
      await ctx.scheduler.runAfter(0, internal.notifications.notifyTicketStatusChanged, {
        ticketId: args.id,
        oldStatus: ticket.status,
        newStatus: args.status,
        actorUserId: ctx.user._id,
        changedAt: now,
      });
    }

    if (args.assigneeId !== undefined && args.assigneeId !== ticket.assigneeId) {
      await ctx.scheduler.runAfter(0, internal.notifications.notifyTicketAssigned, {
        ticketId: args.id,
        assigneeId: args.assigneeId,
        actorUserId: ctx.user._id,
      });
    }

    return args.id;
  },
});

export const list = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(ticketStatusValidator),
    assigneeId: v.optional(v.id("users")),
  },
  permission: "conversations.read",
  handler: async (ctx, args) => {
    return listTicketsWithEnrichment(ctx, args);
  },
});

export const listForAdminView = query({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(ticketStatusValidator),
    assigneeId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const access = await getTicketDirectoryAccessStatus(ctx, args.workspaceId);
    if (access.status !== "ok") {
      return {
        status: access.status,
        tickets: [],
      };
    }

    const tickets = await listTicketsWithEnrichment(ctx, args);
    return {
      status: "ok" as const,
      tickets,
    };
  },
});

export const get = query({
  args: {
    id: v.id("tickets"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ticket = (await ctx.db.get(args.id)) as Doc<"tickets"> | null;
    if (!ticket) return null;

    await requireTicketReadAccess(ctx, ticket, {
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
    });

    let visitor: Doc<"visitors"> | null = null;
    if (ticket.visitorId) {
      visitor = (await ctx.db.get(ticket.visitorId)) as Doc<"visitors"> | null;
    }

    let assignee: Doc<"users"> | null = null;
    if (ticket.assigneeId) {
      assignee = (await ctx.db.get(ticket.assigneeId)) as Doc<"users"> | null;
    }

    let conversation: Doc<"conversations"> | null = null;
    if (ticket.conversationId) {
      conversation = (await ctx.db.get(ticket.conversationId)) as Doc<"conversations"> | null;
    }

    const comments = await ctx.db
      .query("ticketComments")
      .withIndex("by_ticket", (q) => q.eq("ticketId", args.id))
      .order("asc")
      .collect();

    return {
      ...ticket,
      visitor,
      assignee,
      conversation,
      comments,
    };
  },
});

export const getForAdminView = query({
  args: {
    id: v.id("tickets"),
  },
  handler: async (ctx, args) => {
    const ticket = (await ctx.db.get(args.id)) as Doc<"tickets"> | null;
    if (!ticket) {
      return {
        status: "not_found" as const,
        ticket: null,
      };
    }

    const access = await getTicketDirectoryAccessStatus(ctx, ticket.workspaceId);
    if (access.status !== "ok") {
      return {
        status: access.status,
        ticket: null,
      };
    }

    let visitor: Doc<"visitors"> | null = null;
    if (ticket.visitorId) {
      visitor = (await ctx.db.get(ticket.visitorId)) as Doc<"visitors"> | null;
    }

    let assignee: Doc<"users"> | null = null;
    if (ticket.assigneeId) {
      assignee = (await ctx.db.get(ticket.assigneeId)) as Doc<"users"> | null;
    }

    let conversation: Doc<"conversations"> | null = null;
    if (ticket.conversationId) {
      conversation = (await ctx.db.get(ticket.conversationId)) as Doc<"conversations"> | null;
    }

    const comments = (await ctx.db
      .query("ticketComments")
      .withIndex("by_ticket", (q) => q.eq("ticketId", args.id))
      .order("asc")
      .collect()) as Doc<"ticketComments">[];

    return {
      status: "ok" as const,
      ticket: {
        ...ticket,
        visitor,
        assignee,
        conversation,
        comments,
      },
    };
  },
});

export const convertFromConversation = authMutation({
  args: {
    conversationId: v.id("conversations"),
    subject: v.optional(v.string()),
    priority: v.optional(ticketPriorityValidator),
  },
  permission: "conversations.reply",
  resolveWorkspaceId: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    return conversation?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const conversation = (await ctx.db.get(args.conversationId)) as Doc<"conversations"> | null;
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const existingTicket = await ctx.db
      .query("tickets")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .first();

    if (existingTicket) {
      throw new Error("A ticket already exists for this conversation");
    }

    const now = Date.now();
    const subject = args.subject || conversation.subject || "Ticket from conversation";

    const ticketId = await ctx.db.insert("tickets", {
      workspaceId: conversation.workspaceId,
      conversationId: args.conversationId,
      visitorId: conversation.visitorId,
      subject,
      status: "submitted",
      priority: args.priority || "normal",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.notifications.notifyTicketCreated, {
      ticketId,
    });

    return ticketId;
  },
});

export const addComment = mutation({
  args: {
    ticketId: v.id("tickets"),
    visitorId: v.optional(v.id("visitors")),
    content: v.string(),
    isInternal: v.optional(v.boolean()),
    authorId: v.optional(v.string()),
    authorType: v.optional(v.union(v.literal("agent"), v.literal("visitor"), v.literal("system"))),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ticket = (await ctx.db.get(args.ticketId)) as Doc<"tickets"> | null;
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    const access = await requireWorkspaceTicketAccess(ctx, {
      workspaceId: ticket.workspaceId,
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
      permission: "conversations.reply",
    });
    let authorId: string;
    let authorType: "agent" | "visitor";
    let isInternal: boolean;

    if (access.accessType === "agent") {
      authorId = access.userId;
      authorType = "agent";
      isInternal = args.isInternal ?? false;
    } else {
      if (!ticket.visitorId || ticket.visitorId !== access.visitorId) {
        throw new Error("Not authorized to comment on this ticket");
      }
      authorId = access.visitorId;
      authorType = "visitor";
      isInternal = false;
    }

    const now = Date.now();

    const commentId = await ctx.db.insert("ticketComments", {
      ticketId: args.ticketId,
      authorId,
      authorType,
      content: args.content,
      isInternal,
      createdAt: now,
    });

    await ctx.db.patch(args.ticketId, { updatedAt: now });

    if (!isInternal && authorType === "agent") {
      await ctx.scheduler.runAfter(0, internal.notifications.notifyTicketComment, {
        ticketId: args.ticketId,
        commentId,
        actorUserId: authorId as Id<"users">,
      });
    }

    if (authorType === "visitor" && ticket.assigneeId) {
      await ctx.scheduler.runAfter(0, internal.notifications.notifyTicketCustomerReply, {
        ticketId: args.ticketId,
        assigneeId: ticket.assigneeId,
        commentId,
      });
    }

    return commentId;
  },
});

export const resolve = authMutation({
  args: {
    id: v.id("tickets"),
    resolutionSummary: v.optional(v.string()),
  },
  permission: "conversations.reply",
  resolveWorkspaceId: async (ctx, args) => {
    const ticket = await ctx.db.get(args.id);
    return ticket?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const ticket = (await ctx.db.get(args.id)) as Doc<"tickets"> | null;
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      status: "resolved",
      resolutionSummary: args.resolutionSummary,
      resolvedAt: now,
      updatedAt: now,
    });

    if (args.resolutionSummary) {
      await ctx.db.insert("ticketComments", {
        ticketId: args.id,
        authorId: "system",
        authorType: "system",
        content: `Ticket resolved: ${args.resolutionSummary}`,
        isInternal: false,
        createdAt: now,
      });
    }

    await ctx.scheduler.runAfter(0, internal.notifications.notifyTicketResolved, {
      ticketId: args.id,
      resolutionSummary: args.resolutionSummary,
      actorUserId: ctx.user._id,
    });

    return args.id;
  },
});

export const listByVisitor = query({
  args: {
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const access = await requireWorkspaceTicketAccess(ctx, {
      workspaceId: args.workspaceId,
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
      permission: "conversations.read",
    });
    const resolvedVisitorId = access.visitorId;

    if (!resolvedVisitorId) {
      return [];
    }

    const visitor = (await ctx.db.get(resolvedVisitorId)) as Doc<"visitors"> | null;
    if (!visitor || visitor.workspaceId !== args.workspaceId) {
      throw new Error("Visitor not found in workspace");
    }

    const tickets = (await ctx.db
      .query("tickets")
      .withIndex("by_visitor", (q) => q.eq("visitorId", resolvedVisitorId!))
      .order("desc")
      .collect()) as Doc<"tickets">[];

    return tickets;
  },
});

export const getComments = query({
  args: {
    ticketId: v.id("tickets"),
    includeInternal: v.optional(v.boolean()),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ticket = (await ctx.db.get(args.ticketId)) as Doc<"tickets"> | null;
    if (!ticket) {
      throw new Error("Ticket not found");
    }
    const access = await requireTicketReadAccess(ctx, ticket, {
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
    });

    const comments = (await ctx.db
      .query("ticketComments")
      .withIndex("by_ticket", (q) => q.eq("ticketId", args.ticketId))
      .order("asc")
      .collect()) as Doc<"ticketComments">[];

    if (args.includeInternal && access.accessType === "agent") {
      return comments;
    }

    return comments.filter((c) => !c.isInternal);
  },
});
