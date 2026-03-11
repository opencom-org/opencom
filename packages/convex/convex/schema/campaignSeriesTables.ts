import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  audienceRulesOrSegmentValidator,
  jsonObjectValidator,
  seriesRulesValidator,
} from "../validators";

export const campaignSeriesTables = {
  series: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    entryTriggers: v.optional(
      v.array(
        v.object({
          source: v.union(
            v.literal("event"),
            v.literal("auto_event"),
            v.literal("visitor_attribute_changed"),
            v.literal("visitor_state_changed")
          ),
          eventName: v.optional(v.string()),
          attributeKey: v.optional(v.string()),
          fromValue: v.optional(v.string()),
          toValue: v.optional(v.string()),
        })
      )
    ),
    entryRules: v.optional(audienceRulesOrSegmentValidator),
    exitRules: v.optional(audienceRulesOrSegmentValidator),
    goalRules: v.optional(audienceRulesOrSegmentValidator),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived")
    ),
    stats: v.optional(
      v.object({
        entered: v.number(),
        active: v.optional(v.number()),
        waiting: v.optional(v.number()),
        completed: v.number(),
        exited: v.number(),
        goalReached: v.number(),
        failed: v.optional(v.number()),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_status", ["workspaceId", "status"]),

  seriesBlocks: defineTable({
    seriesId: v.id("series"),
    type: v.union(
      v.literal("rule"),
      v.literal("wait"),
      v.literal("email"),
      v.literal("push"),
      v.literal("chat"),
      v.literal("post"),
      v.literal("carousel"),
      v.literal("tag")
    ),
    position: v.object({
      x: v.number(),
      y: v.number(),
    }),
    config: v.object({
      rules: v.optional(seriesRulesValidator),
      waitType: v.optional(
        v.union(v.literal("duration"), v.literal("until_date"), v.literal("until_event"))
      ),
      waitDuration: v.optional(v.number()),
      waitUnit: v.optional(v.union(v.literal("minutes"), v.literal("hours"), v.literal("days"))),
      waitUntilDate: v.optional(v.number()),
      waitUntilEvent: v.optional(v.string()),
      contentId: v.optional(v.string()),
      subject: v.optional(v.string()),
      body: v.optional(v.string()),
      title: v.optional(v.string()),
      tagAction: v.optional(v.union(v.literal("add"), v.literal("remove"))),
      tagName: v.optional(v.string()),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_series", ["seriesId"]),

  seriesConnections: defineTable({
    seriesId: v.id("series"),
    fromBlockId: v.id("seriesBlocks"),
    toBlockId: v.id("seriesBlocks"),
    condition: v.optional(v.union(v.literal("yes"), v.literal("no"), v.literal("default"))),
    createdAt: v.number(),
  })
    .index("by_series", ["seriesId"])
    .index("by_from_block", ["fromBlockId"])
    .index("by_to_block", ["toBlockId"]),

  seriesProgress: defineTable({
    visitorId: v.id("visitors"),
    seriesId: v.id("series"),
    currentBlockId: v.optional(v.id("seriesBlocks")),
    status: v.union(
      v.literal("active"),
      v.literal("waiting"),
      v.literal("completed"),
      v.literal("exited"),
      v.literal("goal_reached"),
      v.literal("failed")
    ),
    waitUntil: v.optional(v.number()),
    waitEventName: v.optional(v.string()),
    attemptCount: v.optional(v.number()),
    lastExecutionError: v.optional(v.string()),
    lastBlockExecutedAt: v.optional(v.number()),
    idempotencyKeyContext: v.optional(v.string()),
    lastTriggerSource: v.optional(v.string()),
    lastTriggerEventName: v.optional(v.string()),
    enteredAt: v.number(),
    completedAt: v.optional(v.number()),
    exitedAt: v.optional(v.number()),
    goalReachedAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
  })
    .index("by_visitor", ["visitorId"])
    .index("by_series", ["seriesId"])
    .index("by_visitor_series", ["visitorId", "seriesId"])
    .index("by_status", ["seriesId", "status"])
    .index("by_visitor_status", ["visitorId", "status"])
    .index("by_series_wait_until", ["seriesId", "waitUntil"]),

  seriesProgressHistory: defineTable({
    progressId: v.id("seriesProgress"),
    blockId: v.id("seriesBlocks"),
    action: v.union(
      v.literal("entered"),
      v.literal("completed"),
      v.literal("skipped"),
      v.literal("failed")
    ),
    result: v.optional(jsonObjectValidator),
    createdAt: v.number(),
  })
    .index("by_progress", ["progressId"])
    .index("by_block", ["blockId"]),

  seriesBlockTelemetry: defineTable({
    seriesId: v.id("series"),
    blockId: v.id("seriesBlocks"),
    entered: v.number(),
    completed: v.number(),
    skipped: v.number(),
    failed: v.number(),
    deliveryAttempts: v.number(),
    deliveryFailures: v.number(),
    yesBranchCount: v.optional(v.number()),
    noBranchCount: v.optional(v.number()),
    defaultBranchCount: v.optional(v.number()),
    lastResult: v.optional(jsonObjectValidator),
    updatedAt: v.number(),
  })
    .index("by_series", ["seriesId"])
    .index("by_series_block", ["seriesId", "blockId"]),
};
