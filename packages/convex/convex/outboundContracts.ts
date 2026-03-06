import { v } from "convex/values";

export const outboundMessageTypeValidator = v.union(
  v.literal("chat"),
  v.literal("post"),
  v.literal("banner")
);

export const outboundMessageStatusValidator = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("paused"),
  v.literal("archived")
);

export const outboundButtonActionValidator = v.union(
  v.literal("url"),
  v.literal("dismiss"),
  v.literal("tour"),
  v.literal("open_new_conversation"),
  v.literal("open_help_article"),
  v.literal("open_widget_tab")
);

export const outboundMessageButtonValidator = v.object({
  text: v.string(),
  action: outboundButtonActionValidator,
  url: v.optional(v.string()),
  tourId: v.optional(v.id("tours")),
  articleId: v.optional(v.id("articles")),
  tabId: v.optional(v.string()),
  prefillMessage: v.optional(v.string()),
});

export const outboundClickActionTypeValidator = v.union(
  v.literal("open_messenger"),
  v.literal("open_new_conversation"),
  v.literal("open_widget_tab"),
  v.literal("open_help_article"),
  v.literal("open_url"),
  v.literal("dismiss")
);

export const outboundClickActionValidator = v.object({
  type: outboundClickActionTypeValidator,
  tabId: v.optional(v.string()),
  articleId: v.optional(v.id("articles")),
  url: v.optional(v.string()),
  prefillMessage: v.optional(v.string()),
});

export const outboundMessageContentValidator = v.object({
  text: v.optional(v.string()),
  senderId: v.optional(v.id("users")),
  title: v.optional(v.string()),
  body: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  videoUrl: v.optional(v.string()),
  style: v.optional(v.union(v.literal("inline"), v.literal("floating"))),
  dismissible: v.optional(v.boolean()),
  buttons: v.optional(v.array(outboundMessageButtonValidator)),
  clickAction: v.optional(outboundClickActionValidator),
});

export const outboundMessageTriggerTypeValidator = v.union(
  v.literal("immediate"),
  v.literal("page_visit"),
  v.literal("time_on_page"),
  v.literal("scroll_depth"),
  v.literal("event")
);

export const outboundPageUrlMatchValidator = v.union(
  v.literal("exact"),
  v.literal("contains"),
  v.literal("regex")
);

export const outboundMessageTriggerValidator = v.object({
  type: outboundMessageTriggerTypeValidator,
  pageUrl: v.optional(v.string()),
  pageUrlMatch: v.optional(outboundPageUrlMatchValidator),
  delaySeconds: v.optional(v.number()),
  scrollPercent: v.optional(v.number()),
  eventName: v.optional(v.string()),
});

export const outboundMessageFrequencyValidator = v.union(
  v.literal("once"),
  v.literal("once_per_session"),
  v.literal("always")
);

export const outboundMessageSchedulingValidator = v.object({
  startDate: v.optional(v.number()),
  endDate: v.optional(v.number()),
});

export const outboundImpressionActionValidator = v.union(
  v.literal("shown"),
  v.literal("clicked"),
  v.literal("dismissed")
);
