import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  audienceRulesOrSegmentValidator,
  audienceRulesValidator,
  eventPropertiesValidator,
  jsonObjectValidator,
  selectorQualityValidator,
  targetingRulesValidator,
  tourAdvanceModeValidator,
  tourDiagnosticReasonValidator,
} from "../validators";

export const engagementTables = {
  events: defineTable({
    workspaceId: v.id("workspaces"),
    visitorId: v.id("visitors"),
    name: v.string(),
    properties: v.optional(eventPropertiesValidator),
    timestamp: v.number(),
    url: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    eventType: v.optional(
      v.union(
        v.literal("manual"),
        v.literal("page_view"),
        v.literal("screen_view"),
        v.literal("session_start"),
        v.literal("session_end")
      )
    ),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_visitor", ["visitorId"])
    .index("by_visitor_name", ["visitorId", "name"])
    .index("by_workspace_type", ["workspaceId", "eventType"]),

  // Product Tours
  tours: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("archived")),
    targetingRules: v.optional(targetingRulesValidator),
    audienceRules: v.optional(audienceRulesOrSegmentValidator),
    displayMode: v.optional(v.union(v.literal("first_time_only"), v.literal("until_dismissed"))),
    priority: v.optional(v.number()),
    buttonColor: v.optional(v.string()),
    senderId: v.optional(v.id("users")),
    showConfetti: v.optional(v.boolean()),
    allowSnooze: v.optional(v.boolean()),
    allowRestart: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_status", ["workspaceId", "status"]),

  // Tour Steps
  tourSteps: defineTable({
    workspaceId: v.optional(v.id("workspaces")),
    tourId: v.id("tours"),
    type: v.union(v.literal("pointer"), v.literal("post"), v.literal("video")),
    order: v.number(),
    title: v.optional(v.string()),
    content: v.string(),
    elementSelector: v.optional(v.string()),
    position: v.optional(
      v.union(
        v.literal("auto"),
        v.literal("left"),
        v.literal("right"),
        v.literal("above"),
        v.literal("below")
      )
    ),
    size: v.optional(v.union(v.literal("small"), v.literal("large"))),
    advanceOn: v.optional(
      v.union(v.literal("click"), v.literal("elementClick"), v.literal("fieldFill"))
    ),
    routePath: v.optional(v.string()),
    selectorQuality: v.optional(selectorQualityValidator),
    customButtonText: v.optional(v.string()),
    mediaUrl: v.optional(v.string()),
    mediaType: v.optional(v.union(v.literal("image"), v.literal("video"))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_tour", ["tourId"])
    .index("by_tour_order", ["tourId", "order"]),

  // Tooltips
  tooltips: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    elementSelector: v.string(),
    selectorQuality: v.optional(
      v.object({
        score: v.number(),
        grade: v.union(v.literal("good"), v.literal("fair"), v.literal("poor")),
        warnings: v.array(v.string()),
        signals: v.object({
          matchCount: v.optional(v.number()),
          depth: v.number(),
          usesNth: v.boolean(),
          hasId: v.boolean(),
          hasDataAttribute: v.boolean(),
          classCount: v.number(),
          usesWildcard: v.boolean(),
        }),
      })
    ),
    content: v.string(),
    triggerType: v.union(v.literal("hover"), v.literal("click"), v.literal("auto")),
    audienceRules: v.optional(audienceRulesOrSegmentValidator),
    triggers: v.optional(
      v.object({
        type: v.union(
          v.literal("immediate"),
          v.literal("page_visit"),
          v.literal("time_on_page"),
          v.literal("scroll_depth"),
          v.literal("event"),
          v.literal("exit_intent")
        ),
        pageUrl: v.optional(v.string()),
        pageUrlMatch: v.optional(
          v.union(v.literal("exact"), v.literal("contains"), v.literal("regex"))
        ),
        delaySeconds: v.optional(v.number()),
        scrollPercent: v.optional(v.number()),
        eventName: v.optional(v.string()),
        eventProperties: v.optional(eventPropertiesValidator),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_updated_at", ["workspaceId", "updatedAt"]),

  // Saved Audience Segments
  segments: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    audienceRules: audienceRulesValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.id("users")),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_name", ["workspaceId", "name"]),

  // Tour Progress
  tourProgress: defineTable({
    visitorId: v.id("visitors"),
    tourId: v.id("tours"),
    currentStep: v.number(),
    checkpointStep: v.optional(v.number()),
    checkpointRoute: v.optional(v.string()),
    checkpointSelector: v.optional(v.string()),
    lastSeenUrl: v.optional(v.string()),
    status: v.union(
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("dismissed"),
      v.literal("snoozed")
    ),
    lastBlockedReason: v.optional(tourDiagnosticReasonValidator),
    lastBlockedMode: v.optional(tourAdvanceModeValidator),
    lastBlockedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    snoozedUntil: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_visitor", ["visitorId"])
    .index("by_tour", ["tourId"])
    .index("by_visitor_tour", ["visitorId", "tourId"]),

  // Tour Progress Diagnostics
  tourProgressDiagnostics: defineTable({
    progressId: v.id("tourProgress"),
    tourId: v.id("tours"),
    visitorId: v.id("visitors"),
    stepOrder: v.number(),
    reason: tourDiagnosticReasonValidator,
    mode: tourAdvanceModeValidator,
    selector: v.optional(v.string()),
    currentUrl: v.optional(v.string()),
    metadata: v.optional(jsonObjectValidator),
    createdAt: v.number(),
  })
    .index("by_progress", ["progressId"])
    .index("by_tour", ["tourId"])
    .index("by_visitor", ["visitorId"]),

  // Authoring Sessions (for WYSIWYG tour builder)
  authoringSessions: defineTable({
    token: v.string(),
    tourId: v.id("tours"),
    stepId: v.optional(v.id("tourSteps")),
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    targetUrl: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_tour", ["tourId"]),

  // Tooltip Authoring Sessions (for visual element picker)
  tooltipAuthoringSessions: defineTable({
    token: v.string(),
    tooltipId: v.optional(v.id("tooltips")),
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("expired")),
    selectedSelector: v.optional(v.string()),
    selectedSelectorQuality: v.optional(
      v.object({
        score: v.number(),
        grade: v.union(v.literal("good"), v.literal("fair"), v.literal("poor")),
        warnings: v.array(v.string()),
        signals: v.object({
          matchCount: v.optional(v.number()),
          depth: v.number(),
          usesNth: v.boolean(),
          hasId: v.boolean(),
          hasDataAttribute: v.boolean(),
          classCount: v.number(),
          usesWildcard: v.boolean(),
        }),
      })
    ),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_tooltip", ["tooltipId"])
    .index("by_workspace", ["workspaceId"]),

  // Knowledge Hub - Content Folders
  contentFolders: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    parentId: v.optional(v.id("contentFolders")),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_parent", ["workspaceId", "parentId"]),

  // Knowledge Hub - Internal Articles (agent-only documentation)
  internalArticles: defineTable({
    workspaceId: v.id("workspaces"),
    folderId: v.optional(v.id("contentFolders")),
    title: v.string(),
    content: v.string(),
    tags: v.optional(v.array(v.string())),
    status: v.union(v.literal("draft"), v.literal("published"), v.literal("archived")),
    createdAt: v.number(),
    updatedAt: v.number(),
    publishedAt: v.optional(v.number()),
    authorId: v.optional(v.id("users")),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_folder", ["folderId"])
    .index("by_status", ["workspaceId", "status"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["workspaceId", "status"],
    })
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["workspaceId", "status"],
    }),

  // Knowledge Hub - Recent Content Access (for tracking frequently used content)
  recentContentAccess: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    contentType: v.union(v.literal("article"), v.literal("internalArticle"), v.literal("snippet")),
    contentId: v.string(),
    accessedAt: v.number(),
  })
    .index("by_user_workspace", ["userId", "workspaceId"])
    .index("by_user_content", ["userId", "contentType", "contentId"]),

};
