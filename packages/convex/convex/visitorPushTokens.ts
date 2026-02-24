import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthenticatedUserFromSession } from "./auth";
import { hasPermission } from "./permissions";
import { resolveVisitorFromSession } from "./widgetSessions";

const TOKEN_LIST_DEFAULT_LIMIT = 200;
const TOKEN_LIST_MAX_LIMIT = 2000;
const TARGETING_PER_VISITOR_LIMIT = 8;
const STATS_SCAN_DEFAULT_LIMIT = 5000;
const STATS_SCAN_MAX_LIMIT = 20000;
const INVALID_TOKEN_ERROR_MARKERS = [
  "devicenotregistered",
  "invalidregistration",
  "invalidpushtoken",
  "pushtokeninvalid",
  "invalidtoken",
];

function clampLimit(value: number | undefined, fallback: number, max: number): number {
  return Math.max(1, Math.min(value ?? fallback, max));
}

export const register = mutation({
  args: {
    visitorId: v.id("visitors"),
    token: v.string(),
    platform: v.union(v.literal("ios"), v.literal("android")),
    deviceId: v.optional(v.string()),
    sessionToken: v.optional(v.string()),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor) {
      throw new Error("Visitor not found");
    }

    let visitorAuthorized = false;
    if (args.sessionToken) {
      const workspaceId = args.workspaceId ?? visitor.workspaceId;
      const resolved = await resolveVisitorFromSession(ctx, {
        sessionToken: args.sessionToken,
        workspaceId,
      });
      if (workspaceId !== visitor.workspaceId) {
        throw new Error("Session token does not match workspace");
      }
      if (resolved.visitorId !== args.visitorId) {
        throw new Error("Session token does not match visitor");
      }
      visitorAuthorized = true;
    }

    if (!visitorAuthorized) {
      const user = await getAuthenticatedUserFromSession(ctx);
      if (!user) {
        throw new Error("Not authorized to manage visitor push tokens");
      }
      const canAccess = await hasPermission(
        ctx,
        user._id,
        visitor.workspaceId,
        "settings.integrations"
      );
      if (!canAccess) {
        throw new Error("Not authorized to manage visitor push tokens");
      }
    }

    const now = Date.now();

    // Check if token already exists
    const existing = await ctx.db
      .query("visitorPushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (existing) {
      // Update existing token if visitor changed
      if (existing.visitorId !== args.visitorId) {
        await ctx.db.patch(existing._id, {
          visitorId: args.visitorId,
          workspaceId: visitor.workspaceId,
          platform: args.platform,
          deviceId: args.deviceId,
          notificationsEnabled: true,
          disabledAt: undefined,
          lastFailureAt: undefined,
          lastFailureReason: undefined,
          updatedAt: now,
        });
        return {
          tokenId: existing._id,
          status: "reassigned" as const,
        };
      } else {
        await ctx.db.patch(existing._id, {
          platform: args.platform,
          deviceId: args.deviceId,
          notificationsEnabled: true,
          disabledAt: undefined,
          lastFailureAt: undefined,
          lastFailureReason: undefined,
          updatedAt: now,
        });
        return {
          tokenId: existing._id,
          status: "updated" as const,
        };
      }
    }

    // Create new token
    const tokenId = await ctx.db.insert("visitorPushTokens", {
      visitorId: args.visitorId,
      workspaceId: visitor.workspaceId,
      token: args.token,
      platform: args.platform,
      deviceId: args.deviceId,
      notificationsEnabled: true,
      createdAt: now,
      updatedAt: now,
    });

    return {
      tokenId,
      status: "created" as const,
    };
  },
});

export const unregister = mutation({
  args: {
    token: v.string(),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("visitorPushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!existing) {
      return { success: true, status: "not_found" as const };
    }

    let visitorAuthorized = false;
    if (args.sessionToken) {
      const workspaceId = args.workspaceId ?? existing.workspaceId;
      const resolved = await resolveVisitorFromSession(ctx, {
        sessionToken: args.sessionToken,
        workspaceId,
      });
      if (workspaceId !== existing.workspaceId) {
        throw new Error("Session token does not match workspace");
      }
      if (resolved.visitorId !== existing.visitorId) {
        throw new Error("Session token does not match visitor");
      }
      if (args.visitorId && args.visitorId !== existing.visitorId) {
        throw new Error("Visitor/token mismatch");
      }
      visitorAuthorized = true;
    }

    if (!visitorAuthorized) {
      const user = await getAuthenticatedUserFromSession(ctx);
      if (!user) {
        throw new Error("Not authorized to manage visitor push tokens");
      }
      const canAccess = await hasPermission(
        ctx,
        user._id,
        existing.workspaceId,
        "settings.integrations"
      );
      if (!canAccess) {
        throw new Error("Not authorized to manage visitor push tokens");
      }
    }

    await ctx.db.delete(existing._id);

    return {
      success: true,
      status: "removed" as const,
      tokenId: existing._id,
    };
  },
});

export const setNotificationsEnabled = mutation({
  args: {
    token: v.string(),
    enabled: v.boolean(),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("visitorPushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!existing) {
      return { success: true, status: "not_found" as const };
    }

    let visitorAuthorized = false;
    if (args.sessionToken) {
      const workspaceId = args.workspaceId ?? existing.workspaceId;
      const resolved = await resolveVisitorFromSession(ctx, {
        sessionToken: args.sessionToken,
        workspaceId,
      });
      if (workspaceId !== existing.workspaceId) {
        throw new Error("Session token does not match workspace");
      }
      if (resolved.visitorId !== existing.visitorId) {
        throw new Error("Session token does not match visitor");
      }
      if (args.visitorId && args.visitorId !== existing.visitorId) {
        throw new Error("Visitor/token mismatch");
      }
      visitorAuthorized = true;
    }

    if (!visitorAuthorized) {
      const user = await getAuthenticatedUserFromSession(ctx);
      if (!user) {
        throw new Error("Not authorized to manage visitor push tokens");
      }
      const canAccess = await hasPermission(
        ctx,
        user._id,
        existing.workspaceId,
        "settings.integrations"
      );
      if (!canAccess) {
        throw new Error("Not authorized to manage visitor push tokens");
      }
    }

    await ctx.db.patch(existing._id, {
      notificationsEnabled: args.enabled,
      ...(args.enabled ? { disabledAt: undefined } : { disabledAt: Date.now() }),
      updatedAt: Date.now(),
    });

    return {
      success: true,
      status: "updated" as const,
      tokenId: existing._id,
      enabled: args.enabled,
    };
  },
});

export const recordDeliveryFailure = internalMutation({
  args: {
    token: v.string(),
    error: v.string(),
    removeToken: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("visitorPushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!existing) {
      return {
        success: false,
        status: "not_found" as const,
      };
    }

    const now = Date.now();
    const normalizedError = args.error.toLowerCase();
    const shouldDisable = INVALID_TOKEN_ERROR_MARKERS.some((marker) =>
      normalizedError.includes(marker)
    );
    const shouldRemove = args.removeToken === true;

    if (shouldRemove) {
      await ctx.db.delete(existing._id);
      return {
        success: true,
        status: "removed" as const,
        tokenId: existing._id,
      };
    }

    const failureCount = (existing.failureCount ?? 0) + 1;
    await ctx.db.patch(existing._id, {
      failureCount,
      lastFailureAt: now,
      lastFailureReason: args.error,
      ...(shouldDisable
        ? {
            notificationsEnabled: false,
            disabledAt: now,
          }
        : {}),
      updatedAt: now,
    });

    return {
      success: true,
      status: shouldDisable ? ("disabled" as const) : ("failure_recorded" as const),
      tokenId: existing._id,
      failureCount,
    };
  },
});

export const getByVisitor = query({
  args: {
    visitorId: v.id("visitors"),
    sessionToken: v.optional(v.string()),
    workspaceId: v.optional(v.id("workspaces")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, TOKEN_LIST_DEFAULT_LIMIT, TOKEN_LIST_MAX_LIMIT);
    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor) {
      return [];
    }

    if (args.sessionToken) {
      const workspaceId = args.workspaceId ?? visitor.workspaceId;
      try {
        const resolved = await resolveVisitorFromSession(ctx, {
          sessionToken: args.sessionToken,
          workspaceId,
        });
        if (resolved.visitorId === args.visitorId && workspaceId === visitor.workspaceId) {
          return await ctx.db
            .query("visitorPushTokens")
            .withIndex("by_visitor", (q) => q.eq("visitorId", args.visitorId))
            .take(limit);
        }
      } catch {
        return [];
      }
      return [];
    }

    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return [];
    }
    const canAccess = await hasPermission(
      ctx,
      user._id,
      visitor.workspaceId,
      "settings.integrations"
    );
    if (!canAccess) {
      return [];
    }

    return await ctx.db
      .query("visitorPushTokens")
      .withIndex("by_visitor", (q) => q.eq("visitorId", args.visitorId))
      .take(limit);
  },
});

export const getByWorkspace = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, TOKEN_LIST_DEFAULT_LIMIT, TOKEN_LIST_MAX_LIMIT);
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return [];
    }
    const canAccess = await hasPermission(ctx, user._id, args.workspaceId, "settings.integrations");
    if (!canAccess) {
      return [];
    }

    return await ctx.db
      .query("visitorPushTokens")
      .withIndex("by_workspace_updated_at", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(limit);
  },
});

export const listForTargeting = query({
  args: {
    workspaceId: v.id("workspaces"),
    visitorIds: v.optional(v.array(v.id("visitors"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, TOKEN_LIST_DEFAULT_LIMIT, TOKEN_LIST_MAX_LIMIT);
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return [];
    }
    const canAccess = await hasPermission(ctx, user._id, args.workspaceId, "settings.integrations");
    if (!canAccess) {
      return [];
    }

    if (args.visitorIds && args.visitorIds.length > 0) {
      const uniqueVisitorIds = [...new Set(args.visitorIds)].slice(0, limit);

      const tokenBatches = await Promise.all(
        uniqueVisitorIds.map((visitorId) =>
          ctx.db
            .query("visitorPushTokens")
            .withIndex("by_visitor", (q) => q.eq("visitorId", visitorId))
            .take(TARGETING_PER_VISITOR_LIMIT)
        )
      );

      return tokenBatches
        .flat()
        .filter((token) => token.workspaceId === args.workspaceId)
        .slice(0, limit);
    }

    return await ctx.db
      .query("visitorPushTokens")
      .withIndex("by_workspace_updated_at", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(limit);
  },
});

export const listWithVisitorInfo = query({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, TOKEN_LIST_DEFAULT_LIMIT, TOKEN_LIST_MAX_LIMIT);
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return [];
    }
    const canAccess = await hasPermission(ctx, user._id, args.workspaceId, "settings.integrations");
    if (!canAccess) {
      return [];
    }

    const tokens = await ctx.db
      .query("visitorPushTokens")
      .withIndex("by_workspace_updated_at", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(limit);

    const tokensWithVisitors = await Promise.all(
      tokens.map(async (token) => {
        const visitor = await ctx.db.get(token.visitorId);
        return {
          ...token,
          visitorReadableId: visitor?.readableId || null,
          visitorName: visitor?.name || null,
          visitorEmail: visitor?.email || null,
        };
      })
    );

    return tokensWithVisitors.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const getStats = query({
  args: {
    workspaceId: v.id("workspaces"),
    scanLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const scanLimit = clampLimit(args.scanLimit, STATS_SCAN_DEFAULT_LIMIT, STATS_SCAN_MAX_LIMIT);
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return { total: 0, ios: 0, android: 0, uniqueVisitors: 0 };
    }
    const canAccess = await hasPermission(ctx, user._id, args.workspaceId, "settings.integrations");
    if (!canAccess) {
      return { total: 0, ios: 0, android: 0, uniqueVisitors: 0 };
    }

    const tokenScan = await ctx.db
      .query("visitorPushTokens")
      .withIndex("by_workspace_updated_at", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(scanLimit + 1);

    const tokens = tokenScan.slice(0, scanLimit);

    const iosCount = tokens.filter((t) => t.platform === "ios").length;
    const androidCount = tokens.filter((t) => t.platform === "android").length;
    const uniqueVisitors = new Set(tokens.map((t) => t.visitorId)).size;

    return {
      total: tokens.length,
      ios: iosCount,
      android: androidCount,
      uniqueVisitors,
    };
  },
});
