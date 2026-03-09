import { internalMutation } from "../../_generated/server";
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";

function getInternalRef(name: string): unknown {
  return makeFunctionReference(name);
}

function getShallowRunMutation(ctx: { runMutation: unknown }) {
  return ctx.runMutation as unknown as (
    mutationRef: unknown,
    mutationArgs: Record<string, unknown>
  ) => Promise<unknown>;
}

function getShallowRunQuery(ctx: { runQuery: unknown }) {
  return ctx.runQuery as unknown as (
    queryRef: unknown,
    queryArgs: Record<string, unknown>
  ) => Promise<unknown>;
}

const createTestPushCampaign = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    targeting: v.optional(v.any()),
    audienceRules: v.optional(v.any()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("scheduled"),
        v.literal("sending"),
        v.literal("sent"),
        v.literal("paused")
      )
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2, 8);

    const campaignId = await ctx.db.insert("pushCampaigns", {
      workspaceId: args.workspaceId,
      name: args.name ?? `Test Push Campaign ${randomSuffix}`,
      title: args.title ?? "Test push title",
      body: args.body ?? "Test push body",
      targeting: args.targeting,
      audienceRules: args.audienceRules,
      status: args.status ?? "draft",
      createdAt: now,
      updatedAt: now,
    });

    return { campaignId };
  },
});

const sendTestPushCampaign: ReturnType<typeof internalMutation> = internalMutation({
  args: {
    campaignId: v.id("pushCampaigns"),
  },
  handler: async (ctx, args): Promise<unknown> => {
    const runMutation = getShallowRunMutation(ctx);
    return await runMutation(getInternalRef("pushCampaigns:sendForTesting"), {
      id: args.campaignId,
    });
  },
});

const getTestPendingPushCampaignRecipients: ReturnType<typeof internalMutation> =
  internalMutation({
    args: {
      campaignId: v.id("pushCampaigns"),
      limit: v.optional(v.number()),
    },
    handler: async (ctx, args): Promise<unknown> => {
      const runQuery = getShallowRunQuery(ctx);
      return await runQuery(getInternalRef("pushCampaigns:getPendingRecipients"), {
        campaignId: args.campaignId,
        limit: args.limit,
      });
    },
  });

/**
 * Creates a test message in the specified conversation.
 */
const createTestPushToken = internalMutation({
  args: {
    userId: v.id("users"),
    token: v.optional(v.string()),
    platform: v.optional(v.union(v.literal("ios"), v.literal("android"))),
    notificationsEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const token =
      args.token ??
      `ExponentPushToken[test-${args.userId}-${Math.random().toString(36).slice(2, 10)}]`;
    const tokenId = await ctx.db.insert("pushTokens", {
      userId: args.userId,
      token,
      platform: args.platform ?? "ios",
      notificationsEnabled: args.notificationsEnabled ?? true,
      createdAt: now,
    });
    return { tokenId, token };
  },
});
const createTestVisitorPushToken = internalMutation({
  args: {
    visitorId: v.id("visitors"),
    token: v.optional(v.string()),
    platform: v.optional(v.union(v.literal("ios"), v.literal("android"))),
    notificationsEnabled: v.optional(v.boolean()),
    workspaceId: v.optional(v.id("workspaces")),
  },
  handler: async (ctx, args) => {
    const visitor = await ctx.db.get(args.visitorId);
    if (!visitor) {
      throw new Error("Visitor not found");
    }

    const now = Date.now();
    const token =
      args.token ??
      `ExponentPushToken[visitor-${args.visitorId}-${Math.random().toString(36).slice(2, 10)}]`;
    const tokenId = await ctx.db.insert("visitorPushTokens", {
      visitorId: args.visitorId,
      workspaceId: args.workspaceId ?? visitor.workspaceId,
      token,
      platform: args.platform ?? "ios",
      notificationsEnabled: args.notificationsEnabled ?? true,
      createdAt: now,
      updatedAt: now,
    });
    return { tokenId, token };
  },
});
const upsertTestNotificationPreference = internalMutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    muted: v.optional(v.boolean()),
    newVisitorMessageEmail: v.optional(v.boolean()),
    newVisitorMessagePush: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", args.userId).eq("workspaceId", args.workspaceId)
      )
      .first();

    const now = Date.now();
    const nextNewVisitorMessage = {
      ...(existing?.events?.newVisitorMessage ?? {}),
      ...(args.newVisitorMessageEmail !== undefined ? { email: args.newVisitorMessageEmail } : {}),
      ...(args.newVisitorMessagePush !== undefined ? { push: args.newVisitorMessagePush } : {}),
    };

    const hasEventOverrides =
      nextNewVisitorMessage.email !== undefined || nextNewVisitorMessage.push !== undefined;

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
      return { preferenceId: existing._id };
    }

    const preferenceId = await ctx.db.insert("notificationPreferences", {
      userId: args.userId,
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
    return { preferenceId };
  },
});
const upsertTestWorkspaceNotificationDefaults = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    newVisitorMessageEmail: v.optional(v.boolean()),
    newVisitorMessagePush: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("workspaceNotificationDefaults")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const now = Date.now();
    const nextNewVisitorMessage = {
      ...(existing?.events?.newVisitorMessage ?? {}),
      ...(args.newVisitorMessageEmail !== undefined ? { email: args.newVisitorMessageEmail } : {}),
      ...(args.newVisitorMessagePush !== undefined ? { push: args.newVisitorMessagePush } : {}),
    };

    const hasEventDefaults =
      nextNewVisitorMessage.email !== undefined || nextNewVisitorMessage.push !== undefined;

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
      return { defaultsId: existing._id };
    }

    const defaultsId = await ctx.db.insert("workspaceNotificationDefaults", {
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
    return { defaultsId };
  },
});
const getTestMemberRecipientsForNewVisitorMessage: ReturnType<typeof internalMutation> =
  internalMutation({
    args: {
      workspaceId: v.id("workspaces"),
    },
    handler: async (ctx, args): Promise<unknown> => {
      const runQuery = getShallowRunQuery(ctx);
      return await runQuery(getInternalRef("notifications:getMemberRecipientsForNewVisitorMessage"), {
        workspaceId: args.workspaceId,
      });
    },
  });
const getTestVisitorRecipientsForSupportReply: ReturnType<typeof internalMutation> =
  internalMutation({
    args: {
      conversationId: v.id("conversations"),
      channel: v.optional(v.union(v.literal("chat"), v.literal("email"))),
    },
    handler: async (ctx, args): Promise<unknown> => {
      const runQuery = getShallowRunQuery(ctx);
      return await runQuery(getInternalRef("notifications:getVisitorRecipientsForSupportReply"), {
        conversationId: args.conversationId,
        channel: args.channel,
      });
    },
  });

/**
 * Creates a test invitation in the specified workspace.
 * This bypasses the email sending action for testing purposes.
 */

export const notificationTestHelpers: Record<string, ReturnType<typeof internalMutation>> = {
  createTestPushCampaign,
  sendTestPushCampaign,
  getTestPendingPushCampaignRecipients,
  createTestPushToken,
  createTestVisitorPushToken,
  upsertTestNotificationPreference,
  upsertTestWorkspaceNotificationDefaults,
  getTestMemberRecipientsForNewVisitorMessage,
  getTestVisitorRecipientsForSupportReply,
} as const;
