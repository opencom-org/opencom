import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { encodeCursor, decodeCursor } from "./lib/apiHelpers";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const deliverWebhookRef = makeFunctionReference<"action">(
  "automationWebhookWorker:deliverWebhook"
);

const emitEventRef = makeFunctionReference<"mutation">(
  "automationEvents:emitEvent"
);

/** Schedule an automation event from a domain mutation. No-ops if automation is disabled. */
export async function emitAutomationEvent(
  ctx: Pick<MutationCtx, "scheduler">,
  params: {
    workspaceId: Id<"workspaces">;
    eventType: string;
    resourceType: string;
    resourceId: string;
    data: Record<string, unknown>;
  }
) {
  await ctx.scheduler.runAfter(0, emitEventRef as any, params);
}

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
    // Check if automation API is enabled for this workspace
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace || !workspace.automationApiEnabled) {
      return { eventId: null };
    }

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

    const loadRawEvents = (take: number) =>
      ctx.db
        .query("automationEvents")
        .withIndex("by_workspace_timestamp", (q2) =>
          cursorTs !== undefined
            ? q2.eq("workspaceId", args.workspaceId).lte("timestamp", cursorTs)
            : q2.eq("workspaceId", args.workspaceId)
        )
        .order("desc")
        .take(take);

    // Keep expanding the fetch window until cursor filtering leaves enough rows
    // to answer this page or the index is exhausted.
    let fetchSize = cursorId ? Math.max(limit * 3, 200) : limit + 1;
    let rawEvents = await loadRawEvents(fetchSize);
    let events = cursorId
      ? rawEvents.filter((e) => !(e.timestamp === cursorTs && e._id >= cursorId!))
      : rawEvents;

    while (cursorId && events.length <= limit && rawEvents.length === fetchSize) {
      fetchSize *= 2;
      rawEvents = await loadRawEvents(fetchSize);
      events = rawEvents.filter(
        (e) => !(e.timestamp === cursorTs && e._id >= cursorId!)
      );
    }

    const hasMore = events.length > limit;
    const data = hasMore ? events.slice(0, limit) : events;

    const lastItem = data[data.length - 1];
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
        hasMore && lastItem
          ? encodeCursor(lastItem.timestamp, lastItem._id)
          : null,
      hasMore,
    };
  },
});
