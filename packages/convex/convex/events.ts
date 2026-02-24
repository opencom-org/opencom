import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { resolveVisitorFromSession } from "./widgetSessions";
import { getAuthenticatedUserFromSession } from "./auth";
import { hasPermission, requirePermission } from "./permissions";
import { eventPropertiesValidator } from "./validators";

const AUTO_EVENT_TYPES = ["page_view", "screen_view", "session_start", "session_end"] as const;
type AutoEventType = (typeof AUTO_EVENT_TYPES)[number];

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_EVENTS = 100;

async function scheduleSeriesEventRuntime(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    visitorId: Id<"visitors">;
    source: "event" | "auto_event";
    eventName: string;
  }
): Promise<void> {
  await ctx.scheduler.runAfter(0, (internal as any).series.evaluateEnrollmentForVisitor, {
    workspaceId: args.workspaceId,
    visitorId: args.visitorId,
    triggerContext: {
      source: args.source,
      eventName: args.eventName,
    },
  });

  await ctx.scheduler.runAfter(0, (internal as any).series.resumeWaitingForEvent, {
    workspaceId: args.workspaceId,
    visitorId: args.visitorId,
    eventName: args.eventName,
  });
}

export const track = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    name: v.string(),
    properties: v.optional(eventPropertiesValidator),
    url: v.optional(v.string()),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let resolvedVisitorId = args.visitorId;

    if (args.sessionToken) {
      const resolved = await resolveVisitorFromSession(ctx, {
        sessionToken: args.sessionToken,
        workspaceId: args.workspaceId,
      });
      resolvedVisitorId = resolved.visitorId;
    }

    if (!resolvedVisitorId) {
      throw new Error("Visitor ID required");
    }

    const eventId = await ctx.db.insert("events", {
      workspaceId: args.workspaceId,
      visitorId: resolvedVisitorId,
      name: args.name,
      properties: args.properties,
      timestamp: Date.now(),
      url: args.url,
      sessionId: args.sessionId,
      eventType: "manual",
    });

    // Trigger checklist auto-completion check
    await ctx.scheduler.runAfter(0, internal.checklists.checkAutoCompletion, {
      visitorId: resolvedVisitorId,
      workspaceId: args.workspaceId,
      eventName: args.name,
    });

    await scheduleSeriesEventRuntime(ctx, {
      workspaceId: args.workspaceId,
      visitorId: resolvedVisitorId,
      source: "event",
      eventName: args.name,
    });

    return eventId;
  },
});

export const trackAutoEvent = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    eventType: v.union(
      v.literal("page_view"),
      v.literal("screen_view"),
      v.literal("session_start"),
      v.literal("session_end")
    ),
    properties: v.optional(eventPropertiesValidator),
    url: v.optional(v.string()),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let resolvedVisitorId = args.visitorId;

    if (args.sessionToken) {
      const resolved = await resolveVisitorFromSession(ctx, {
        sessionToken: args.sessionToken,
        workspaceId: args.workspaceId,
      });
      resolvedVisitorId = resolved.visitorId;
    }

    if (!resolvedVisitorId) {
      return null;
    }

    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;

    const recentEvents = await ctx.db
      .query("events")
      .withIndex("by_visitor", (q) => q.eq("visitorId", resolvedVisitorId!))
      .filter((q) => q.gte(q.field("timestamp"), windowStart))
      .collect();

    const autoEventCount = recentEvents.filter(
      (e) => e.eventType && AUTO_EVENT_TYPES.includes(e.eventType as AutoEventType)
    ).length;

    if (autoEventCount >= RATE_LIMIT_MAX_EVENTS) {
      return null;
    }

    const eventId = await ctx.db.insert("events", {
      workspaceId: args.workspaceId,
      visitorId: resolvedVisitorId!,
      name: args.eventType,
      properties: args.properties,
      timestamp: now,
      url: args.url,
      sessionId: args.sessionId,
      eventType: args.eventType,
    });

    await scheduleSeriesEventRuntime(ctx, {
      workspaceId: args.workspaceId,
      visitorId: resolvedVisitorId!,
      source: "auto_event",
      eventName: args.eventType,
    });

    return eventId;
  },
});

export const list = query({
  args: {
    visitorId: v.id("visitors"),
    limit: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor) {
      return [];
    }

    // Visitor path: require a valid session token for this workspace and visitor.
    if (args.sessionToken && args.workspaceId) {
      try {
        const resolved = await resolveVisitorFromSession(ctx, {
          sessionToken: args.sessionToken,
          workspaceId: args.workspaceId,
        });
        if (resolved.visitorId === args.visitorId && visitor.workspaceId === args.workspaceId) {
          return await ctx.db
            .query("events")
            .withIndex("by_visitor", (q) => q.eq("visitorId", args.visitorId))
            .order("desc")
            .take(limit);
        }
      } catch {
        // Fall through to agent auth path.
      }
    }

    // Agent path: require workspace membership with read permission.
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return [];
    }
    const canRead = await hasPermission(ctx, user._id, visitor.workspaceId, "conversations.read");
    if (!canRead) {
      return [];
    }

    const events = await ctx.db
      .query("events")
      .withIndex("by_visitor", (q) => q.eq("visitorId", args.visitorId))
      .order("desc")
      .take(limit);

    return events;
  },
});

export const count = query({
  args: {
    visitorId: v.id("visitors"),
    name: v.string(),
    withinDays: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor) {
      return 0;
    }

    let visitorAuthorized = false;

    // Visitor path: require a valid session token for this workspace and visitor.
    if (args.sessionToken && args.workspaceId) {
      try {
        const resolved = await resolveVisitorFromSession(ctx, {
          sessionToken: args.sessionToken,
          workspaceId: args.workspaceId,
        });
        if (resolved.visitorId === args.visitorId && visitor.workspaceId === args.workspaceId) {
          visitorAuthorized = true;
        }
      } catch {
        visitorAuthorized = false;
      }
    }

    if (!visitorAuthorized) {
      // Agent path: require workspace membership with read permission.
      const user = await getAuthenticatedUserFromSession(ctx);
      if (!user) {
        return 0;
      }
      const canRead = await hasPermission(ctx, user._id, visitor.workspaceId, "conversations.read");
      if (!canRead) {
        return 0;
      }
    }

    let events = await ctx.db
      .query("events")
      .withIndex("by_visitor_name", (q) => q.eq("visitorId", args.visitorId).eq("name", args.name))
      .collect();

    if (args.withinDays !== undefined) {
      const cutoff = Date.now() - args.withinDays * 24 * 60 * 60 * 1000;
      events = events.filter((e) => e.timestamp >= cutoff);
    }

    return events.length;
  },
});

export const getDistinctNames = query({
  args: {
    workspaceId: v.id("workspaces"),
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

    const events = await ctx.db
      .query("events")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const names = new Set(events.map((e) => e.name));
    return Array.from(names).sort();
  },
});

const DEFAULT_AUTO_EVENT_TTL_DAYS = 30;

export const cleanupOldAutoEvents = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    ttlDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, user._id, args.workspaceId, "data.delete");

    const ttlDays = args.ttlDays ?? DEFAULT_AUTO_EVENT_TTL_DAYS;
    const cutoff = Date.now() - ttlDays * 24 * 60 * 60 * 1000;

    const oldAutoEvents = await ctx.db
      .query("events")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) =>
        q.and(
          q.lt(q.field("timestamp"), cutoff),
          q.or(
            q.eq(q.field("eventType"), "page_view"),
            q.eq(q.field("eventType"), "screen_view"),
            q.eq(q.field("eventType"), "session_start"),
            q.eq(q.field("eventType"), "session_end")
          )
        )
      )
      .take(1000);

    let deleted = 0;
    for (const event of oldAutoEvents) {
      await ctx.db.delete(event._id);
      deleted++;
    }

    return { deleted, hasMore: oldAutoEvents.length === 1000 };
  },
});
