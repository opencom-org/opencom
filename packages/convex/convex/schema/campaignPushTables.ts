import { defineTable } from "convex/server";
import { v } from "convex/values";
import { audienceRulesOrSegmentValidator, pushDataValidator } from "../validators";

export const campaignPushTables = {
  pushCampaigns: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    title: v.string(),
    body: v.string(),
    imageUrl: v.optional(v.string()),
    data: v.optional(pushDataValidator),
    deepLink: v.optional(v.string()),
    audienceRules: v.optional(audienceRulesOrSegmentValidator),
    targeting: v.optional(audienceRulesOrSegmentValidator),
    schedule: v.optional(
      v.object({
        type: v.union(v.literal("immediate"), v.literal("scheduled")),
        scheduledAt: v.optional(v.number()),
        timezone: v.optional(v.string()),
      })
    ),
    status: v.union(
      v.literal("draft"),
      v.literal("scheduled"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("paused")
    ),
    stats: v.optional(
      v.object({
        sent: v.number(),
        delivered: v.number(),
        opened: v.number(),
        failed: v.number(),
      })
    ),
    sentAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_status", ["workspaceId", "status"]),

  pushCampaignRecipients: defineTable({
    campaignId: v.id("pushCampaigns"),
    recipientType: v.optional(v.union(v.literal("agent"), v.literal("visitor"))),
    userId: v.optional(v.id("users")),
    visitorId: v.optional(v.id("visitors")),
    tokenId: v.union(v.id("pushTokens"), v.id("visitorPushTokens")),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("opened"),
      v.literal("failed")
    ),
    sentAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    openedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_user", ["userId"])
    .index("by_visitor", ["visitorId"])
    .index("by_campaign_status", ["campaignId", "status"]),
};
