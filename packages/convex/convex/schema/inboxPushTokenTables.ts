import { defineTable } from "convex/server";
import { v } from "convex/values";

export const inboxPushTokenTables = {
  pushTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    platform: v.union(v.literal("ios"), v.literal("android")),
    notificationsEnabled: v.optional(v.boolean()),
    failureCount: v.optional(v.number()),
    lastFailureAt: v.optional(v.number()),
    lastFailureReason: v.optional(v.string()),
    disabledAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_token", ["token"]),

  visitorPushTokens: defineTable({
    visitorId: v.id("visitors"),
    workspaceId: v.id("workspaces"),
    token: v.string(),
    platform: v.union(v.literal("ios"), v.literal("android")),
    deviceId: v.optional(v.string()),
    notificationsEnabled: v.optional(v.boolean()),
    failureCount: v.optional(v.number()),
    lastFailureAt: v.optional(v.number()),
    lastFailureReason: v.optional(v.string()),
    disabledAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_visitor", ["visitorId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_updated_at", ["workspaceId", "updatedAt"])
    .index("by_token", ["token"]),
};
