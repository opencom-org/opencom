import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthenticatedUserFromSession } from "./auth";
import { hasPermission, requirePermission } from "./permissions";

export const get = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return null;
    }
    const canRead = await hasPermission(ctx, user._id, args.workspaceId, "settings.workspace");
    if (!canRead) {
      return null;
    }

    const workspaceId = args.workspaceId;
    const result = await ctx.db
      .query("automationSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();
    return result;
  },
});

export const getOrCreate = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const workspaceId = args.workspaceId;
    const existing = await ctx.db
      .query("automationSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    if (existing) {
      return existing;
    }

    // Return default settings (not persisted until update)
    return {
      workspaceId: args.workspaceId,
      suggestArticlesEnabled: false,
      showReplyTimeEnabled: false,
      collectEmailEnabled: true,
      askForRatingEnabled: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  },
});

export const upsert = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    suggestArticlesEnabled: v.optional(v.boolean()),
    showReplyTimeEnabled: v.optional(v.boolean()),
    collectEmailEnabled: v.optional(v.boolean()),
    askForRatingEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    await requirePermission(ctx, user._id, args.workspaceId, "settings.workspace");

    const workspaceId = args.workspaceId;
    const existing = await ctx.db
      .query("automationSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.suggestArticlesEnabled !== undefined && {
          suggestArticlesEnabled: args.suggestArticlesEnabled,
        }),
        ...(args.showReplyTimeEnabled !== undefined && {
          showReplyTimeEnabled: args.showReplyTimeEnabled,
        }),
        ...(args.collectEmailEnabled !== undefined && {
          collectEmailEnabled: args.collectEmailEnabled,
        }),
        ...(args.askForRatingEnabled !== undefined && {
          askForRatingEnabled: args.askForRatingEnabled,
        }),
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("automationSettings", {
      workspaceId: args.workspaceId,
      suggestArticlesEnabled: args.suggestArticlesEnabled ?? false,
      showReplyTimeEnabled: args.showReplyTimeEnabled ?? false,
      collectEmailEnabled: args.collectEmailEnabled ?? true,
      askForRatingEnabled: args.askForRatingEnabled ?? false,
      createdAt: now,
      updatedAt: now,
    });
  },
});
