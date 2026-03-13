import { defineTable } from "convex/server";
import { v } from "convex/values";
import { audienceRulesOrSegmentValidator } from "../validators";

export const campaignEmailTables = {
  emailCampaigns: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    subject: v.string(),
    previewText: v.optional(v.string()),
    content: v.string(),
    templateId: v.optional(v.id("emailTemplates")),
    senderId: v.optional(v.id("users")),
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
        pending: v.number(),
        sent: v.number(),
        delivered: v.number(),
        opened: v.number(),
        clicked: v.number(),
        bounced: v.number(),
        unsubscribed: v.number(),
      })
    ),
    recipientCount: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_status", ["workspaceId", "status"]),

  emailTemplates: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    subject: v.optional(v.string()),
    html: v.string(),
    variables: v.optional(v.array(v.string())),
    category: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  emailCampaignRecipients: defineTable({
    campaignId: v.id("emailCampaigns"),
    visitorId: v.id("visitors"),
    email: v.string(),
    trackingToken: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("opened"),
      v.literal("clicked"),
      v.literal("bounced"),
      v.literal("unsubscribed")
    ),
    sentAt: v.optional(v.number()),
    openedAt: v.optional(v.number()),
    clickedAt: v.optional(v.number()),
    trackingEventCount: v.optional(v.number()),
    lastTrackingEventAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_visitor", ["visitorId"])
    .index("by_campaign_status", ["campaignId", "status"])
    .index("by_tracking_token", ["trackingToken"]),
};
