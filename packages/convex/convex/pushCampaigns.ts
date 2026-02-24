import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { evaluateRuleWithSegmentSupport, validateAudienceRule } from "./audienceRules";
import { audienceRulesOrSegmentValidator, pushDataValidator } from "./validators";
import { authMutation, authQuery } from "./lib/authWrappers";

const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 500;
const DEFAULT_RECIPIENT_BATCH_LIMIT = 1000;
const MAX_RECIPIENT_BATCH_LIMIT = 5000;
const DEFAULT_STATS_SAMPLE_LIMIT = 5000;
const MAX_STATS_SAMPLE_LIMIT = 20000;
const MAX_CAMPAIGN_VISITOR_SCAN = 5000;
function clampLimit(limit: number | undefined, defaultValue: number, maxValue: number): number {
  const normalized = limit ?? defaultValue;
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return defaultValue;
  }
  return Math.min(Math.floor(normalized), maxValue);
}

function assertValidTargeting(targeting: Doc<"pushCampaigns">["targeting"] | undefined): void {
  const hasSegmentReference =
    typeof targeting === "object" && targeting !== null && "segmentId" in targeting;
  if (targeting !== undefined && !hasSegmentReference && !validateAudienceRule(targeting)) {
    throw new Error("Invalid targeting rules");
  }
}

async function resolveVisitorRecipientTokens(
  ctx: MutationCtx,
  campaign: Doc<"pushCampaigns">
): Promise<Array<{ visitorId: Id<"visitors">; tokenId: Id<"visitorPushTokens"> }>> {
  const visitors = await ctx.db
    .query("visitors")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", campaign.workspaceId))
    .take(MAX_CAMPAIGN_VISITOR_SCAN + 1);

  if (visitors.length > MAX_CAMPAIGN_VISITOR_SCAN) {
    throw new Error(
      `Campaign audience exceeds safe scan limit (${MAX_CAMPAIGN_VISITOR_SCAN}). Narrow targeting before sending.`
    );
  }

  const audienceRules = campaign.audienceRules ?? campaign.targeting;
  const recipientTokens: Array<{ visitorId: Id<"visitors">; tokenId: Id<"visitorPushTokens"> }> =
    [];

  for (const visitor of visitors) {
    if (audienceRules) {
      const matches = await evaluateRuleWithSegmentSupport(ctx, audienceRules, visitor);
      if (!matches) {
        continue;
      }
    }

    const visitorTokens = await ctx.db
      .query("visitorPushTokens")
      .withIndex("by_visitor", (q) => q.eq("visitorId", visitor._id))
      .collect();

    for (const token of visitorTokens) {
      if (token.workspaceId !== campaign.workspaceId) {
        continue;
      }
      if (token.notificationsEnabled === false) {
        continue;
      }
      recipientTokens.push({
        visitorId: visitor._id,
        tokenId: token._id,
      });
    }
  }

  return recipientTokens;
}

async function enqueueCampaignRecipients(
  ctx: MutationCtx,
  campaignId: Id<"pushCampaigns">,
  campaign: Doc<"pushCampaigns">
) {
  const now = Date.now();
  const recipients = await resolveVisitorRecipientTokens(ctx, campaign);

  for (const recipient of recipients) {
    await ctx.db.insert("pushCampaignRecipients", {
      campaignId,
      recipientType: "visitor",
      visitorId: recipient.visitorId,
      tokenId: recipient.tokenId,
      status: "pending",
      createdAt: now,
    });
  }

  const isScheduled = campaign.schedule?.type === "scheduled" && campaign.schedule.scheduledAt;
  await ctx.db.patch(campaignId, {
    status: isScheduled ? "scheduled" : "sending",
    updatedAt: now,
  });

  return { recipientCount: recipients.length };
}

function getTicketErrorDetails(ticket: {
  error?: string;
  errorCode?: string;
  message?: string;
  details?: { error?: string };
}): { errorMessage: string; errorCode?: string } {
  const errorCode = ticket.errorCode ?? ticket.details?.error;
  const errorMessage = errorCode
    ? `${errorCode}${ticket.error || ticket.message ? `: ${ticket.error || ticket.message}` : ""}`
    : ticket.error || ticket.message || "Unknown error";
  return { errorMessage, errorCode };
}

// Task 3.3: Create push notification campaign
export const create = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    title: v.string(),
    body: v.string(),
    imageUrl: v.optional(v.string()),
    data: v.optional(pushDataValidator),
    deepLink: v.optional(v.string()),
    targeting: v.optional(audienceRulesOrSegmentValidator),
    schedule: v.optional(
      v.object({
        type: v.union(v.literal("immediate"), v.literal("scheduled")),
        scheduledAt: v.optional(v.number()),
        timezone: v.optional(v.string()),
      })
    ),
  },
  permission: "settings.workspace",
  handler: async (ctx, args) => {
    assertValidTargeting(args.targeting);

    const now = Date.now();
    return await ctx.db.insert("pushCampaigns", {
      workspaceId: args.workspaceId,
      name: args.name,
      title: args.title,
      body: args.body,
      imageUrl: args.imageUrl,
      data: args.data,
      deepLink: args.deepLink,
      targeting: args.targeting,
      schedule: args.schedule,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update push campaign
export const update = authMutation({
  args: {
    id: v.id("pushCampaigns"),
    name: v.optional(v.string()),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    data: v.optional(pushDataValidator),
    deepLink: v.optional(v.string()),
    targeting: v.optional(audienceRulesOrSegmentValidator),
    schedule: v.optional(
      v.object({
        type: v.union(v.literal("immediate"), v.literal("scheduled")),
        scheduledAt: v.optional(v.number()),
        timezone: v.optional(v.string()),
      })
    ),
  },
  permission: "settings.workspace",
  allowMissingWorkspace: true,
  resolveWorkspaceId: async (ctx, args) => {
    const campaign = await ctx.db.get(args.id);
    return campaign?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = (await ctx.db.get(id)) as Doc<"pushCampaigns"> | null;
    if (!existing) throw new Error("Campaign not found");
    if (existing.status === "sent") throw new Error("Cannot update sent campaign");
    assertValidTargeting(args.targeting);

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return id;
  },
});

// Task 3.3: Send push notifications
export const send = authMutation({
  args: {
    id: v.id("pushCampaigns"),
  },
  permission: "settings.workspace",
  allowMissingWorkspace: true,
  resolveWorkspaceId: async (ctx, args) => {
    const campaign = await ctx.db.get(args.id);
    return campaign?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const campaign = (await ctx.db.get(args.id)) as Doc<"pushCampaigns"> | null;
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.status === "sent") throw new Error("Campaign already sent");

    return await enqueueCampaignRecipients(ctx, args.id, campaign);
  },
});

export const sendForTesting = internalMutation({
  args: { id: v.id("pushCampaigns") },
  handler: async (ctx, args) => {
    const campaign = (await ctx.db.get(args.id)) as Doc<"pushCampaigns"> | null;
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.status === "sent") throw new Error("Campaign already sent");

    return await enqueueCampaignRecipients(ctx, args.id, campaign);
  },
});

// Task 3.4: Integrate with Expo Push Notification service
export const sendToExpo = internalAction({
  args: {
    campaignId: v.id("pushCampaigns"),
  },
  handler: async (ctx, args) => {
    const campaign = await ctx.runQuery(internal.pushCampaigns.getInternal, {
      id: args.campaignId,
    });
    if (!campaign) throw new Error("Campaign not found");

    const recipients = await ctx.runQuery(internal.pushCampaigns.getPendingRecipients, {
      campaignId: args.campaignId,
    });

    if (recipients.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const dispatch = await ctx.runAction(internal.notifications.dispatchPushAttempts, {
      workspaceId: campaign.workspaceId,
      eventKey: `push_campaign:${args.campaignId}`,
      title: campaign.title,
      body: campaign.body,
      data: {
        ...((campaign.data as Record<string, unknown>) || {}),
        campaignId: args.campaignId,
        ...(campaign.deepLink ? { deepLink: campaign.deepLink } : {}),
        ...(campaign.imageUrl ? { imageUrl: campaign.imageUrl } : {}),
      },
      attempts: recipients.map((recipient: PendingRecipientWithToken) => ({
        dedupeKey: `push_campaign:${args.campaignId}:${recipient._id}:push`,
        recipientType: recipient.recipientType,
        userId: recipient.userId,
        visitorId: recipient.visitorId,
        tokens: [recipient.token],
      })),
    });
    const results = dispatch.results ?? [];
    let sent = 0;
    let failed = 0;

    // Update recipient statuses based on response
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      const result = results[i];

      if (result?.status === "delivered") {
        await ctx.runMutation(internal.pushCampaigns.updateRecipientStatus, {
          recipientId: recipient._id,
          status: "sent",
        });
        sent++;
        continue;
      }

      const { errorMessage } = getTicketErrorDetails({
        error: result?.error,
        message: result?.reason,
      });
      await ctx.runMutation(internal.pushCampaigns.updateRecipientStatus, {
        recipientId: recipient._id,
        status: "failed",
        error: errorMessage,
      });
      failed++;
    }

    // Update campaign stats
    await ctx.runMutation(internal.pushCampaigns.updateStats, {
      campaignId: args.campaignId,
      sent,
      failed,
    });

    return { sent, failed };
  },
});

type PendingRecipientWithToken = Doc<"pushCampaignRecipients"> & {
  recipientType: "agent" | "visitor";
  token: string;
};

// Get pending recipients with tokens
export const getPendingRecipients = internalQuery({
  args: {
    campaignId: v.id("pushCampaigns"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, DEFAULT_RECIPIENT_BATCH_LIMIT, MAX_RECIPIENT_BATCH_LIMIT);
    const recipients = await ctx.db
      .query("pushCampaignRecipients")
      .withIndex("by_campaign_status", (q) =>
        q.eq("campaignId", args.campaignId).eq("status", "pending")
      )
      .order("desc")
      .take(limit);

    const resolvedRecipients = await Promise.all(
      recipients.map(async (recipient): Promise<PendingRecipientWithToken | null> => {
        const recipientType =
          recipient.recipientType ?? (recipient.visitorId ? "visitor" : "agent");
        if (recipientType === "visitor") {
          const token = await ctx.db.get(recipient.tokenId as Id<"visitorPushTokens">);
          if (!token || token.notificationsEnabled === false) {
            return null;
          }
          return {
            ...recipient,
            recipientType,
            token: token.token,
          };
        }

        const token = await ctx.db.get(recipient.tokenId as Id<"pushTokens">);
        if (!token || token.notificationsEnabled === false) {
          return null;
        }

        return {
          ...recipient,
          recipientType,
          token: token.token,
        };
      })
    );

    return resolvedRecipients.filter(
      (recipient): recipient is PendingRecipientWithToken => !!recipient
    );
  },
});

// List push campaigns
export const list = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("scheduled"),
        v.literal("sending"),
        v.literal("sent"),
        v.literal("paused")
      )
    ),
    limit: v.optional(v.number()),
  },
  permission: "settings.workspace",
  handler: async (ctx, args) => {
    const limit = clampLimit(args.limit, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    let campaigns;

    if (args.status) {
      campaigns = await ctx.db
        .query("pushCampaigns")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", args.status!)
        )
        .order("desc")
        .take(limit);
    } else {
      campaigns = await ctx.db
        .query("pushCampaigns")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .order("desc")
        .take(limit);
    }

    return campaigns.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get single campaign
export const get = authQuery({
  args: { id: v.id("pushCampaigns") },
  permission: "settings.workspace",
  allowMissingWorkspace: true,
  resolveWorkspaceId: async (ctx, args) => {
    const campaign = await ctx.db.get(args.id);
    return campaign?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const campaign = (await ctx.db.get(args.id)) as Doc<"pushCampaigns"> | null;
    if (!campaign) {
      return null;
    }
    return campaign;
  },
});

export const getInternal = internalQuery({
  args: { id: v.id("pushCampaigns") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Update recipient status
export const updateRecipientStatus = internalMutation({
  args: {
    recipientId: v.id("pushCampaignRecipients"),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("opened"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const updates: Record<string, unknown> = { status: args.status };

    if (args.status === "sent") updates.sentAt = now;
    if (args.status === "delivered") updates.deliveredAt = now;
    if (args.status === "opened") updates.openedAt = now;
    if (args.error) updates.error = args.error;

    await ctx.db.patch(args.recipientId, updates);
  },
});

// Update campaign stats
export const updateStats = internalMutation({
  args: {
    campaignId: v.id("pushCampaigns"),
    sent: v.number(),
    failed: v.number(),
  },
  handler: async (ctx, args) => {
    const campaign = (await ctx.db.get(args.campaignId)) as Doc<"pushCampaigns"> | null;
    if (!campaign) return;

    const currentStats = campaign.stats || { sent: 0, delivered: 0, opened: 0, failed: 0 };

    await ctx.db.patch(args.campaignId, {
      stats: {
        ...currentStats,
        sent: currentStats.sent + args.sent,
        failed: currentStats.failed + args.failed,
      },
      status: "sent",
      sentAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Task 3.7: Track push delivery
export const trackDelivery = internalMutation({
  args: {
    campaignId: v.id("pushCampaigns"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const recipient = await ctx.db
      .query("pushCampaignRecipients")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (recipient && recipient.status === "sent") {
      await ctx.db.patch(recipient._id, {
        status: "delivered",
        deliveredAt: Date.now(),
      });

      const campaign = (await ctx.db.get(args.campaignId)) as Doc<"pushCampaigns"> | null;
      if (campaign?.stats) {
        await ctx.db.patch(args.campaignId, {
          stats: {
            ...campaign.stats,
            delivered: campaign.stats.delivered + 1,
          },
        });
      }
    }
  },
});

// Track push open
export const trackOpen = internalMutation({
  args: {
    campaignId: v.id("pushCampaigns"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const recipient = await ctx.db
      .query("pushCampaignRecipients")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (recipient && !recipient.openedAt) {
      await ctx.db.patch(recipient._id, {
        status: "opened",
        openedAt: Date.now(),
      });

      const campaign = (await ctx.db.get(args.campaignId)) as Doc<"pushCampaigns"> | null;
      if (campaign?.stats) {
        await ctx.db.patch(args.campaignId, {
          stats: {
            ...campaign.stats,
            opened: campaign.stats.opened + 1,
          },
        });
      }
    }
  },
});

// Delete campaign
export const remove = authMutation({
  args: { id: v.id("pushCampaigns") },
  permission: "settings.workspace",
  allowMissingWorkspace: true,
  resolveWorkspaceId: async (ctx, args) => {
    const campaign = await ctx.db.get(args.id);
    return campaign?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const campaign = (await ctx.db.get(args.id)) as Doc<"pushCampaigns"> | null;
    if (!campaign) throw new Error("Campaign not found");

    // Delete associated recipients
    const recipients = await ctx.db
      .query("pushCampaignRecipients")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.id))
      .collect();

    for (const recipient of recipients) {
      await ctx.db.delete(recipient._id);
    }

    await ctx.db.delete(args.id);
  },
});

// Pause campaign
export const pause = authMutation({
  args: { id: v.id("pushCampaigns") },
  permission: "settings.workspace",
  allowMissingWorkspace: true,
  resolveWorkspaceId: async (ctx, args) => {
    const campaign = await ctx.db.get(args.id);
    return campaign?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const campaign = (await ctx.db.get(args.id)) as Doc<"pushCampaigns"> | null;
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.status === "sent") throw new Error("Cannot pause sent campaign");

    await ctx.db.patch(args.id, { status: "paused", updatedAt: Date.now() });
  },
});

// Get campaign stats
export const getStats = authQuery({
  args: {
    id: v.id("pushCampaigns"),
    sampleLimit: v.optional(v.number()),
  },
  permission: "settings.workspace",
  allowMissingWorkspace: true,
  resolveWorkspaceId: async (ctx, args) => {
    const campaign = await ctx.db.get(args.id);
    return campaign?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const campaign = (await ctx.db.get(args.id)) as Doc<"pushCampaigns"> | null;
    if (!campaign) throw new Error("Campaign not found");

    const sampleLimit = clampLimit(
      args.sampleLimit,
      DEFAULT_STATS_SAMPLE_LIMIT,
      MAX_STATS_SAMPLE_LIMIT
    );
    const recipients = await ctx.db
      .query("pushCampaignRecipients")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.id))
      .order("desc")
      .take(sampleLimit);
    const truncated = recipients.length >= sampleLimit;

    const stats = {
      total: recipients.length,
      pending: recipients.filter((r) => r.status === "pending").length,
      sent: recipients.filter((r) => r.status === "sent").length,
      delivered: recipients.filter((r) => r.status === "delivered").length,
      opened: recipients.filter((r) => r.status === "opened").length,
      failed: recipients.filter((r) => r.status === "failed").length,
    };

    return {
      ...stats,
      deliveryRate: stats.sent > 0 ? (stats.delivered / stats.sent) * 100 : 0,
      openRate: stats.delivered > 0 ? (stats.opened / stats.delivered) * 100 : 0,
      truncated,
    };
  },
});
