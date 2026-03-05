import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
  audienceRulesOrSegmentValidator,
  jsonObjectValidator,
  pushDataValidator,
  seriesRulesValidator,
} from "../validators";

export const campaignTables = {
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

  // Email Templates
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

  // Email Campaign Recipients (tracking per-recipient status)
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

  // Push Notification Campaigns
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

  // Push Campaign Recipients
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

  // Mobile Carousels
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

  // Carousel Impressions
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

  // Series (Campaign Orchestration)
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

  // Series Blocks
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
      // Rule block
      rules: v.optional(seriesRulesValidator),
      // Wait block
      waitType: v.optional(
        v.union(v.literal("duration"), v.literal("until_date"), v.literal("until_event"))
      ),
      waitDuration: v.optional(v.number()),
      waitUnit: v.optional(v.union(v.literal("minutes"), v.literal("hours"), v.literal("days"))),
      waitUntilDate: v.optional(v.number()),
      waitUntilEvent: v.optional(v.string()),
      // Content blocks (email, push, chat, post)
      contentId: v.optional(v.string()),
      subject: v.optional(v.string()),
      body: v.optional(v.string()),
      title: v.optional(v.string()),
      // Tag block
      tagAction: v.optional(v.union(v.literal("add"), v.literal("remove"))),
      tagName: v.optional(v.string()),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_series", ["seriesId"]),

  // Series Block Connections
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

  // User Series Progress
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

  // Series Progress History (track block executions)
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

  // Series block-level telemetry for execution diagnostics
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

  // Surveys
  surveys: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    format: v.union(v.literal("small"), v.literal("large")),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived")
    ),
    questions: v.array(
      v.object({
        id: v.string(),
        type: v.union(
          v.literal("nps"),
          v.literal("numeric_scale"),
          v.literal("star_rating"),
          v.literal("emoji_rating"),
          v.literal("dropdown"),
          v.literal("short_text"),
          v.literal("long_text"),
          v.literal("multiple_choice")
        ),
        title: v.string(),
        description: v.optional(v.string()),
        required: v.boolean(),
        storeAsAttribute: v.optional(v.string()),
        options: v.optional(
          v.object({
            // NPS - no additional options needed (always 0-10)
            // Numeric Scale
            scaleStart: v.optional(v.number()),
            scaleEnd: v.optional(v.number()),
            startLabel: v.optional(v.string()),
            endLabel: v.optional(v.string()),
            // Star Rating
            starLabels: v.optional(
              v.object({
                low: v.optional(v.string()),
                high: v.optional(v.string()),
              })
            ),
            // Emoji Rating
            emojiCount: v.optional(v.union(v.literal(3), v.literal(5))),
            emojiLabels: v.optional(
              v.object({
                low: v.optional(v.string()),
                high: v.optional(v.string()),
              })
            ),
            // Dropdown / Multiple Choice
            choices: v.optional(v.array(v.string())),
            allowMultiple: v.optional(v.boolean()),
          })
        ),
      })
    ),
    // Intro step (large format only)
    introStep: v.optional(
      v.object({
        title: v.string(),
        description: v.optional(v.string()),
        buttonText: v.optional(v.string()),
      })
    ),
    // Thank you step
    thankYouStep: v.optional(
      v.object({
        title: v.string(),
        description: v.optional(v.string()),
        buttonText: v.optional(v.string()),
      })
    ),
    // Display options
    showProgressBar: v.optional(v.boolean()),
    showDismissButton: v.optional(v.boolean()),
    // Targeting
    audienceRules: v.optional(audienceRulesOrSegmentValidator),
    // Triggers
    triggers: v.optional(
      v.object({
        type: v.union(
          v.literal("immediate"),
          v.literal("page_visit"),
          v.literal("time_on_page"),
          v.literal("event")
        ),
        pageUrl: v.optional(v.string()),
        pageUrlMatch: v.optional(
          v.union(v.literal("exact"), v.literal("contains"), v.literal("regex"))
        ),
        delaySeconds: v.optional(v.number()),
        eventName: v.optional(v.string()),
      })
    ),
    // Frequency
    frequency: v.optional(v.union(v.literal("once"), v.literal("until_completed"))),
    // Scheduling
    scheduling: v.optional(
      v.object({
        startDate: v.optional(v.number()),
        endDate: v.optional(v.number()),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_status", ["workspaceId", "status"]),

  // Survey Responses
  surveyResponses: defineTable({
    surveyId: v.id("surveys"),
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    userId: v.optional(v.id("users")),
    sessionId: v.optional(v.string()),
    answers: v.array(
      v.object({
        questionId: v.string(),
        value: v.union(
          v.string(),
          v.number(),
          v.boolean(),
          v.null(),
          v.array(v.string()),
          v.array(v.number())
        ),
      })
    ),
    status: v.union(v.literal("partial"), v.literal("completed")),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_survey", ["surveyId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_visitor", ["visitorId"])
    .index("by_visitor_survey", ["visitorId", "surveyId"]),

  // Survey Impressions (for analytics)
  surveyImpressions: defineTable({
    surveyId: v.id("surveys"),
    visitorId: v.id("visitors"),
    sessionId: v.optional(v.string()),
    action: v.union(
      v.literal("shown"),
      v.literal("started"),
      v.literal("completed"),
      v.literal("dismissed")
    ),
    createdAt: v.number(),
  })
    .index("by_survey", ["surveyId"])
    .index("by_visitor", ["visitorId"])
    .index("by_visitor_survey", ["visitorId", "surveyId"]),
};
