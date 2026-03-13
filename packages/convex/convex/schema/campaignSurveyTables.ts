import { defineTable } from "convex/server";
import { v } from "convex/values";
import { audienceRulesOrSegmentValidator } from "../validators";

export const campaignSurveyTables = {
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
            scaleStart: v.optional(v.number()),
            scaleEnd: v.optional(v.number()),
            startLabel: v.optional(v.string()),
            endLabel: v.optional(v.string()),
            starLabels: v.optional(
              v.object({
                low: v.optional(v.string()),
                high: v.optional(v.string()),
              })
            ),
            emojiCount: v.optional(v.union(v.literal(3), v.literal(5))),
            emojiLabels: v.optional(
              v.object({
                low: v.optional(v.string()),
                high: v.optional(v.string()),
              })
            ),
            choices: v.optional(v.array(v.string())),
            allowMultiple: v.optional(v.boolean()),
          })
        ),
      })
    ),
    introStep: v.optional(
      v.object({
        title: v.string(),
        description: v.optional(v.string()),
        buttonText: v.optional(v.string()),
      })
    ),
    thankYouStep: v.optional(
      v.object({
        title: v.string(),
        description: v.optional(v.string()),
        buttonText: v.optional(v.string()),
      })
    ),
    showProgressBar: v.optional(v.boolean()),
    showDismissButton: v.optional(v.boolean()),
    audienceRules: v.optional(audienceRulesOrSegmentValidator),
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
    frequency: v.optional(v.union(v.literal("once"), v.literal("until_completed"))),
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
