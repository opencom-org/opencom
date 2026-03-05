import { defineTable } from "convex/server";
import { v } from "convex/values";
import { audienceRulesOrSegmentValidator, formDataValidator, jsonValueValidator } from "../validators";

export const outboundSupportTables = {
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
};
