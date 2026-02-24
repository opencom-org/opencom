import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Id, Doc } from "./_generated/dataModel";
import { evaluateRuleWithSegmentSupport, validateAudienceRule } from "./audienceRules";
import { authAction, authMutation, authQuery } from "./lib/authWrappers";
import { getAuthenticatedUserFromSession } from "./auth";
import { requirePermission } from "./permissions";
import { resolveVisitorFromSession } from "./widgetSessions";
import { audienceRulesValidator } from "./validators";

// Task 2.1: Create outbound message
export const create = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    type: v.union(v.literal("chat"), v.literal("post"), v.literal("banner")),
    name: v.string(),
    content: v.object({
      text: v.optional(v.string()),
      senderId: v.optional(v.id("users")),
      title: v.optional(v.string()),
      body: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      videoUrl: v.optional(v.string()),
      style: v.optional(v.union(v.literal("inline"), v.literal("floating"))),
      dismissible: v.optional(v.boolean()),
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
    targeting: v.optional(audienceRulesValidator),
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
    priority: v.optional(v.number()),
  },
  permission: "settings.workspace",
  handler: async (ctx, args) => {
    // Validate targeting rules if provided
    if (args.targeting !== undefined && !validateAudienceRule(args.targeting)) {
      throw new Error("Invalid targeting rules");
    }

    const now = Date.now();
    return await ctx.db.insert("outboundMessages", {
      ...args,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Task 2.2: Update outbound message
export const update = authMutation({
  args: {
    id: v.id("outboundMessages"),
    name: v.optional(v.string()),
    content: v.optional(
      v.object({
        text: v.optional(v.string()),
        senderId: v.optional(v.id("users")),
        title: v.optional(v.string()),
        body: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
        videoUrl: v.optional(v.string()),
        style: v.optional(v.union(v.literal("inline"), v.literal("floating"))),
        dismissible: v.optional(v.boolean()),
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
      })
    ),
    targeting: v.optional(audienceRulesValidator),
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
    priority: v.optional(v.number()),
  },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const message = await ctx.db.get(args.id);
    return message?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Message not found");

    // Validate targeting rules if provided
    if (args.targeting !== undefined && !validateAudienceRule(args.targeting)) {
      throw new Error("Invalid targeting rules");
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return id;
  },
});

// Task 2.3: Delete outbound message
export const remove = authMutation({
  args: { id: v.id("outboundMessages") },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const message = await ctx.db.get(args.id);
    return message?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Message not found");
    await ctx.db.delete(args.id);
  },
});

// Task 2.4: List outbound messages with filters
export const list = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    type: v.optional(v.union(v.literal("chat"), v.literal("post"), v.literal("banner"))),
    status: v.optional(
      v.union(v.literal("draft"), v.literal("active"), v.literal("paused"), v.literal("archived"))
    ),
  },
  permission: "settings.workspace",
  handler: async (ctx, args) => {
    let messages;

    if (args.status) {
      messages = await ctx.db
        .query("outboundMessages")
        .withIndex("by_workspace_status", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("status", args.status!)
        )
        .collect();
    } else if (args.type) {
      messages = await ctx.db
        .query("outboundMessages")
        .withIndex("by_workspace_type", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("type", args.type!)
        )
        .collect();
    } else {
      messages = await ctx.db
        .query("outboundMessages")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .collect();
    }

    // Apply additional filters if both type and status are provided
    if (args.type && args.status) {
      messages = messages.filter((m) => m.type === args.type);
    }

    return messages.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Task 2.5: Activate/pause outbound message
export const activate = authMutation({
  args: { id: v.id("outboundMessages") },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const message = await ctx.db.get(args.id);
    return message?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Message not found");
    await ctx.db.patch(args.id, { status: "active", updatedAt: Date.now() });
  },
});

export const pause = authMutation({
  args: { id: v.id("outboundMessages") },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const message = await ctx.db.get(args.id);
    return message?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Message not found");
    await ctx.db.patch(args.id, { status: "paused", updatedAt: Date.now() });
  },
});

// Task 2.6: Get eligible messages for a visitor
export const getEligible = query({
  args: {
    workspaceId: v.id("workspaces"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    currentUrl: v.string(),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUserFromSession(ctx);
    let resolvedVisitorId = args.visitorId;

    if (authUser) {
      await requirePermission(ctx, authUser._id, args.workspaceId, "conversations.read");
      if (!resolvedVisitorId) {
        throw new Error("visitorId is required for authenticated outbound access");
      }
    } else {
      const resolved = await resolveVisitorFromSession(ctx, {
        sessionToken: args.sessionToken,
        workspaceId: args.workspaceId,
      });
      if (args.visitorId && args.visitorId !== resolved.visitorId) {
        throw new Error("Not authorized for requested visitor");
      }
      resolvedVisitorId = resolved.visitorId;
    }

    const visitor = (await ctx.db.get(resolvedVisitorId!)) as Doc<"visitors"> | null;
    if (!visitor || visitor.workspaceId !== args.workspaceId) {
      throw new Error("Visitor not found in workspace");
    }

    const now = Date.now();

    // Get all active messages for this workspace
    const activeMessages = await ctx.db
      .query("outboundMessages")
      .withIndex("by_workspace_status", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("status", "active")
      )
      .collect();

    // Get visitor's impression history
    const impressions = await ctx.db
      .query("outboundMessageImpressions")
      .withIndex("by_visitor", (q) => q.eq("visitorId", resolvedVisitorId!))
      .collect();

    const impressionsByMessage = new Map<string, typeof impressions>();
    for (const imp of impressions) {
      const key = imp.messageId as string;
      if (!impressionsByMessage.has(key)) {
        impressionsByMessage.set(key, []);
      }
      impressionsByMessage.get(key)!.push(imp);
    }

    const eligible: typeof activeMessages = [];

    for (const message of activeMessages) {
      // Check scheduling
      if (message.scheduling) {
        if (message.scheduling.startDate && now < message.scheduling.startDate) continue;
        if (message.scheduling.endDate && now > message.scheduling.endDate) continue;
      }

      // Check frequency
      const msgImpressions = impressionsByMessage.get(message._id as string) || [];
      const hasBeenShown = msgImpressions.some((i) => i.action === "shown");

      if (message.frequency === "once" && hasBeenShown) continue;

      if (message.frequency === "once_per_session" && args.sessionId) {
        const shownThisSession = msgImpressions.some(
          (i) => i.action === "shown" && i.sessionId === args.sessionId
        );
        if (shownThisSession) continue;
      }

      // Check page URL trigger
      if (message.triggers?.type === "page_visit" && message.triggers.pageUrl) {
        const matches = matchPageUrl(
          args.currentUrl,
          message.triggers.pageUrl,
          message.triggers.pageUrlMatch || "contains"
        );
        if (!matches) continue;
      }

      // Check audience targeting (audienceRules with targeting fallback)
      const audienceRules = message.audienceRules ?? message.targeting;
      if (audienceRules) {
        const matches = await evaluateRuleWithSegmentSupport(ctx, audienceRules, visitor);
        if (!matches) continue;
      }

      eligible.push(message);
    }

    // Sort by priority (higher first)
    return eligible.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  },
});

function matchPageUrl(
  currentUrl: string,
  pattern: string,
  matchType: "exact" | "contains" | "regex"
): boolean {
  switch (matchType) {
    case "exact":
      return currentUrl === pattern;
    case "contains":
      return currentUrl.includes(pattern);
    case "regex":
      try {
        return new RegExp(pattern).test(currentUrl);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

// Task 2.7: Track message impressions and interactions
export const trackImpression = mutation({
  args: {
    messageId: v.id("outboundMessages"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    action: v.union(v.literal("shown"), v.literal("clicked"), v.literal("dismissed")),
    buttonIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      // Message can be deleted between eligibility fetch and client-side impression tracking.
      return null;
    }

    const authUser = await getAuthenticatedUserFromSession(ctx);
    let resolvedVisitorId = args.visitorId;

    if (authUser) {
      await requirePermission(ctx, authUser._id, message.workspaceId, "conversations.read");
      if (!resolvedVisitorId) {
        throw new Error("visitorId is required for authenticated impression tracking");
      }
    } else {
      const resolved = await resolveVisitorFromSession(ctx, {
        sessionToken: args.sessionToken,
        workspaceId: message.workspaceId,
      });
      if (args.visitorId && args.visitorId !== resolved.visitorId) {
        throw new Error("Not authorized for requested visitor");
      }
      resolvedVisitorId = resolved.visitorId;
    }

    const visitor = (await ctx.db.get(resolvedVisitorId!)) as Doc<"visitors"> | null;
    if (!visitor || visitor.workspaceId !== message.workspaceId) {
      throw new Error("Visitor not found in message workspace");
    }

    return await ctx.db.insert("outboundMessageImpressions", {
      messageId: args.messageId,
      visitorId: resolvedVisitorId!,
      sessionId: args.sessionId,
      action: args.action,
      buttonIndex: args.buttonIndex,
      createdAt: Date.now(),
    });
  },
});

// Get a single message
export const get = authQuery({
  args: { id: v.id("outboundMessages") },
  permission: "settings.workspace",
  allowMissingWorkspace: true,
  resolveWorkspaceId: async (ctx, args) => {
    const message = await ctx.db.get(args.id);
    return message?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get message stats
export const getStats = authQuery({
  args: { id: v.id("outboundMessages") },
  permission: "settings.workspace",
  resolveWorkspaceId: async (ctx, args) => {
    const message = await ctx.db.get(args.id);
    return message?.workspaceId ?? null;
  },
  handler: async (ctx, args) => {
    const impressions = await ctx.db
      .query("outboundMessageImpressions")
      .withIndex("by_message", (q) => q.eq("messageId", args.id))
      .collect();

    const shown = impressions.filter((i) => i.action === "shown").length;
    const clicked = impressions.filter((i) => i.action === "clicked").length;
    const dismissed = impressions.filter((i) => i.action === "dismissed").length;

    return {
      shown,
      clicked,
      dismissed,
      clickRate: shown > 0 ? (clicked / shown) * 100 : 0,
      dismissRate: shown > 0 ? (dismissed / shown) * 100 : 0,
    };
  },
});

// Task 5.2: Send push notifications for outbound campaigns
// This action sends push notifications to eligible visitors when a campaign is activated
export const sendPushForCampaign = authAction({
  args: {
    messageId: v.id("outboundMessages"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    sent?: number;
    message?: string;
    failed?: number;
    error?: string;
    tickets?: Array<{ status: string; id?: string; error?: string }>;
  }> => {
    const message = await ctx.runQuery(api.outboundMessages.get, { id: args.messageId });
    if (!message) throw new Error("Message not found");
    if (message.status !== "active") throw new Error("Message must be active to send push");

    // Only send push for post-type messages (they have title/body suitable for push)
    if (message.type !== "post") {
      return { success: false, error: "Only post-type messages support push notifications" };
    }

    const title = message.content.title || message.name;
    const body = message.content.body || message.content.text || "";

    if (!body) {
      return { success: false, error: "Message must have body content for push" };
    }

    // Get eligible visitors based on targeting
    const eligibleVisitors = await ctx.runQuery(api.outboundMessages.getEligibleVisitorsForPush, {
      workspaceId: message.workspaceId,
      targeting: message.targeting,
    });

    if (eligibleVisitors.length === 0) {
      return { success: true, sent: 0, message: "No eligible visitors with push tokens" };
    }

    const visitorIds = Array.from(
      new Set(eligibleVisitors.map((visitor: { visitorId: Id<"visitors"> }) => visitor.visitorId))
    ) as Id<"visitors">[];
    const routed = await ctx.runMutation(internal.notifications.routeEvent, {
      eventType: "outbound_message",
      domain: "outbound",
      audience: "visitor",
      workspaceId: message.workspaceId,
      actorType: "system",
      outboundMessageId: args.messageId,
      title,
      body,
      data: {
        type: "outbound_message",
        messageId: args.messageId,
        imageUrl: message.content.imageUrl,
      },
      recipientVisitorIds: visitorIds,
      eventKey: `outbound_message:${args.messageId}:${message.updatedAt}`,
    });

    return {
      success: true,
      sent: routed.scheduled,
      failed: 0,
      message: routed.scheduled === 0 ? "No eligible visitors with push tokens" : undefined,
    };
  },
});

// Get visitors eligible for push notifications based on targeting
export const getEligibleVisitorsForPush = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    targeting: v.optional(audienceRulesValidator),
  },
  permission: "settings.workspace",
  handler: async (ctx, args) => {
    // Get all visitors with push tokens in this workspace
    const pushTokens = await ctx.db
      .query("visitorPushTokens")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    if (pushTokens.length === 0) return [];

    // Get unique visitor IDs
    const visitorIds = [...new Set(pushTokens.map((t) => t.visitorId))];

    const eligibleVisitors: Array<{ visitorId: Id<"visitors">; token: string }> = [];

    for (const visitorId of visitorIds) {
      const visitor = await ctx.db.get(visitorId);
      if (!visitor) continue;

      // Check targeting rules if specified (supports audienceRules or targeting)
      if (args.targeting) {
        const matches = await evaluateRuleWithSegmentSupport(ctx, args.targeting, visitor);
        if (!matches) continue;
      }

      // Get the most recent token for this visitor
      const visitorTokens = pushTokens.filter((t) => t.visitorId === visitorId);
      const latestToken = visitorTokens.sort((a, b) => b.updatedAt - a.updatedAt)[0];

      if (latestToken) {
        eligibleVisitors.push({
          visitorId,
          token: latestToken.token,
        });
      }
    }

    return eligibleVisitors;
  },
});
