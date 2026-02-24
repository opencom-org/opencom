import { v } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import { type Id } from "./_generated/dataModel";
import { getAuthenticatedUserFromSession } from "./auth";
import { hasPermission, requirePermission } from "./permissions";
import {
  resolveMemberNewVisitorMessagePreference,
  resolveWorkspaceNewVisitorMessageDefaults,
} from "./lib/notificationPreferences";

const notificationPreferenceUpdateArgs = {
  workspaceId: v.id("workspaces"),
  newVisitorMessageEmail: v.optional(v.boolean()),
  newVisitorMessagePush: v.optional(v.boolean()),
};

async function getWorkspaceMembership(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  workspaceId: Id<"workspaces">
) {
  return await ctx.db
    .query("workspaceMembers")
    .withIndex("by_user_workspace", (q) => q.eq("userId", userId).eq("workspaceId", workspaceId))
    .first();
}

export const getMyPreferences = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return null;
    }

    const membership = await getWorkspaceMembership(ctx, user._id, args.workspaceId);
    if (!membership) {
      return null;
    }

    const workspaceDefaults = await ctx.db
      .query("workspaceNotificationDefaults")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const defaults = resolveWorkspaceNewVisitorMessageDefaults(workspaceDefaults);

    const preference = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", args.workspaceId)
      )
      .first();

    const effective = resolveMemberNewVisitorMessagePreference(preference, defaults);

    return {
      defaults: {
        newVisitorMessageEmail: defaults.email,
        newVisitorMessagePush: defaults.push,
      },
      overrides: {
        newVisitorMessageEmail: preference?.events?.newVisitorMessage?.email ?? null,
        newVisitorMessagePush: preference?.events?.newVisitorMessage?.push ?? null,
      },
      effective: {
        newVisitorMessageEmail: effective.email,
        newVisitorMessagePush: effective.push,
      },
      muted: preference?.muted ?? false,
    };
  },
});

export const updateMyPreferences = mutation({
  args: {
    ...notificationPreferenceUpdateArgs,
    muted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const membership = await getWorkspaceMembership(ctx, user._id, args.workspaceId);
    if (!membership) {
      throw new Error("Not a member of this workspace");
    }

    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", args.workspaceId)
      )
      .first();

    const nextNewVisitorMessage = {
      ...(existing?.events?.newVisitorMessage ?? {}),
      ...(args.newVisitorMessageEmail !== undefined ? { email: args.newVisitorMessageEmail } : {}),
      ...(args.newVisitorMessagePush !== undefined ? { push: args.newVisitorMessagePush } : {}),
    };

    const hasEventOverrides =
      nextNewVisitorMessage.email !== undefined || nextNewVisitorMessage.push !== undefined;

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.muted !== undefined ? { muted: args.muted } : {}),
        ...(hasEventOverrides
          ? {
              events: {
                ...(existing.events ?? {}),
                newVisitorMessage: nextNewVisitorMessage,
              },
            }
          : {}),
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("notificationPreferences", {
      userId: user._id,
      workspaceId: args.workspaceId,
      muted: args.muted ?? false,
      ...(hasEventOverrides
        ? {
            events: {
              newVisitorMessage: nextNewVisitorMessage,
            },
          }
        : {}),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getWorkspaceDefaults = query({
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

    const workspaceDefaults = await ctx.db
      .query("workspaceNotificationDefaults")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const defaults = resolveWorkspaceNewVisitorMessageDefaults(workspaceDefaults);

    return {
      newVisitorMessageEmail: defaults.email,
      newVisitorMessagePush: defaults.push,
    };
  },
});

export const updateWorkspaceDefaults = mutation({
  args: notificationPreferenceUpdateArgs,
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    await requirePermission(ctx, user._id, args.workspaceId, "settings.workspace");

    const existing = await ctx.db
      .query("workspaceNotificationDefaults")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const nextNewVisitorMessage = {
      ...(existing?.events?.newVisitorMessage ?? {}),
      ...(args.newVisitorMessageEmail !== undefined ? { email: args.newVisitorMessageEmail } : {}),
      ...(args.newVisitorMessagePush !== undefined ? { push: args.newVisitorMessagePush } : {}),
    };

    const hasEventDefaults =
      nextNewVisitorMessage.email !== undefined || nextNewVisitorMessage.push !== undefined;

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(hasEventDefaults
          ? {
              events: {
                ...(existing.events ?? {}),
                newVisitorMessage: nextNewVisitorMessage,
              },
            }
          : {}),
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("workspaceNotificationDefaults", {
      workspaceId: args.workspaceId,
      ...(hasEventDefaults
        ? {
            events: {
              newVisitorMessage: nextNewVisitorMessage,
            },
          }
        : {}),
      createdAt: now,
      updatedAt: now,
    });
  },
});
