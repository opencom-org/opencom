import { v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { evaluateRuleWithSegmentSupport, validateAudienceRule } from "./audienceRules";
import { authMutation, authQuery } from "./lib/authWrappers";
import { audienceRulesOrSegmentValidator } from "./validators";

const TRACKING_TOKEN_PATTERN = /^ect_[a-f0-9]{48}$/;
const TRACKING_EVENT_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const TRACKING_EVENT_MIN_INTERVAL_MS = 500;
const MAX_TRACKING_EVENTS_PER_RECIPIENT = 12;
const TRACKED_URL_MAX_LENGTH = 2048;
const MAX_CAMPAIGN_VISITOR_SCAN = 5000;
const RECIPIENT_DELETE_BATCH_SIZE = 500;
const LIST_DEFAULT_LIMIT = 50;
const LIST_MAX_LIMIT = 200;
const DEMO_BLOCKED_EMAIL_CAMPAIGN_WORKSPACES_ENV =
  "OPENCOM_DEMO_BLOCKED_EMAIL_CAMPAIGN_WORKSPACE_IDS";
const EMAIL_CAMPAIGN_SEND_POLICY_ERROR_CODE = "EMAIL_CAMPAIGN_SEND_BLOCKED_BY_POLICY";

const DEFAULT_CAMPAIGN_STATS = {
  pending: 0,
  sent: 0,
  delivered: 0,
  opened: 0,
  clicked: 0,
  bounced: 0,
  unsubscribed: 0,
};

type CampaignStats = typeof DEFAULT_CAMPAIGN_STATS;

function buildCampaignStats(recipientCount: number): CampaignStats {
  return {
    ...DEFAULT_CAMPAIGN_STATS,
    pending: Math.max(0, recipientCount),
  };
}

function getDemoBlockedEmailCampaignWorkspaceIds(): Set<string> {
  return new Set(
    (process.env[DEMO_BLOCKED_EMAIL_CAMPAIGN_WORKSPACES_ENV] ?? "")
      .split(",")
      .map((workspaceId: string) => workspaceId.trim())
      .filter((workspaceId: string) => workspaceId.length > 0)
  );
}

function isEmailCampaignSendBlockedForWorkspace(workspaceId: Id<"workspaces">): boolean {
  return getDemoBlockedEmailCampaignWorkspaceIds().has(String(workspaceId));
}

function buildEmailCampaignSendPolicyError(workspaceId: Id<"workspaces">): Error {
  return new Error(
    `${EMAIL_CAMPAIGN_SEND_POLICY_ERROR_CODE}: outbound email campaign sending is disabled for workspace ${workspaceId} in this deployment policy.`
  );
}

function normalizeCampaignStats(
  stats: Doc<"emailCampaigns">["stats"],
  recipientCount?: number
): CampaignStats {
  if (!stats) {
    return buildCampaignStats(recipientCount ?? 0);
  }
  return {
    pending: stats.pending ?? 0,
    sent: stats.sent ?? 0,
    delivered: stats.delivered ?? 0,
    opened: stats.opened ?? 0,
    clicked: stats.clicked ?? 0,
    bounced: stats.bounced ?? 0,
    unsubscribed: stats.unsubscribed ?? 0,
  };
}

function validateTrackingToken(token: string): void {
  if (!TRACKING_TOKEN_PATTERN.test(token)) {
    throw new Error("Invalid tracking token");
  }
}

function validateTrackedUrl(url: string): void {
  if (url.length > TRACKED_URL_MAX_LENGTH) {
    throw new Error("Tracked URL exceeds max length");
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid tracked URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid tracked URL protocol");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Tracked URL must not include credentials");
  }
}

function isTrackingEventExpired(recipient: Doc<"emailCampaignRecipients">): boolean {
  return Date.now() - recipient.createdAt > TRACKING_EVENT_MAX_AGE_MS;
}

function isTrackingEventAbusive(recipient: Doc<"emailCampaignRecipients">): boolean {
  const trackedRecipient = recipient as Doc<"emailCampaignRecipients"> & {
    trackingEventCount?: number;
    lastTrackingEventAt?: number;
  };

  if ((trackedRecipient.trackingEventCount ?? 0) >= MAX_TRACKING_EVENTS_PER_RECIPIENT) {
    return true;
  }

  if (
    trackedRecipient.lastTrackingEventAt &&
    Date.now() - trackedRecipient.lastTrackingEventAt < TRACKING_EVENT_MIN_INTERVAL_MS
  ) {
    return true;
  }

  return false;
}

async function applyTrackingStatsUpdate(
  ctx: MutationCtx,
  recipient: Doc<"emailCampaignRecipients">,
  status: Doc<"emailCampaignRecipients">["status"],
  increment: keyof Pick<CampaignStats, "opened" | "clicked" | "bounced" | "unsubscribed">,
  patch: Partial<Doc<"emailCampaignRecipients">>
): Promise<void> {
  const campaign = (await ctx.db.get(recipient.campaignId)) as Doc<"emailCampaigns"> | null;
  if (!campaign) {
    return;
  }

  if (
    campaign.status !== "sending" &&
    campaign.status !== "sent" &&
    campaign.status !== "scheduled"
  ) {
    return;
  }

  if (isTrackingEventAbusive(recipient)) {
    return;
  }

  const stats = normalizeCampaignStats(campaign.stats, campaign.recipientCount);
  if (recipient.status === "pending") {
    stats.pending = Math.max(0, stats.pending - 1);
  }
  stats[increment] += 1;

  const trackedRecipient = recipient as Doc<"emailCampaignRecipients"> & {
    trackingEventCount?: number;
  };

  await ctx.db.patch(recipient._id, {
    ...patch,
    status,
    trackingEventCount: (trackedRecipient.trackingEventCount ?? 0) + 1,
    lastTrackingEventAt: Date.now(),
  });
  await ctx.db.patch(campaign._id, {
    stats,
    updatedAt: Date.now(),
  });
}

function generateTrackingToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `ect_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

// Task 2.1: Create email campaign
export const create = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    subject: v.string(),
    previewText: v.optional(v.string()),
    content: v.string(),
    templateId: v.optional(v.id("emailTemplates")),
    senderId: v.optional(v.id("users")),
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
    const hasSegmentReference =
      typeof args.targeting === "object" &&
      args.targeting !== null &&
      "segmentId" in args.targeting;
    if (
      args.targeting !== undefined &&
      !hasSegmentReference &&
      !validateAudienceRule(args.targeting)
    ) {
      throw new Error("Invalid targeting rules");
    }

    const now = Date.now();
    return await ctx.db.insert("emailCampaigns", {
      workspaceId: args.workspaceId,
      name: args.name,
      subject: args.subject,
      previewText: args.previewText,
      content: args.content,
      templateId: args.templateId,
      senderId: args.senderId,
      targeting: args.targeting,
      schedule: args.schedule,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Task 2.2: Update email campaign
export const update = authMutation({
  args: {
    id: v.id("emailCampaigns"),
    name: v.optional(v.string()),
    subject: v.optional(v.string()),
    previewText: v.optional(v.string()),
    content: v.optional(v.string()),
    templateId: v.optional(v.id("emailTemplates")),
    senderId: v.optional(v.id("users")),
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
  resolveWorkspaceId: async (ctx, args) => {
    const existing = (await ctx.db.get(args.id)) as Doc<"emailCampaigns"> | null;
    return existing?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = (await ctx.db.get(id)) as Doc<"emailCampaigns"> | null;
    if (!existing) throw new Error("Campaign not found");
    if (existing.status === "sent") throw new Error("Cannot update sent campaign");

    const hasSegmentReference =
      typeof args.targeting === "object" &&
      args.targeting !== null &&
      "segmentId" in args.targeting;
    if (
      args.targeting !== undefined &&
      !hasSegmentReference &&
      !validateAudienceRule(args.targeting)
    ) {
      throw new Error("Invalid targeting rules");
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return id;
  },
});

// Task 2.3: Send email campaign (immediate or scheduled)
export const send = authMutation({
  args: {
    id: v.id("emailCampaigns"),
  },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const campaign = (await ctx.db.get(args.id)) as Doc<"emailCampaigns"> | null;
    return campaign?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const campaign = (await ctx.db.get(args.id)) as Doc<"emailCampaigns"> | null;
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.status === "sent") throw new Error("Campaign already sent");

    if (isEmailCampaignSendBlockedForWorkspace(campaign.workspaceId)) {
      throw buildEmailCampaignSendPolicyError(campaign.workspaceId);
    }

    const now = Date.now();

    // Get eligible recipients based on targeting
    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", campaign.workspaceId))
      .take(MAX_CAMPAIGN_VISITOR_SCAN + 1);

    if (visitors.length > MAX_CAMPAIGN_VISITOR_SCAN) {
      throw new Error(
        `Campaign audience exceeds safe scan limit (${MAX_CAMPAIGN_VISITOR_SCAN}). Narrow targeting before sending.`
      );
    }

    const eligibleVisitors: Doc<"visitors">[] = [];
    for (const visitor of visitors) {
      // Skip visitors without email
      if (!visitor.email) continue;

      // Check targeting rules (audienceRules with targeting fallback)
      const audienceRules = campaign.audienceRules ?? campaign.targeting;
      if (audienceRules) {
        const matches = await evaluateRuleWithSegmentSupport(ctx, audienceRules, visitor);
        if (!matches) continue;
      }

      eligibleVisitors.push(visitor);
    }

    // Create recipient records
    for (const visitor of eligibleVisitors) {
      await ctx.db.insert("emailCampaignRecipients", {
        campaignId: args.id,
        visitorId: visitor._id,
        email: visitor.email!,
        trackingToken: generateTrackingToken(),
        status: "pending",
        createdAt: now,
      });
    }

    // Update campaign status
    const isScheduled = campaign.schedule?.type === "scheduled" && campaign.schedule.scheduledAt;
    await ctx.db.patch(args.id, {
      status: isScheduled ? "scheduled" : "sending",
      recipientCount: eligibleVisitors.length,
      stats: buildCampaignStats(eligibleVisitors.length),
      updatedAt: now,
    });

    return { recipientCount: eligibleVisitors.length };
  },
});

// Task 2.4: List email campaigns
export const list = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    limit: v.optional(v.number()),
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
  permission: "settings.workspace",
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT));
    let campaigns;

    if (args.status) {
      campaigns = await ctx.db
        .query("emailCampaigns")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", args.status!)
        )
        .order("desc")
        .take(limit);
    } else {
      campaigns = await ctx.db
        .query("emailCampaigns")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .order("desc")
        .take(limit);
    }

    return campaigns;
  },
});

// Get single campaign
export const get = authQuery({
  args: { id: v.id("emailCampaigns") },
  permission: "settings.workspace",
  allowMissingWorkspace: true,
  resolveWorkspaceId: async (ctx, args) => {
    const campaign = (await ctx.db.get(args.id)) as Doc<"emailCampaigns"> | null;
    return campaign?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Delete campaign
export const remove = authMutation({
  args: { id: v.id("emailCampaigns") },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const campaign = (await ctx.db.get(args.id)) as Doc<"emailCampaigns"> | null;
    return campaign?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const campaign = (await ctx.db.get(args.id)) as Doc<"emailCampaigns"> | null;
    if (!campaign) throw new Error("Campaign not found");

    // Delete associated recipients
    while (true) {
      const recipients = await ctx.db
        .query("emailCampaignRecipients")
        .withIndex("by_campaign", (q) => q.eq("campaignId", args.id))
        .take(RECIPIENT_DELETE_BATCH_SIZE);

      if (recipients.length === 0) {
        break;
      }

      for (const recipient of recipients) {
        await ctx.db.delete(recipient._id);
      }

      if (recipients.length < RECIPIENT_DELETE_BATCH_SIZE) {
        break;
      }
    }

    await ctx.db.delete(args.id);
  },
});

// Pause campaign
export const pause = authMutation({
  args: { id: v.id("emailCampaigns") },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const campaign = (await ctx.db.get(args.id)) as Doc<"emailCampaigns"> | null;
    return campaign?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const campaign = (await ctx.db.get(args.id)) as Doc<"emailCampaigns"> | null;
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.status === "sent") throw new Error("Cannot pause sent campaign");

    await ctx.db.patch(args.id, { status: "paused", updatedAt: Date.now() });
  },
});

// Resume campaign
export const resume = authMutation({
  args: { id: v.id("emailCampaigns") },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const campaign = (await ctx.db.get(args.id)) as Doc<"emailCampaigns"> | null;
    return campaign?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const campaign = (await ctx.db.get(args.id)) as Doc<"emailCampaigns"> | null;
    if (!campaign) throw new Error("Campaign not found");
    if (campaign.status !== "paused") throw new Error("Campaign is not paused");

    const isScheduled = campaign.schedule?.type === "scheduled" && campaign.schedule.scheduledAt;
    await ctx.db.patch(args.id, {
      status: isScheduled ? "scheduled" : "sending",
      updatedAt: Date.now(),
    });
  },
});

// Task 2.6: Variable substitution helper
export function substituteVariables(
  content: string,
  visitor: {
    name?: string;
    email?: string;
    customAttributes?: Record<string, unknown>;
  }
): string {
  let result = content;

  // Replace user variables
  result = result.replace(/\{\{user\.name\}\}/g, visitor.name || "");
  result = result.replace(/\{\{user\.email\}\}/g, visitor.email || "");

  // Replace custom attributes
  if (visitor.customAttributes) {
    for (const [key, value] of Object.entries(visitor.customAttributes)) {
      const regex = new RegExp(`\\{\\{user\\.${key}\\}\\}`, "g");
      result = result.replace(regex, String(value ?? ""));
    }
  }

  return result;
}

// Task 2.7: Track email open
export const trackOpen = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    validateTrackingToken(args.token);

    const recipient = await ctx.db
      .query("emailCampaignRecipients")
      .withIndex("by_tracking_token", (q) => q.eq("trackingToken", args.token))
      .first();

    if (!recipient || recipient.openedAt || isTrackingEventExpired(recipient)) {
      return;
    }

    if (recipient.status === "bounced" || recipient.status === "unsubscribed") {
      return;
    }

    await applyTrackingStatsUpdate(
      ctx,
      recipient,
      recipient.status === "clicked" ? "clicked" : "opened",
      "opened",
      { openedAt: Date.now() }
    );
  },
});

// Task 2.8: Track email click
export const trackClick = mutation({
  args: {
    token: v.string(),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    validateTrackingToken(args.token);
    validateTrackedUrl(args.url);

    const recipient = await ctx.db
      .query("emailCampaignRecipients")
      .withIndex("by_tracking_token", (q) => q.eq("trackingToken", args.token))
      .first();

    if (!recipient || recipient.clickedAt || isTrackingEventExpired(recipient)) {
      return;
    }

    if (recipient.status === "bounced" || recipient.status === "unsubscribed") {
      return;
    }

    await applyTrackingStatsUpdate(ctx, recipient, "clicked", "clicked", {
      clickedAt: Date.now(),
    });
  },
});

// Task 2.9: Handle bounce
export const handleBounce = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    validateTrackingToken(args.token);

    const recipient = await ctx.db
      .query("emailCampaignRecipients")
      .withIndex("by_tracking_token", (q) => q.eq("trackingToken", args.token))
      .first();

    if (!recipient || recipient.status === "bounced" || isTrackingEventExpired(recipient)) {
      return;
    }

    await applyTrackingStatsUpdate(ctx, recipient, "bounced", "bounced", {});
  },
});

// Handle unsubscribe
export const handleUnsubscribe = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    validateTrackingToken(args.token);

    const recipient = await ctx.db
      .query("emailCampaignRecipients")
      .withIndex("by_tracking_token", (q) => q.eq("trackingToken", args.token))
      .first();

    if (!recipient || recipient.status === "unsubscribed" || isTrackingEventExpired(recipient)) {
      return;
    }

    await applyTrackingStatsUpdate(ctx, recipient, "unsubscribed", "unsubscribed", {});
  },
});

// Get campaign stats
export const getStats = authQuery({
  args: { id: v.id("emailCampaigns") },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const campaign = (await ctx.db.get(args.id)) as Doc<"emailCampaigns"> | null;
    return campaign?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const campaign = (await ctx.db.get(args.id)) as Doc<"emailCampaigns"> | null;
    if (!campaign) throw new Error("Campaign not found");

    const stats = normalizeCampaignStats(campaign.stats, campaign.recipientCount);
    const total =
      campaign.recipientCount ??
      stats.pending +
        stats.sent +
        stats.delivered +
        stats.opened +
        stats.clicked +
        stats.bounced +
        stats.unsubscribed;

    return {
      total,
      ...stats,
      openRate: stats.sent > 0 ? (stats.opened / stats.sent) * 100 : 0,
      clickRate: stats.opened > 0 ? (stats.clicked / stats.opened) * 100 : 0,
      bounceRate: stats.sent > 0 ? (stats.bounced / stats.sent) * 100 : 0,
    };
  },
});
