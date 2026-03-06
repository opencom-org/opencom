import { defineTable } from "convex/server";
import { v } from "convex/values";
import { audienceRulesOrSegmentValidator } from "../validators";

export const campaignCarouselTables = {
  carousels: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    screens: v.array(
      v.object({
        id: v.string(),
        title: v.optional(v.string()),
        body: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
        buttons: v.optional(
          v.array(
            v.object({
              text: v.string(),
              action: v.union(
                v.literal("url"),
                v.literal("dismiss"),
                v.literal("next"),
                v.literal("deeplink")
              ),
              url: v.optional(v.string()),
              deepLink: v.optional(v.string()),
            })
          )
        ),
      })
    ),
    audienceRules: v.optional(audienceRulesOrSegmentValidator),
    targeting: v.optional(audienceRulesOrSegmentValidator),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived")
    ),
    priority: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_status", ["workspaceId", "status"]),

  carouselImpressions: defineTable({
    carouselId: v.id("carousels"),
    visitorId: v.id("visitors"),
    action: v.union(v.literal("shown"), v.literal("completed"), v.literal("dismissed")),
    screenIndex: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_carousel", ["carouselId"])
    .index("by_visitor", ["visitorId"])
    .index("by_visitor_carousel", ["visitorId", "carouselId"]),
};
