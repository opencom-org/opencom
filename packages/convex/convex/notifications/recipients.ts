import { v } from "convex/values";
import { internalQuery, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  resolveMemberNewVisitorMessagePreference,
  resolveWorkspaceNewVisitorMessageDefaults,
} from "../lib/notificationPreferences";

export const getPushTokensForWorkspace = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    excludeUserId: v.optional(v.id("users")),
    event: v.optional(v.literal("newVisitorMessage")),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const workspaceDefaults = args.event
      ? await ctx.db
          .query("workspaceNotificationDefaults")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
          .first()
      : null;

    const defaultNewVisitorMessagePreferences =
      resolveWorkspaceNewVisitorMessageDefaults(workspaceDefaults);

    const tokens: { token: string; platform: "ios" | "android"; userId: Id<"users"> }[] = [];

    for (const user of users) {
      if (args.excludeUserId && user._id === args.excludeUserId) {
        continue;
      }

      const prefs = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_user_workspace", (q) =>
          q.eq("userId", user._id).eq("workspaceId", args.workspaceId)
        )
        .first();

      const pushEnabled =
        args.event === "newVisitorMessage"
          ? resolveMemberNewVisitorMessagePreference(prefs, defaultNewVisitorMessagePreferences)
              .push
          : !prefs?.muted;

      if (!pushEnabled) {
        continue;
      }

      const userTokens = await ctx.db
        .query("pushTokens")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();

      for (const token of userTokens) {
        if (token.notificationsEnabled === false) {
          continue;
        }
        tokens.push({
          token: token.token,
          platform: token.platform,
          userId: user._id,
        });
      }
    }

    return tokens;
  },
});

export const getMemberRecipientsForNewVisitorMessage = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const workspaceDefaults = await ctx.db
      .query("workspaceNotificationDefaults")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    const defaultNewVisitorMessagePreferences =
      resolveWorkspaceNewVisitorMessageDefaults(workspaceDefaults);

    const emailRecipients: string[] = [];
    const pushRecipients: {
      token: string;
      platform: "ios" | "android";
      userId: Id<"users">;
    }[] = [];

    const decisions: Array<{
      userId: Id<"users">;
      emailEnabled: boolean;
      pushEnabled: boolean;
      pushTokenCount: number;
      emailAddress: string | null;
    }> = [];

    for (const user of users) {
      const prefs = await ctx.db
        .query("notificationPreferences")
        .withIndex("by_user_workspace", (q) =>
          q.eq("userId", user._id).eq("workspaceId", args.workspaceId)
        )
        .first();

      const effective = resolveMemberNewVisitorMessagePreference(
        prefs,
        defaultNewVisitorMessagePreferences
      );

      if (effective.email && user.email) {
        emailRecipients.push(user.email);
      }

      let enabledPushTokenCount = 0;
      if (effective.push) {
        const userTokens = await ctx.db
          .query("pushTokens")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();

        for (const token of userTokens) {
          if (token.notificationsEnabled === false) {
            continue;
          }
          enabledPushTokenCount += 1;
          pushRecipients.push({
            token: token.token,
            platform: token.platform,
            userId: user._id,
          });
        }
      }

      decisions.push({
        userId: user._id,
        emailEnabled: effective.email,
        pushEnabled: effective.push,
        pushTokenCount: enabledPushTokenCount,
        emailAddress: user.email ?? null,
      });
    }

    return {
      emailRecipients,
      pushRecipients,
      decisions,
    };
  },
});

export const getVisitorRecipientsForSupportReply = internalQuery({
  args: {
    conversationId: v.id("conversations"),
    channel: v.optional(v.union(v.literal("chat"), v.literal("email"))),
  },
  handler: async (ctx, args) => {
    const conversation = (await ctx.db.get(args.conversationId)) as Doc<"conversations"> | null;
    const visitorId = conversation?.visitorId;
    if (!visitorId) {
      return {
        emailRecipient: null as string | null,
        pushTokens: [] as string[],
      };
    }

    const visitor = (await ctx.db.get(visitorId)) as Doc<"visitors"> | null;
    const visitorTokens = await ctx.db
      .query("visitorPushTokens")
      .withIndex("by_visitor", (q) => q.eq("visitorId", visitorId))
      .collect();

    return {
      emailRecipient: visitor?.email && args.channel !== "email" ? visitor.email : null,
      pushTokens: visitorTokens
        .filter((token) => token.notificationsEnabled !== false)
        .map((token) => token.token),
    };
  },
});

type VisitorRecipientResolutionCtx = Pick<QueryCtx | MutationCtx, "db">;

export async function resolveDefaultVisitorRecipients(
  ctx: VisitorRecipientResolutionCtx,
  args: {
    conversationId?: Id<"conversations">;
    ticketId?: Id<"tickets">;
  }
): Promise<Id<"visitors">[]> {
  if (args.conversationId) {
    const conversation = (await ctx.db.get(args.conversationId)) as Doc<"conversations"> | null;
    if (conversation?.visitorId) {
      return [conversation.visitorId];
    }
  }
  if (args.ticketId) {
    const ticket = (await ctx.db.get(args.ticketId)) as Doc<"tickets"> | null;
    if (ticket?.visitorId) {
      return [ticket.visitorId];
    }
  }
  return [];
}
