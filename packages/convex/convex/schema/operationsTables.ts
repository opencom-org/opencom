import { defineTable } from "convex/server";
import { v } from "convex/values";
import { audienceRulesOrSegmentValidator, jsonObjectValidator, jsonRecordValidator } from "../validators";

export const operationsTables = {
  aiAgentSettings: defineTable({
    workspaceId: v.id("workspaces"),
    enabled: v.boolean(),
    knowledgeSources: v.array(
      v.union(v.literal("articles"), v.literal("internalArticles"), v.literal("snippets"))
    ),
    confidenceThreshold: v.number(),
    personality: v.optional(v.string()),
    handoffMessage: v.optional(v.string()),
    workingHours: v.optional(
      v.object({
        start: v.string(),
        end: v.string(),
        timezone: v.string(),
      })
    ),
    model: v.string(),
    suggestionsEnabled: v.optional(v.boolean()),
    embeddingModel: v.optional(v.string()),
    lastConfigError: v.optional(
      v.object({
        code: v.string(),
        message: v.string(),
        provider: v.optional(v.string()),
        model: v.optional(v.string()),
        detectedAt: v.number(),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  // Content Embeddings (for AI-powered suggestions via vector search)
  contentEmbeddings: defineTable({
    workspaceId: v.id("workspaces"),
    contentType: v.union(v.literal("article"), v.literal("internalArticle"), v.literal("snippet")),
    contentId: v.string(),
    embedding: v.array(v.float64()),
    textHash: v.string(),
    title: v.string(),
    snippet: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_content", ["contentType", "contentId"])
    .index("by_workspace", ["workspaceId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["workspaceId", "contentType"],
    }),

  // Suggestion Feedback (tracking used/dismissed suggestions)
  suggestionFeedback: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    contentType: v.union(v.literal("article"), v.literal("internalArticle"), v.literal("snippet")),
    contentId: v.string(),
    action: v.union(v.literal("used"), v.literal("dismissed")),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_created_at", ["workspaceId", "createdAt"])
    .index("by_user", ["userId"])
    .index("by_conversation", ["conversationId"])
    .index("by_content", ["contentType", "contentId"]),

  // Automation Settings (workspace-level toggle settings)
  automationSettings: defineTable({
    workspaceId: v.id("workspaces"),
    suggestArticlesEnabled: v.boolean(),
    showReplyTimeEnabled: v.boolean(),
    collectEmailEnabled: v.boolean(),
    askForRatingEnabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  // Assignment Rules (automatic conversation routing)
  assignmentRules: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    priority: v.number(),
    enabled: v.boolean(),
    conditions: v.array(
      v.object({
        field: v.union(
          v.literal("visitor.email"),
          v.literal("visitor.name"),
          v.literal("visitor.country"),
          v.literal("visitor.customAttributes"),
          v.literal("conversation.channel"),
          v.literal("conversation.source"),
          v.literal("message.content")
        ),
        operator: v.union(
          v.literal("equals"),
          v.literal("not_equals"),
          v.literal("contains"),
          v.literal("not_contains"),
          v.literal("starts_with"),
          v.literal("ends_with"),
          v.literal("is_set"),
          v.literal("is_not_set")
        ),
        value: v.optional(v.string()),
        attributeKey: v.optional(v.string()),
      })
    ),
    action: v.object({
      type: v.union(v.literal("assign_user"), v.literal("assign_team")),
      userId: v.optional(v.id("users")),
      teamId: v.optional(v.string()),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_priority", ["workspaceId", "priority"]),

  // Tags (workspace-level conversation tags)
  tags: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    color: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_name", ["workspaceId", "name"]),

  // Conversation Tags (junction table)
  conversationTags: defineTable({
    conversationId: v.id("conversations"),
    tagId: v.id("tags"),
    appliedBy: v.optional(v.union(v.literal("manual"), v.literal("auto"))),
    appliedByUserId: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_tag", ["tagId"])
    .index("by_conversation_tag", ["conversationId", "tagId"]),

  // Auto-Tag Rules
  autoTagRules: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    enabled: v.boolean(),
    conditions: v.array(
      v.object({
        field: v.union(
          v.literal("visitor.email"),
          v.literal("visitor.name"),
          v.literal("visitor.country"),
          v.literal("visitor.customAttributes"),
          v.literal("conversation.channel"),
          v.literal("message.content")
        ),
        operator: v.union(
          v.literal("equals"),
          v.literal("not_equals"),
          v.literal("contains"),
          v.literal("not_contains"),
          v.literal("starts_with"),
          v.literal("ends_with"),
          v.literal("is_set"),
          v.literal("is_not_set")
        ),
        value: v.optional(v.string()),
        attributeKey: v.optional(v.string()),
      })
    ),
    tagId: v.id("tags"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  // Common Issue Buttons (self-serve quick actions in widget)
  commonIssueButtons: defineTable({
    workspaceId: v.id("workspaces"),
    label: v.string(),
    action: v.union(v.literal("article"), v.literal("start_conversation")),
    articleId: v.optional(v.id("articles")),
    conversationStarter: v.optional(v.string()),
    order: v.number(),
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_order", ["workspaceId", "order"]),

  // Office Hours Configuration
  officeHours: defineTable({
    workspaceId: v.id("workspaces"),
    timezone: v.string(),
    schedule: v.array(
      v.object({
        day: v.union(
          v.literal("monday"),
          v.literal("tuesday"),
          v.literal("wednesday"),
          v.literal("thursday"),
          v.literal("friday"),
          v.literal("saturday"),
          v.literal("sunday")
        ),
        enabled: v.boolean(),
        startTime: v.string(),
        endTime: v.string(),
      })
    ),
    offlineMessage: v.optional(v.string()),
    expectedReplyTimeMinutes: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  // AI Agent Responses (tracking each AI response)
  aiResponses: defineTable({
    conversationId: v.id("conversations"),
    messageId: v.id("messages"),
    query: v.string(),
    response: v.string(),
    generatedCandidateResponse: v.optional(v.string()),
    generatedCandidateSources: v.optional(
      v.array(
        v.object({
          type: v.string(),
          id: v.string(),
          title: v.string(),
          articleId: v.optional(v.string()),
        })
      )
    ),
    generatedCandidateConfidence: v.optional(v.number()),
    sources: v.array(
      v.object({
        type: v.string(),
        id: v.string(),
        title: v.string(),
        articleId: v.optional(v.string()),
      })
    ),
    confidence: v.number(),
    feedback: v.optional(v.union(v.literal("helpful"), v.literal("not_helpful"))),
    handedOff: v.boolean(),
    handoffReason: v.optional(v.string()),
    generationTimeMs: v.number(),
    tokensUsed: v.optional(v.number()),
    model: v.string(),
    provider: v.string(),
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_message", ["messageId"])
    .index("by_feedback", ["feedback"]),

  // CSAT Responses (customer satisfaction surveys)
  csatResponses: defineTable({
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    visitorId: v.optional(v.id("visitors")),
    agentId: v.optional(v.id("users")),
    rating: v.number(),
    feedback: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_conversation", ["conversationId"])
    .index("by_agent", ["workspaceId", "agentId"])
    .index("by_created", ["workspaceId", "createdAt"]),

  // Report Snapshots (cached aggregated metrics)
  reportSnapshots: defineTable({
    workspaceId: v.id("workspaces"),
    reportType: v.union(
      v.literal("conversations"),
      v.literal("agents"),
      v.literal("csat"),
      v.literal("ai_agent")
    ),
    periodStart: v.number(),
    periodEnd: v.number(),
    granularity: v.union(v.literal("day"), v.literal("week"), v.literal("month")),
    metrics: jsonRecordValidator,
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_type", ["workspaceId", "reportType"])
    .index("by_workspace_period", ["workspaceId", "periodStart", "periodEnd"]),

  // Audit Logs (security event tracking)
  auditLogs: defineTable({
    workspaceId: v.id("workspaces"),
    actorId: v.optional(v.id("users")),
    actorType: v.union(v.literal("user"), v.literal("system"), v.literal("api")),
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    metadata: v.optional(jsonRecordValidator),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_action", ["workspaceId", "action"])
    .index("by_workspace_timestamp", ["workspaceId", "timestamp"])
    .index("by_actor", ["actorId"]),

  // Audit log write failure telemetry (fail-open visibility)
  auditLogWriteFailures: defineTable({
    workspaceId: v.id("workspaces"),
    actorId: v.optional(v.id("users")),
    actorType: v.union(v.literal("user"), v.literal("system"), v.literal("api")),
    action: v.string(),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    metadata: v.optional(jsonRecordValidator),
    error: v.string(),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_created", ["workspaceId", "createdAt"]),

  // Audit Log Settings (per-workspace retention configuration)
  auditLogSettings: defineTable({
    workspaceId: v.id("workspaces"),
    retentionDays: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  // Messenger Customization Settings
  messengerSettings: defineTable({
    workspaceId: v.id("workspaces"),

    // Branding
    logo: v.optional(v.string()),
    logoStorageId: v.optional(v.id("_storage")),
    primaryColor: v.string(),
    backgroundColor: v.string(),

    // Theme
    themeMode: v.union(v.literal("light"), v.literal("dark"), v.literal("system")),

    // Launcher
    launcherPosition: v.union(v.literal("right"), v.literal("left")),
    launcherSideSpacing: v.number(),
    launcherBottomSpacing: v.number(),
    launcherIconUrl: v.optional(v.string()),
    showLauncher: v.boolean(),
    launcherAudienceRules: v.optional(audienceRulesOrSegmentValidator),

    // Content
    welcomeMessage: v.string(),
    teamIntroduction: v.optional(v.string()),
    showTeammateAvatars: v.boolean(),

    // General
    supportedLanguages: v.array(v.string()),
    defaultLanguage: v.string(),
    privacyPolicyUrl: v.optional(v.string()),

    // Mobile-specific
    mobileEnabled: v.boolean(),

    // Home Page Configuration
    homeConfig: v.optional(
      v.object({
        enabled: v.boolean(),
        cards: v.array(
          v.object({
            id: v.string(),
            type: v.union(
              v.literal("welcome"),
              v.literal("search"),
              v.literal("conversations"),
              v.literal("startConversation"),
              v.literal("featuredArticles"),
              v.literal("announcements")
            ),
            config: v.optional(jsonObjectValidator),
            visibleTo: v.union(v.literal("all"), v.literal("visitors"), v.literal("users")),
          })
        ),
        defaultSpace: v.union(v.literal("home"), v.literal("messages"), v.literal("help")),
        launchDirectlyToConversation: v.optional(v.boolean()),
        tabs: v.optional(
          v.array(
            v.object({
              id: v.union(
                v.literal("home"),
                v.literal("messages"),
                v.literal("help"),
                v.literal("tours"),
                v.literal("tasks"),
                v.literal("tickets")
              ),
              enabled: v.boolean(),
              visibleTo: v.union(v.literal("all"), v.literal("visitors"), v.literal("users")),
            })
          )
        ),
      })
    ),

    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),
};
