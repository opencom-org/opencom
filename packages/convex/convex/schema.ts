import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  audienceRulesOrSegmentValidator,
  audienceRulesValidator,
  customAttributesValidator,
  eventPropertiesValidator,
  formDataValidator,
  jsonObjectValidator,
  jsonRecordValidator,
  jsonValueValidator,
  pushDataValidator,
  selectorQualityValidator,
  seriesRulesValidator,
  targetingRulesValidator,
  tourAdvanceModeValidator,
  tourDiagnosticReasonValidator,
} from "./validators";

const messageNotificationChannelPreferenceValidator = v.object({
  email: v.optional(v.boolean()),
  push: v.optional(v.boolean()),
});

const messageNotificationEventsValidator = v.object({
  newVisitorMessage: v.optional(messageNotificationChannelPreferenceValidator),
});

export default defineSchema({
  // Convex Auth tables - provides secure session and account management
  ...authTables,

  // Override users table from authTables with our custom fields
  users: defineTable({
    // Standard Convex Auth fields
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Our custom fields for workspace integration
    avatarUrl: v.optional(v.string()),
    workspaceId: v.optional(v.id("workspaces")),
    role: v.optional(v.union(v.literal("admin"), v.literal("agent"))),
    createdAt: v.optional(v.number()),
    // Compatibility field for older records; new code should not write this value.
    passwordHash: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_workspace", ["workspaceId"]),

  workspaces: defineTable({
    name: v.string(),
    createdAt: v.number(),
    allowedOrigins: v.optional(v.array(v.string())),
    helpCenterAccessPolicy: v.optional(v.union(v.literal("public"), v.literal("restricted"))),
    signupMode: v.optional(v.union(v.literal("invite-only"), v.literal("domain-allowlist"))),
    allowedDomains: v.optional(v.array(v.string())),
    authMethods: v.optional(v.array(v.union(v.literal("password"), v.literal("otp")))),
    hostedOnboardingStatus: v.optional(
      v.union(v.literal("not_started"), v.literal("in_progress"), v.literal("completed"))
    ),
    hostedOnboardingCurrentStep: v.optional(v.number()),
    hostedOnboardingCompletedSteps: v.optional(v.array(v.string())),
    hostedOnboardingVerificationToken: v.optional(v.string()),
    hostedOnboardingVerificationTokenIssuedAt: v.optional(v.number()),
    hostedOnboardingWidgetVerifiedAt: v.optional(v.number()),
    hostedOnboardingVerificationEvents: v.optional(
      v.array(
        v.object({
          token: v.string(),
          origin: v.optional(v.string()),
          currentUrl: v.optional(v.string()),
          createdAt: v.number(),
        })
      )
    ),
    hostedOnboardingUpdatedAt: v.optional(v.number()),
    // Identity Verification (HMAC) fields
    identitySecret: v.optional(v.string()),
    identityVerificationEnabled: v.optional(v.boolean()),
    identityVerificationMode: v.optional(v.union(v.literal("optional"), v.literal("required"))),
    // Signed widget sessions (always on — sessionLifetimeMs configures per-workspace lifetime)
    sessionLifetimeMs: v.optional(v.number()),
  })
    .index("by_name", ["name"])
    .index("by_created_at", ["createdAt"]),

  workspaceMembers: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("agent"), v.literal("viewer")),
    permissions: v.optional(v.array(v.string())),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_user_workspace", ["userId", "workspaceId"]),

  workspaceInvitations: defineTable({
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("agent"), v.literal("viewer")),
    invitedBy: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("declined")),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_email", ["email"])
    .index("by_email_workspace", ["email", "workspaceId"]),

  // OTP codes for password reset (kept for backward compatibility)
  otpCodes: defineTable({
    email: v.string(),
    code: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    used: v.boolean(),
  })
    .index("by_code", ["code"])
    .index("by_email", ["email"]),

  visitors: defineTable({
    sessionId: v.string(),
    userId: v.optional(v.id("users")),
    workspaceId: v.id("workspaces"),
    readableId: v.optional(v.string()),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    externalUserId: v.optional(v.string()),
    location: v.optional(
      v.object({
        city: v.optional(v.string()),
        region: v.optional(v.string()),
        country: v.optional(v.string()),
        countryCode: v.optional(v.string()),
      })
    ),
    device: v.optional(
      v.object({
        browser: v.optional(v.string()),
        os: v.optional(v.string()),
        deviceType: v.optional(v.string()),
        platform: v.optional(v.string()),
      })
    ),
    referrer: v.optional(v.string()),
    currentUrl: v.optional(v.string()),
    customAttributes: v.optional(customAttributesValidator),
    firstSeenAt: v.optional(v.number()),
    lastSeenAt: v.optional(v.number()),
    createdAt: v.number(),
    // Identity verification fields
    identityVerified: v.optional(v.boolean()),
    identityVerifiedAt: v.optional(v.number()),
  })
    .index("by_session", ["sessionId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_last_seen", ["workspaceId", "lastSeenAt"])
    .index("by_workspace_readable_id", ["workspaceId", "readableId"])
    .index("by_email", ["workspaceId", "email"])
    .index("by_external_user_id", ["workspaceId", "externalUserId"])
    .searchIndex("search_visitors", {
      searchField: "name",
      filterFields: ["workspaceId"],
    }),

  // Widget Sessions (signed session tokens for visitor auth)
  widgetSessions: defineTable({
    token: v.string(),
    visitorId: v.id("visitors"),
    workspaceId: v.id("workspaces"),
    identityVerified: v.boolean(),
    clientType: v.optional(v.string()),
    clientVersion: v.optional(v.string()),
    clientIdentifier: v.optional(v.string()),
    origin: v.optional(v.string()),
    currentUrl: v.optional(v.string()),
    devicePlatform: v.optional(v.string()),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_visitor", ["visitorId"])
    .index("by_workspace", ["workspaceId"])
    .index("by_expires", ["expiresAt"]),

  conversations: defineTable({
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    userId: v.optional(v.id("users")),
    assignedAgentId: v.optional(v.id("users")),
    status: v.union(v.literal("open"), v.literal("closed"), v.literal("snoozed")),
    channel: v.optional(v.union(v.literal("chat"), v.literal("email"))),
    subject: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastMessageAt: v.optional(v.number()),
    unreadByAgent: v.optional(v.number()),
    unreadByVisitor: v.optional(v.number()),
    firstResponseAt: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
    csatCompletedAt: v.optional(v.number()),
    csatResponseId: v.optional(v.id("csatResponses")),
    aiWorkflowState: v.optional(
      v.union(v.literal("none"), v.literal("ai_handled"), v.literal("handoff"))
    ),
    aiHandoffReason: v.optional(v.string()),
    aiLastConfidence: v.optional(v.number()),
    aiLastResponseAt: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_visitor", ["visitorId"])
    .index("by_status", ["workspaceId", "status"])
    .index("by_last_message", ["workspaceId", "lastMessageAt"])
    .index("by_channel", ["workspaceId", "channel"])
    .index("by_workspace_ai_state", ["workspaceId", "aiWorkflowState"])
    .index("by_workspace_ai_state_status", ["workspaceId", "aiWorkflowState", "status"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.string(),
    senderType: v.union(
      v.literal("user"),
      v.literal("visitor"),
      v.literal("agent"),
      v.literal("bot")
    ),
    content: v.string(),
    channel: v.optional(v.union(v.literal("chat"), v.literal("email"))),
    emailMetadata: v.optional(
      v.object({
        subject: v.optional(v.string()),
        from: v.optional(v.string()),
        to: v.optional(v.array(v.string())),
        cc: v.optional(v.array(v.string())),
        bcc: v.optional(v.array(v.string())),
        messageId: v.optional(v.string()),
        inReplyTo: v.optional(v.string()),
        references: v.optional(v.array(v.string())),
        attachments: v.optional(
          v.array(
            v.object({
              filename: v.string(),
              contentType: v.string(),
              size: v.number(),
              storageId: v.optional(v.id("_storage")),
              url: v.optional(v.string()),
            })
          )
        ),
      })
    ),
    deliveryStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("sent"),
        v.literal("delivered"),
        v.literal("bounced"),
        v.literal("failed")
      )
    ),
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_email_message_id", ["emailMetadata.messageId"]),

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

  // Visitor Push Tokens (for Mobile SDK)
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

  notificationPreferences: defineTable({
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    muted: v.boolean(),
    events: v.optional(messageNotificationEventsValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_workspace", ["userId", "workspaceId"]),

  workspaceNotificationDefaults: defineTable({
    workspaceId: v.id("workspaces"),
    events: v.optional(messageNotificationEventsValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  notificationEvents: defineTable({
    workspaceId: v.id("workspaces"),
    eventKey: v.string(),
    eventType: v.union(
      v.literal("chat_message"),
      v.literal("new_conversation"),
      v.literal("assignment"),
      v.literal("ticket_created"),
      v.literal("ticket_status_changed"),
      v.literal("ticket_assigned"),
      v.literal("ticket_comment"),
      v.literal("ticket_customer_reply"),
      v.literal("ticket_resolved"),
      v.literal("outbound_message"),
      v.literal("carousel_trigger"),
      v.literal("push_campaign")
    ),
    domain: v.union(
      v.literal("chat"),
      v.literal("ticket"),
      v.literal("outbound"),
      v.literal("campaign")
    ),
    audience: v.union(v.literal("agent"), v.literal("visitor"), v.literal("both")),
    actorType: v.union(
      v.literal("agent"),
      v.literal("visitor"),
      v.literal("bot"),
      v.literal("system")
    ),
    actorUserId: v.optional(v.id("users")),
    actorVisitorId: v.optional(v.id("visitors")),
    conversationId: v.optional(v.id("conversations")),
    ticketId: v.optional(v.id("tickets")),
    outboundMessageId: v.optional(v.id("outboundMessages")),
    campaignId: v.optional(v.id("pushCampaigns")),
    title: v.optional(v.string()),
    bodyPreview: v.optional(v.string()),
    data: v.optional(jsonRecordValidator),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_created_at", ["workspaceId", "createdAt"])
    .index("by_event_key", ["eventKey"]),

  notificationDedupeKeys: defineTable({
    dedupeKey: v.string(),
    eventId: v.id("notificationEvents"),
    eventKey: v.string(),
    workspaceId: v.id("workspaces"),
    channel: v.union(v.literal("push"), v.literal("email"), v.literal("web"), v.literal("widget")),
    recipientType: v.union(v.literal("agent"), v.literal("visitor")),
    userId: v.optional(v.id("users")),
    visitorId: v.optional(v.id("visitors")),
    createdAt: v.number(),
  })
    .index("by_dedupe_key", ["dedupeKey"])
    .index("by_event", ["eventId"])
    .index("by_workspace", ["workspaceId"]),

  notificationDeliveries: defineTable({
    workspaceId: v.id("workspaces"),
    eventId: v.optional(v.id("notificationEvents")),
    eventKey: v.string(),
    dedupeKey: v.string(),
    channel: v.union(v.literal("push"), v.literal("email"), v.literal("web"), v.literal("widget")),
    recipientType: v.union(v.literal("agent"), v.literal("visitor")),
    userId: v.optional(v.id("users")),
    visitorId: v.optional(v.id("visitors")),
    tokenCount: v.optional(v.number()),
    status: v.union(v.literal("delivered"), v.literal("suppressed"), v.literal("failed")),
    reason: v.optional(v.string()),
    error: v.optional(v.string()),
    metadata: v.optional(jsonRecordValidator),
    createdAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_created_at", ["workspaceId", "createdAt"])
    .index("by_event", ["eventId"])
    .index("by_dedupe_key", ["dedupeKey"]),

  // Help Center - Collections
  collections: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    parentId: v.optional(v.id("collections")),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_slug", ["workspaceId", "slug"])
    .index("by_parent", ["workspaceId", "parentId"]),

  // Help Center - Articles
  articles: defineTable({
    workspaceId: v.id("workspaces"),
    collectionId: v.optional(v.id("collections")),
    folderId: v.optional(v.id("contentFolders")),
    title: v.string(),
    slug: v.string(),
    content: v.string(),
    status: v.union(v.literal("draft"), v.literal("published")),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    publishedAt: v.optional(v.number()),
    authorId: v.optional(v.id("users")),
    audienceRules: v.optional(audienceRulesValidator),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_collection", ["collectionId"])
    .index("by_folder", ["folderId"])
    .index("by_slug", ["workspaceId", "slug"])
    .index("by_status", ["workspaceId", "status"]),

  // Help Center - Article Feedback
  articleFeedback: defineTable({
    articleId: v.id("articles"),
    helpful: v.boolean(),
    visitorId: v.optional(v.id("visitors")),
    createdAt: v.number(),
  }).index("by_article", ["articleId"]),

  // Snippets (Saved Replies)
  snippets: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    content: v.string(),
    shortcut: v.optional(v.string()),
    folderId: v.optional(v.id("contentFolders")),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.id("users")),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_shortcut", ["workspaceId", "shortcut"])
    .index("by_folder", ["folderId"]),

  // Visitor Events (for audience targeting)
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

  // Outbound In-App Messages
  outboundMessages: defineTable({
    workspaceId: v.id("workspaces"),
    type: v.union(v.literal("chat"), v.literal("post"), v.literal("banner")),
    name: v.string(),
    content: v.object({
      // Chat message fields
      text: v.optional(v.string()),
      senderId: v.optional(v.id("users")),
      // Post message fields
      title: v.optional(v.string()),
      body: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      videoUrl: v.optional(v.string()),
      // Banner fields
      style: v.optional(v.union(v.literal("inline"), v.literal("floating"))),
      dismissible: v.optional(v.boolean()),
      // Shared fields
      buttons: v.optional(
        v.array(
          v.object({
            text: v.string(),
            action: v.union(
              v.literal("url"),
              v.literal("dismiss"),
              v.literal("tour"),
              v.literal("open_new_conversation"),
              v.literal("open_help_article"),
              v.literal("open_widget_tab")
            ),
            url: v.optional(v.string()),
            tourId: v.optional(v.id("tours")),
            articleId: v.optional(v.id("articles")),
            tabId: v.optional(v.string()),
            prefillMessage: v.optional(v.string()),
          })
        )
      ),
      clickAction: v.optional(
        v.object({
          type: v.union(
            v.literal("open_messenger"),
            v.literal("open_new_conversation"),
            v.literal("open_widget_tab"),
            v.literal("open_help_article"),
            v.literal("open_url"),
            v.literal("dismiss")
          ),
          tabId: v.optional(v.string()),
          articleId: v.optional(v.id("articles")),
          url: v.optional(v.string()),
          prefillMessage: v.optional(v.string()),
        })
      ),
    }),
    audienceRules: v.optional(audienceRulesOrSegmentValidator),
    targeting: v.optional(audienceRulesOrSegmentValidator),
    triggers: v.optional(
      v.object({
        type: v.union(
          v.literal("immediate"),
          v.literal("page_visit"),
          v.literal("time_on_page"),
          v.literal("scroll_depth"),
          v.literal("event")
        ),
        pageUrl: v.optional(v.string()),
        pageUrlMatch: v.optional(
          v.union(v.literal("exact"), v.literal("contains"), v.literal("regex"))
        ),
        delaySeconds: v.optional(v.number()),
        scrollPercent: v.optional(v.number()),
        eventName: v.optional(v.string()),
      })
    ),
    frequency: v.optional(
      v.union(v.literal("once"), v.literal("once_per_session"), v.literal("always"))
    ),
    scheduling: v.optional(
      v.object({
        startDate: v.optional(v.number()),
        endDate: v.optional(v.number()),
      })
    ),
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
    .index("by_workspace_status", ["workspaceId", "status"])
    .index("by_workspace_type", ["workspaceId", "type"]),

  // Outbound Message Impressions (tracking)
  outboundMessageImpressions: defineTable({
    messageId: v.id("outboundMessages"),
    visitorId: v.id("visitors"),
    sessionId: v.optional(v.string()),
    action: v.union(v.literal("shown"), v.literal("clicked"), v.literal("dismissed")),
    buttonIndex: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_message", ["messageId"])
    .index("by_visitor", ["visitorId"])
    .index("by_visitor_message", ["visitorId", "messageId"]),

  // Checklists
  checklists: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    tasks: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        description: v.optional(v.string()),
        action: v.optional(
          v.object({
            type: v.union(v.literal("tour"), v.literal("url"), v.literal("event")),
            tourId: v.optional(v.id("tours")),
            url: v.optional(v.string()),
            eventName: v.optional(v.string()),
          })
        ),
        completionType: v.union(
          v.literal("manual"),
          v.literal("auto_event"),
          v.literal("auto_attribute")
        ),
        completionEvent: v.optional(v.string()),
        completionAttribute: v.optional(
          v.object({
            key: v.string(),
            operator: v.string(),
            value: v.optional(jsonValueValidator),
          })
        ),
      })
    ),
    audienceRules: v.optional(audienceRulesOrSegmentValidator),
    targeting: v.optional(audienceRulesOrSegmentValidator),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("archived")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_status", ["workspaceId", "status"]),

  // Checklist Progress (per visitor)
  checklistProgress: defineTable({
    visitorId: v.id("visitors"),
    checklistId: v.id("checklists"),
    completedTaskIds: v.array(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_visitor", ["visitorId"])
    .index("by_checklist", ["checklistId"])
    .index("by_visitor_checklist", ["visitorId", "checklistId"]),

  // Email Channel Configuration
  emailConfigs: defineTable({
    workspaceId: v.id("workspaces"),
    forwardingAddress: v.string(),
    fromName: v.optional(v.string()),
    fromEmail: v.optional(v.string()),
    fromEmailVerified: v.optional(v.boolean()),
    signature: v.optional(v.string()),
    provider: v.optional(
      v.union(v.literal("resend"), v.literal("sendgrid"), v.literal("postmark"))
    ),
    apiKeyEncrypted: v.optional(v.string()),
    webhookSecret: v.optional(v.string()),
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_forwarding_address", ["forwardingAddress"]),

  // Email Thread Tracking
  emailThreads: defineTable({
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    messageId: v.string(),
    inReplyTo: v.optional(v.string()),
    references: v.optional(v.array(v.string())),
    subject: v.string(),
    normalizedSubject: v.string(),
    senderEmail: v.string(),
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_message_id", ["messageId"])
    .index("by_subject_sender", ["workspaceId", "normalizedSubject", "senderEmail"]),

  // Tickets
  tickets: defineTable({
    workspaceId: v.id("workspaces"),
    conversationId: v.optional(v.id("conversations")),
    visitorId: v.optional(v.id("visitors")),
    subject: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("submitted"),
      v.literal("in_progress"),
      v.literal("waiting_on_customer"),
      v.literal("resolved")
    ),
    priority: v.union(
      v.literal("low"),
      v.literal("normal"),
      v.literal("high"),
      v.literal("urgent")
    ),
    assigneeId: v.optional(v.id("users")),
    teamId: v.optional(v.string()),
    formId: v.optional(v.id("ticketForms")),
    formData: v.optional(formDataValidator),
    resolutionSummary: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_visitor", ["visitorId"])
    .index("by_status", ["workspaceId", "status"])
    .index("by_assignee", ["workspaceId", "assigneeId"])
    .index("by_conversation", ["conversationId"]),

  // Ticket Comments (internal notes + customer-visible updates)
  ticketComments: defineTable({
    ticketId: v.id("tickets"),
    authorId: v.string(),
    authorType: v.union(v.literal("agent"), v.literal("visitor"), v.literal("system")),
    content: v.string(),
    isInternal: v.boolean(),
    createdAt: v.number(),
  }).index("by_ticket", ["ticketId"]),

  // Ticket Forms
  ticketForms: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.optional(v.string()),
    fields: v.array(
      v.object({
        id: v.string(),
        type: v.union(
          v.literal("text"),
          v.literal("textarea"),
          v.literal("select"),
          v.literal("multi-select"),
          v.literal("number"),
          v.literal("date")
        ),
        label: v.string(),
        placeholder: v.optional(v.string()),
        required: v.boolean(),
        options: v.optional(v.array(v.string())),
      })
    ),
    isDefault: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_default", ["workspaceId", "isDefault"]),

  // Email Campaigns
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

  // AI Agent Settings (per workspace)
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
    sources: v.array(
      v.object({
        type: v.string(),
        id: v.string(),
        title: v.string(),
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
      })
    ),

    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),
});
