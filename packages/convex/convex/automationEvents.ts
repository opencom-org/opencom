import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

const deliverWebhookRef = makeFunctionReference<"action">(
  "automationWebhookWorker:deliverWebhook"
);

// Emit an automation event and trigger matching webhook deliveries.
export const emitEvent = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    eventType: v.string(),
    resourceType: v.string(),
    resourceId: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const eventId = await ctx.db.insert("automationEvents", {
      workspaceId: args.workspaceId,
      eventType: args.eventType,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      data: args.data,
      timestamp: now,
    });

    // Find matching webhook subscriptions
    const subscriptions = await ctx.db
      .query("automationWebhookSubscriptions")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "active")
      )
      .collect();

    for (const sub of subscriptions) {
      // If eventTypes is set, filter; otherwise match all
      if (sub.eventTypes && sub.eventTypes.length > 0 && !sub.eventTypes.includes(args.eventType)) {
        continue;
      }
      // Resource type filter
      if (sub.resourceTypes && sub.resourceTypes.length > 0 && !sub.resourceTypes.includes(args.resourceType)) {
        continue;
      }
      // Channel filter
      if (sub.channels && sub.channels.length > 0 && !sub.channels.includes(args.data?.channel)) {
        continue;
      }
      // AI workflow state filter
      if (sub.aiWorkflowStates && sub.aiWorkflowStates.length > 0 && !sub.aiWorkflowStates.includes(args.data?.aiWorkflowState)) {
        continue;
      }

      // Create a pending delivery and schedule it
      const deliveryId = await ctx.db.insert("automationWebhookDeliveries", {
        workspaceId: args.workspaceId,
        subscriptionId: sub._id,
        eventId,
        attemptNumber: 1,
        status: "pending",
        createdAt: now,
      });

      await ctx.scheduler.runAfter(0, deliverWebhookRef as any, {
        deliveryId,
      });
    }

    return { eventId };
  },
});

// Poll-based event feed for automation clients.
export const listEvents = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    cursor: v.optional(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit, 100);

    const eventsQuery = ctx.db
      .query("automationEvents")
      .withIndex("by_workspace_timestamp", (q2) =>
        args.cursor
          ? q2.eq("workspaceId", args.workspaceId).lt("timestamp", Number.parseFloat(args.cursor))
          : q2.eq("workspaceId", args.workspaceId)
      );
    const events = await eventsQuery.order("desc").take(limit + 1);

    const hasMore = events.length > limit;
    const data = hasMore ? events.slice(0, limit) : events;

    return {
      data: data.map((e) => ({
        id: e._id,
        eventType: e.eventType,
        resourceType: e.resourceType,
        resourceId: e.resourceId,
        data: e.data,
        timestamp: e.timestamp,
      })),
      nextCursor:
        hasMore && data.length > 0
          ? String(data[data.length - 1].timestamp)
          : null,
      hasMore,
    };
  },
});
