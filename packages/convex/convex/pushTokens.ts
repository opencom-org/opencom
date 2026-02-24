import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { hasPermission } from "./permissions";

const INVALID_TOKEN_ERROR_MARKERS = [
  "devicenotregistered",
  "invalidregistration",
  "invalidpushtoken",
  "pushtokeninvalid",
  "invalidtoken",
];

export const register = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
    platform: v.union(v.literal("ios"), v.literal("android")),
  },
  handler: async (ctx, args) => {
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) {
      throw new Error("Not authenticated");
    }
    if (authUserId !== args.userId) {
      throw new Error("Cannot register push token for another user");
    }

    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (existing) {
      const now = Date.now();
      if (existing.userId !== args.userId) {
        await ctx.db.patch(existing._id, {
          userId: args.userId,
          platform: args.platform,
          notificationsEnabled: true,
          disabledAt: undefined,
          lastFailureAt: undefined,
          lastFailureReason: undefined,
          updatedAt: now,
        });
      } else if (existing.notificationsEnabled === false) {
        await ctx.db.patch(existing._id, {
          notificationsEnabled: true,
          disabledAt: undefined,
          updatedAt: now,
        });
      } else {
        await ctx.db.patch(existing._id, {
          platform: args.platform,
          updatedAt: now,
        });
      }
      return existing._id;
    }

    const now = Date.now();
    const tokenId = await ctx.db.insert("pushTokens", {
      userId: args.userId,
      token: args.token,
      platform: args.platform,
      notificationsEnabled: true,
      createdAt: now,
      updatedAt: now,
    });

    return tokenId;
  },
});

export const unregister = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (existing && existing.userId === authUserId) {
      await ctx.db.delete(existing._id);
    }

    return { success: true };
  },
});

export const unregisterAllForCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) {
      throw new Error("Not authenticated");
    }

    const tokens = await ctx.db
      .query("pushTokens")
      .withIndex("by_user", (q) => q.eq("userId", authUserId))
      .collect();

    await Promise.all(tokens.map((token) => ctx.db.delete(token._id)));

    return {
      success: true,
      removed: tokens.length,
    };
  },
});

export const getByUser = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const requesterId = await getAuthUserId(ctx);
    if (!requesterId) {
      return [];
    }

    if (requesterId !== args.userId) {
      const targetUser = await ctx.db.get(args.userId);
      if (!targetUser?.workspaceId) {
        return [];
      }
      const canReadUsers = await hasPermission(
        ctx,
        requesterId,
        targetUser.workspaceId,
        "users.read"
      );
      if (!canReadUsers) {
        return [];
      }
    }

    return await ctx.db
      .query("pushTokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const setNotificationsEnabled = mutation({
  args: {
    token: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!existing || existing.userId !== authUserId) {
      throw new Error("Cannot update push token for another user");
    }

    await ctx.db.patch(existing._id, {
      notificationsEnabled: args.enabled,
      ...(args.enabled ? { disabledAt: undefined } : { disabledAt: Date.now() }),
      updatedAt: Date.now(),
    });

    return { success: true };
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
      .query("pushTokens")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!existing) {
      return {
        success: false,
        status: "not_found" as const,
      };
    }

    if (args.removeToken) {
      await ctx.db.delete(existing._id);
      return {
        success: true,
        status: "removed" as const,
        tokenId: existing._id,
      };
    }

    const now = Date.now();
    const normalizedError = args.error.toLowerCase();
    const shouldDisable = INVALID_TOKEN_ERROR_MARKERS.some((marker) =>
      normalizedError.includes(marker)
    );
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

export const debugLog = mutation({
  args: {
    stage: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUserId = await getAuthUserId(ctx);
    console.log("[PushRegistrationDebug]", {
      stage: args.stage,
      details: args.details ?? null,
      authUserId: authUserId ?? null,
      timestamp: Date.now(),
    });
    return {
      success: true,
      authUserId: authUserId ?? null,
    };
  },
});
