import { v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";
import { truncatePreview } from "../helpers";

export const notifyTicketCreated = internalMutation({
  args: {
    ticketId: v.id("tickets"),
  },
  handler: async (ctx, args) => {
    const ticket = (await ctx.db.get(args.ticketId)) as Doc<"tickets"> | null;
    if (!ticket) return;

    let visitorInfo = "A customer";
    if (ticket.visitorId) {
      const visitor = (await ctx.db.get(ticket.visitorId)) as Doc<"visitors"> | null;
      if (visitor?.name) {
        visitorInfo = visitor.name;
      } else if (visitor?.email) {
        visitorInfo = visitor.email;
      }
    }

    await ctx.scheduler.runAfter(0, internal.notifications.routeEvent, {
      eventType: "ticket_created",
      domain: "ticket",
      audience: "agent",
      workspaceId: ticket.workspaceId,
      actorType: ticket.visitorId ? "visitor" : "system",
      actorVisitorId: ticket.visitorId ?? undefined,
      ticketId: args.ticketId,
      title: "New ticket created",
      body: `${visitorInfo} submitted: ${ticket.subject}`,
      data: {
        ticketId: args.ticketId,
        type: "ticket_created",
      },
      eventKey: `ticket_created:${args.ticketId}`,
    });
  },
});

export const notifyTicketStatusChanged = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    oldStatus: v.string(),
    newStatus: v.string(),
    actorUserId: v.optional(v.id("users")),
    changedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const ticket = (await ctx.db.get(args.ticketId)) as Doc<"tickets"> | null;
    if (!ticket || !ticket.visitorId) return;

    await ctx.scheduler.runAfter(0, internal.notifications.routeEvent, {
      eventType: "ticket_status_changed",
      domain: "ticket",
      audience: "visitor",
      workspaceId: ticket.workspaceId,
      actorType: args.actorUserId ? "agent" : "system",
      actorUserId: args.actorUserId,
      ticketId: args.ticketId,
      title: "Ticket update",
      body: `Your ticket \"${ticket.subject}\" moved to ${args.newStatus.replaceAll("_", " ")}.`,
      data: {
        ticketId: args.ticketId,
        type: "ticket_status_changed",
        oldStatus: args.oldStatus,
        newStatus: args.newStatus,
      },
      recipientVisitorIds: [ticket.visitorId],
      eventKey: `ticket_status_changed:${args.ticketId}:${args.newStatus}:${args.changedAt ?? Date.now()}`,
    });
  },
});

export const notifyTicketAssigned = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    assigneeId: v.id("users"),
    actorUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const ticket = (await ctx.db.get(args.ticketId)) as Doc<"tickets"> | null;
    if (!ticket) return;

    let visitorInfo = "a customer";
    if (ticket.visitorId) {
      const visitor = (await ctx.db.get(ticket.visitorId)) as Doc<"visitors"> | null;
      if (visitor?.name) {
        visitorInfo = visitor.name;
      } else if (visitor?.email) {
        visitorInfo = visitor.email;
      }
    }

    await ctx.scheduler.runAfter(0, internal.notifications.routeEvent, {
      eventType: "ticket_assigned",
      domain: "ticket",
      audience: "agent",
      workspaceId: ticket.workspaceId,
      actorType: args.actorUserId ? "agent" : "system",
      actorUserId: args.actorUserId,
      ticketId: args.ticketId,
      title: "Ticket assigned",
      body: `You've been assigned a ticket from ${visitorInfo}: ${ticket.subject}`,
      data: {
        ticketId: args.ticketId,
        type: "ticket_assigned",
      },
      recipientUserIds: [args.assigneeId],
      eventKey: `ticket_assigned:${args.ticketId}:${args.assigneeId}`,
    });
  },
});

export const notifyTicketComment = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    commentId: v.id("ticketComments"),
    actorUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const ticket = (await ctx.db.get(args.ticketId)) as Doc<"tickets"> | null;
    if (!ticket || !ticket.visitorId) return;

    const comment = (await ctx.db.get(args.commentId)) as Doc<"ticketComments"> | null;
    if (!comment) return;

    await ctx.scheduler.runAfter(0, internal.notifications.routeEvent, {
      eventType: "ticket_comment",
      domain: "ticket",
      audience: "visitor",
      workspaceId: ticket.workspaceId,
      actorType: args.actorUserId ? "agent" : "system",
      actorUserId: args.actorUserId,
      ticketId: args.ticketId,
      title: "Ticket update",
      body: truncatePreview(comment.content, 120),
      data: {
        ticketId: args.ticketId,
        type: "ticket_comment",
        commentId: args.commentId,
      },
      recipientVisitorIds: [ticket.visitorId],
      eventKey: `ticket_comment:${args.commentId}`,
    });
  },
});

export const notifyTicketCustomerReply = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    assigneeId: v.id("users"),
    commentId: v.optional(v.id("ticketComments")),
  },
  handler: async (ctx, args) => {
    const ticket = (await ctx.db.get(args.ticketId)) as Doc<"tickets"> | null;
    if (!ticket) return;

    let visitorInfo = "Customer";
    if (ticket.visitorId) {
      const visitor = (await ctx.db.get(ticket.visitorId)) as Doc<"visitors"> | null;
      if (visitor?.name) {
        visitorInfo = visitor.name;
      } else if (visitor?.email) {
        visitorInfo = visitor.email;
      }
    }

    await ctx.scheduler.runAfter(0, internal.notifications.routeEvent, {
      eventType: "ticket_customer_reply",
      domain: "ticket",
      audience: "agent",
      workspaceId: ticket.workspaceId,
      actorType: "visitor",
      actorVisitorId: ticket.visitorId ?? undefined,
      ticketId: args.ticketId,
      title: "Customer replied to ticket",
      body: `${visitorInfo} replied to: ${ticket.subject}`,
      data: {
        ticketId: args.ticketId,
        type: "ticket_customer_reply",
        ...(args.commentId ? { commentId: args.commentId } : {}),
      },
      recipientUserIds: [args.assigneeId],
      eventKey: args.commentId
        ? `ticket_customer_reply:${args.commentId}`
        : `ticket_customer_reply:${args.ticketId}:${args.assigneeId}`,
    });
  },
});

export const notifyTicketResolved = internalMutation({
  args: {
    ticketId: v.id("tickets"),
    resolutionSummary: v.optional(v.string()),
    actorUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const ticket = (await ctx.db.get(args.ticketId)) as Doc<"tickets"> | null;
    if (!ticket || !ticket.visitorId) return;

    await ctx.scheduler.runAfter(0, internal.notifications.routeEvent, {
      eventType: "ticket_resolved",
      domain: "ticket",
      audience: "visitor",
      workspaceId: ticket.workspaceId,
      actorType: args.actorUserId ? "agent" : "system",
      actorUserId: args.actorUserId,
      ticketId: args.ticketId,
      title: "Ticket resolved",
      body: args.resolutionSummary
        ? truncatePreview(args.resolutionSummary, 140)
        : `Your ticket \"${ticket.subject}\" was resolved.`,
      data: {
        ticketId: args.ticketId,
        type: "ticket_resolved",
      },
      recipientVisitorIds: [ticket.visitorId],
      eventKey: `ticket_resolved:${args.ticketId}`,
    });
  },
});
