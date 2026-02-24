import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { formatReadableVisitorId } from "./visitorReadableId";

const E2E_TEST_PREFIX = "e2e_test_";

function requireTestDataEnabled() {
  if (process.env.ALLOW_TEST_DATA !== "true") {
    throw new Error("Test data mutations are disabled");
  }
}

/**
 * Seeds a test tour with steps for E2E testing.
 */
export const seedTour = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
    status: v.optional(v.union(v.literal("draft"), v.literal("active"), v.literal("archived"))),
    targetPageUrl: v.optional(v.string()),
    steps: v.optional(
      v.array(
        v.object({
          type: v.union(v.literal("pointer"), v.literal("post"), v.literal("video")),
          title: v.optional(v.string()),
          content: v.string(),
          elementSelector: v.optional(v.string()),
          routePath: v.optional(v.string()),
          advanceOn: v.optional(
            v.union(v.literal("click"), v.literal("elementClick"), v.literal("fieldFill"))
          ),
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
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    requireTestDataEnabled();
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const name = args.name || `${E2E_TEST_PREFIX}tour_${randomSuffix}`;

    const tourId = await ctx.db.insert("tours", {
      workspaceId: args.workspaceId,
      name,
      description: "E2E test tour",
      status: args.status || "active",
      targetingRules: args.targetPageUrl
        ? {
            pageUrl: args.targetPageUrl,
          }
        : undefined,
      displayMode: "first_time_only",
      priority: 100,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const steps = args.steps || [
      {
        type: "post" as const,
        title: "Welcome",
        content: "Welcome to the E2E test tour!",
      },
      {
        type: "pointer" as const,
        title: "Step 1",
        content: "This is the first step",
        elementSelector: "[data-testid='tour-target-1']",
      },
      {
        type: "pointer" as const,
        title: "Step 2",
        content: "This is the second step",
        elementSelector: "[data-testid='tour-target-2']",
      },
    ];

    const stepIds: Id<"tourSteps">[] = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepId = await ctx.db.insert("tourSteps", {
        workspaceId: args.workspaceId,
        tourId,
        type: step.type,
        order: i,
        title: step.title,
        content: step.content,
        elementSelector: step.elementSelector,
        routePath: step.routePath,
        position: step.position ?? "auto",
        size: step.size ?? "small",
        advanceOn: step.advanceOn ?? "click",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      stepIds.push(stepId);
    }

    return { tourId, stepIds, name };
  },
});

/**
 * Seeds a test survey with questions for E2E testing.
 */
export const seedSurvey = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
    format: v.optional(v.union(v.literal("small"), v.literal("large"))),
    status: v.optional(
      v.union(v.literal("draft"), v.literal("active"), v.literal("paused"), v.literal("archived"))
    ),
    questionType: v.optional(
      v.union(
        v.literal("nps"),
        v.literal("numeric_scale"),
        v.literal("star_rating"),
        v.literal("emoji_rating"),
        v.literal("short_text"),
        v.literal("multiple_choice")
      )
    ),
    triggerType: v.optional(
      v.union(
        v.literal("immediate"),
        v.literal("page_visit"),
        v.literal("time_on_page"),
        v.literal("event")
      )
    ),
    triggerPageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireTestDataEnabled();
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const name = args.name || `${E2E_TEST_PREFIX}survey_${randomSuffix}`;
    const format = args.format || "small";
    const questionType = args.questionType || "nps";

    const questionId = `q_${randomSuffix}`;
    const questions = [
      {
        id: questionId,
        type: questionType,
        title:
          questionType === "nps"
            ? "How likely are you to recommend us?"
            : "What do you think of our product?",
        required: true,
        ...(questionType === "multiple_choice"
          ? {
              options: {
                choices: ["Excellent", "Good", "Average", "Poor"],
              },
            }
          : {}),
        ...(questionType === "numeric_scale"
          ? {
              options: {
                scaleStart: 1,
                scaleEnd: 5,
                startLabel: "Poor",
                endLabel: "Excellent",
              },
            }
          : {}),
      },
    ];

    const surveyId = await ctx.db.insert("surveys", {
      workspaceId: args.workspaceId,
      name,
      description: "E2E test survey",
      format,
      status: args.status || "active",
      questions,
      introStep:
        format === "large"
          ? {
              title: "Quick Survey",
              description: "Help us improve by answering a quick question",
              buttonText: "Start",
            }
          : undefined,
      thankYouStep: {
        title: "Thank you!",
        description: "Your feedback has been recorded",
        buttonText: "Done",
      },
      showProgressBar: true,
      showDismissButton: true,
      triggers: args.triggerType
        ? {
            type: args.triggerType,
            pageUrl: args.triggerPageUrl,
            pageUrlMatch: args.triggerPageUrl ? "contains" : undefined,
            delaySeconds: args.triggerType === "time_on_page" ? 5 : undefined,
          }
        : {
            type: "immediate",
          },
      frequency: "once",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return { surveyId, name, questionId };
  },
});

/**
 * Seeds a test carousel with slides for E2E testing.
 */
export const seedCarousel = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("draft"), v.literal("active"), v.literal("paused"), v.literal("archived"))
    ),
    screens: v.optional(
      v.array(
        v.object({
          title: v.optional(v.string()),
          body: v.optional(v.string()),
          imageUrl: v.optional(v.string()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    requireTestDataEnabled();
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const name = args.name || `${E2E_TEST_PREFIX}carousel_${randomSuffix}`;

    type CarouselScreen = {
      id: string;
      title?: string;
      body?: string;
      imageUrl?: string;
      buttons?: Array<{
        text: string;
        action: "url" | "dismiss" | "next" | "deeplink";
        url?: string;
        deepLink?: string;
      }>;
    };

    let screens: CarouselScreen[];

    if (args.screens) {
      screens = args.screens.map((s, i) => ({
        id: `screen_${i}_${randomSuffix}`,
        title: s.title,
        body: s.body,
        imageUrl: s.imageUrl,
      }));
    } else {
      screens = [
        {
          id: `screen_1_${randomSuffix}`,
          title: "Welcome!",
          body: "This is the first slide of the E2E test carousel",
          buttons: [
            { text: "Next", action: "next" },
            { text: "Dismiss", action: "dismiss" },
          ],
        },
        {
          id: `screen_2_${randomSuffix}`,
          title: "Feature Highlight",
          body: "Check out our amazing features",
          buttons: [{ text: "Next", action: "next" }],
        },
        {
          id: `screen_3_${randomSuffix}`,
          title: "Get Started",
          body: "Ready to begin?",
          buttons: [
            { text: "Done", action: "dismiss" },
            { text: "Learn More", action: "url", url: "https://example.com" },
          ],
        },
      ];
    }

    const carouselId = await ctx.db.insert("carousels", {
      workspaceId: args.workspaceId,
      name,
      screens,
      status: args.status || "active",
      priority: 100,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return { carouselId, name };
  },
});

/**
 * Seeds a test outbound message for E2E testing.
 */
export const seedOutboundMessage = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
    type: v.optional(v.union(v.literal("chat"), v.literal("post"), v.literal("banner"))),
    status: v.optional(
      v.union(v.literal("draft"), v.literal("active"), v.literal("paused"), v.literal("archived"))
    ),
    triggerType: v.optional(
      v.union(
        v.literal("immediate"),
        v.literal("page_visit"),
        v.literal("time_on_page"),
        v.literal("scroll_depth"),
        v.literal("event")
      )
    ),
    triggerPageUrl: v.optional(v.string()),
    senderId: v.optional(v.id("users")),
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
  },
  handler: async (ctx, args) => {
    requireTestDataEnabled();
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const name = args.name || `${E2E_TEST_PREFIX}message_${randomSuffix}`;
    const type = args.type || "chat";

    const content: {
      text?: string;
      senderId?: Id<"users">;
      title?: string;
      body?: string;
      style?: "inline" | "floating";
      dismissible?: boolean;
      buttons?: Array<{
        text: string;
        action:
          | "url"
          | "dismiss"
          | "tour"
          | "open_new_conversation"
          | "open_help_article"
          | "open_widget_tab";
        url?: string;
      }>;
      clickAction?: {
        type:
          | "open_messenger"
          | "open_new_conversation"
          | "open_widget_tab"
          | "open_help_article"
          | "open_url"
          | "dismiss";
        tabId?: string;
        articleId?: Id<"articles">;
        url?: string;
        prefillMessage?: string;
      };
    } = {};

    if (type === "chat") {
      content.text = "Hello! This is an E2E test message. How can we help you today?";
      content.senderId = args.senderId;
    } else if (type === "post") {
      content.title = "E2E Test Announcement";
      content.body = "This is a test post message for E2E testing.";
      content.buttons = [
        { text: "Learn More", action: "url", url: "https://example.com" },
        { text: "Dismiss", action: "dismiss" },
      ];
    } else if (type === "banner") {
      content.text = "E2E Test Banner - Limited time offer!";
      content.style = "floating";
      content.dismissible = true;
      content.buttons = [{ text: "View Offer", action: "url", url: "https://example.com" }];
    }

    if (args.clickAction) {
      content.clickAction = args.clickAction;
    }

    const messageId = await ctx.db.insert("outboundMessages", {
      workspaceId: args.workspaceId,
      name,
      type,
      content,
      status: args.status || "active",
      triggers: {
        type: args.triggerType || "immediate",
        pageUrl: args.triggerPageUrl,
        pageUrlMatch: args.triggerPageUrl ? "contains" : undefined,
        delaySeconds: args.triggerType === "time_on_page" ? 3 : undefined,
        scrollPercent: args.triggerType === "scroll_depth" ? 50 : undefined,
      },
      frequency: "once",
      priority: 100,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return { messageId, name };
  },
});

/**
 * Seeds test articles in a collection for E2E testing.
 */
export const seedArticles = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    collectionName: v.optional(v.string()),
    articleCount: v.optional(v.number()),
    includesDraft: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    requireTestDataEnabled();
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const collectionName = args.collectionName || `${E2E_TEST_PREFIX}collection_${randomSuffix}`;
    const articleCount = args.articleCount || 3;

    // Create collection
    const collectionId = await ctx.db.insert("collections", {
      workspaceId: args.workspaceId,
      name: collectionName,
      slug: collectionName.toLowerCase().replace(/\s+/g, "-"),
      description: "E2E test article collection",
      order: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // Create articles
    const articleIds: Id<"articles">[] = [];
    const articles = [
      {
        title: "Getting Started Guide",
        content:
          "# Getting Started\n\nWelcome to our platform! This guide will help you get started quickly.\n\n## Step 1: Create an Account\n\nFirst, sign up for an account...\n\n## Step 2: Configure Settings\n\nNext, configure your settings...",
      },
      {
        title: "FAQ",
        content:
          "# Frequently Asked Questions\n\n## How do I reset my password?\n\nYou can reset your password by clicking the forgot password link.\n\n## How do I contact support?\n\nReach out to us through the chat widget.",
      },
      {
        title: "Troubleshooting Common Issues",
        content:
          "# Troubleshooting\n\n## Login Issues\n\nIf you can't log in, try clearing your browser cache.\n\n## Performance Issues\n\nMake sure you have a stable internet connection.",
      },
    ];

    for (let i = 0; i < articleCount; i++) {
      const article = articles[i % articles.length];
      const isDraft = args.includesDraft && i === articleCount - 1;

      const articleId = await ctx.db.insert("articles", {
        workspaceId: args.workspaceId,
        collectionId,
        title: `${E2E_TEST_PREFIX}${article.title}`,
        slug: `${E2E_TEST_PREFIX}${article.title.toLowerCase().replace(/\s+/g, "-")}-${randomSuffix}-${i}`,
        content: article.content,
        status: isDraft ? "draft" : "published",
        order: i,
        createdAt: timestamp,
        updatedAt: timestamp,
        publishedAt: isDraft ? undefined : timestamp,
      });
      articleIds.push(articleId);
    }

    return { collectionId, collectionName, articleIds };
  },
});

/**
 * Seeds a test visitor with custom attributes for E2E testing.
 */
export const seedVisitor = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    externalUserId: v.optional(v.string()),
    customAttributes: v.optional(v.any()),
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
      })
    ),
  },
  handler: async (ctx, args) => {
    requireTestDataEnabled();
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const sessionId = `${E2E_TEST_PREFIX}session_${timestamp}_${randomSuffix}`;

    const visitorId = await ctx.db.insert("visitors", {
      sessionId,
      workspaceId: args.workspaceId,
      email: args.email || `${E2E_TEST_PREFIX}visitor_${randomSuffix}@test.opencom.dev`,
      name: args.name || `E2E Test Visitor ${randomSuffix}`,
      externalUserId: args.externalUserId,
      customAttributes: args.customAttributes || {
        plan: "free",
        signupDate: new Date().toISOString(),
      },
      location: args.location || {
        city: "San Francisco",
        region: "California",
        country: "United States",
        countryCode: "US",
      },
      device: args.device || {
        browser: "Chrome",
        os: "macOS",
        deviceType: "desktop",
      },
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      createdAt: timestamp,
    });

    await ctx.db.patch(visitorId, {
      readableId: formatReadableVisitorId(visitorId),
    });

    return { visitorId, sessionId };
  },
});

/**
 * Seeds a test segment for E2E testing.
 */
export const seedSegment = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
    audienceRules: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    requireTestDataEnabled();
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const name = args.name || `${E2E_TEST_PREFIX}segment_${randomSuffix}`;

    const defaultRules = {
      type: "group" as const,
      operator: "and" as const,
      conditions: [
        {
          type: "condition" as const,
          property: { source: "system" as const, key: "email" },
          operator: "is_set" as const,
        },
      ],
    };

    const segmentId = await ctx.db.insert("segments", {
      workspaceId: args.workspaceId,
      name,
      description: "E2E test segment",
      audienceRules: args.audienceRules || defaultRules,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return { segmentId, name };
  },
});

/**
 * Seeds messenger settings for E2E testing.
 */
export const seedMessengerSettings = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    primaryColor: v.optional(v.string()),
    welcomeMessage: v.optional(v.string()),
    launcherPosition: v.optional(v.union(v.literal("right"), v.literal("left"))),
  },
  handler: async (ctx, args) => {
    requireTestDataEnabled();
    const timestamp = Date.now();

    // Check if settings exist, update or create
    const existing = await ctx.db
      .query("messengerSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        primaryColor: args.primaryColor || "#792cd4",
        backgroundColor: "#792cd4",
        welcomeMessage: args.welcomeMessage || "Hello! How can we help you today?",
        launcherPosition: args.launcherPosition || "right",
        updatedAt: timestamp,
      });
      return { settingsId: existing._id };
    }

    const settingsId = await ctx.db.insert("messengerSettings", {
      workspaceId: args.workspaceId,
      primaryColor: args.primaryColor || "#792cd4",
      backgroundColor: "#792cd4",
      themeMode: "light",
      launcherPosition: args.launcherPosition || "right",
      launcherSideSpacing: 20,
      launcherBottomSpacing: 20,
      showLauncher: true,
      welcomeMessage: args.welcomeMessage || "Hello! How can we help you today?",
      showTeammateAvatars: true,
      supportedLanguages: ["en"],
      defaultLanguage: "en",
      mobileEnabled: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return { settingsId };
  },
});

/**
 * Seeds AI agent settings for E2E testing.
 */
export const seedAIAgentSettings = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    requireTestDataEnabled();
    const timestamp = Date.now();

    // Check if settings exist, update or create
    const existing = await ctx.db
      .query("aiAgentSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        enabled: args.enabled ?? true,
        updatedAt: timestamp,
      });
      return { settingsId: existing._id };
    }

    const settingsId = await ctx.db.insert("aiAgentSettings", {
      workspaceId: args.workspaceId,
      enabled: args.enabled ?? true,
      knowledgeSources: ["articles"],
      confidenceThreshold: 0.7,
      personality: "helpful and friendly",
      handoffMessage: "Let me connect you with a human agent.",
      model: "gpt-5-nano",
      suggestionsEnabled: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return { settingsId };
  },
});

/**
 * Cleans up all test data with the e2e_test_ prefix from a workspace.
 */
export const cleanupTestData = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    requireTestDataEnabled();
    const { workspaceId } = args;
    let cleaned = {
      tours: 0,
      tourSteps: 0,
      tourProgress: 0,
      surveys: 0,
      surveyResponses: 0,
      surveyImpressions: 0,
      carousels: 0,
      carouselImpressions: 0,
      outboundMessages: 0,
      outboundMessageImpressions: 0,
      articles: 0,
      collections: 0,
      segments: 0,
      visitors: 0,
      checklists: 0,
      tooltips: 0,
      snippets: 0,
      emailCampaigns: 0,
      tickets: 0,
    };

    // Clean up tours and related data
    const tours = await ctx.db
      .query("tours")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    for (const tour of tours) {
      if (tour.name.startsWith(E2E_TEST_PREFIX)) {
        // Delete tour steps
        const steps = await ctx.db
          .query("tourSteps")
          .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
          .collect();
        for (const step of steps) {
          await ctx.db.delete(step._id);
          cleaned.tourSteps++;
        }

        // Delete tour progress
        const progress = await ctx.db
          .query("tourProgress")
          .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
          .collect();
        for (const p of progress) {
          await ctx.db.delete(p._id);
          cleaned.tourProgress++;
        }

        await ctx.db.delete(tour._id);
        cleaned.tours++;
      }
    }

    // Clean up surveys and related data
    const surveys = await ctx.db
      .query("surveys")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    for (const survey of surveys) {
      if (survey.name.startsWith(E2E_TEST_PREFIX)) {
        // Delete survey responses
        const responses = await ctx.db
          .query("surveyResponses")
          .withIndex("by_survey", (q) => q.eq("surveyId", survey._id))
          .collect();
        for (const response of responses) {
          await ctx.db.delete(response._id);
          cleaned.surveyResponses++;
        }

        // Delete survey impressions
        const impressions = await ctx.db
          .query("surveyImpressions")
          .withIndex("by_survey", (q) => q.eq("surveyId", survey._id))
          .collect();
        for (const impression of impressions) {
          await ctx.db.delete(impression._id);
          cleaned.surveyImpressions++;
        }

        await ctx.db.delete(survey._id);
        cleaned.surveys++;
      }
    }

    // Clean up carousels and related data
    const carousels = await ctx.db
      .query("carousels")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    for (const carousel of carousels) {
      if (carousel.name.startsWith(E2E_TEST_PREFIX)) {
        // Delete carousel impressions
        const impressions = await ctx.db
          .query("carouselImpressions")
          .withIndex("by_carousel", (q) => q.eq("carouselId", carousel._id))
          .collect();
        for (const impression of impressions) {
          await ctx.db.delete(impression._id);
          cleaned.carouselImpressions++;
        }

        await ctx.db.delete(carousel._id);
        cleaned.carousels++;
      }
    }

    // Clean up outbound messages and related data
    const outboundMessages = await ctx.db
      .query("outboundMessages")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    for (const message of outboundMessages) {
      if (message.name.startsWith(E2E_TEST_PREFIX)) {
        // Delete message impressions
        const impressions = await ctx.db
          .query("outboundMessageImpressions")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .collect();
        for (const impression of impressions) {
          await ctx.db.delete(impression._id);
          cleaned.outboundMessageImpressions++;
        }

        await ctx.db.delete(message._id);
        cleaned.outboundMessages++;
      }
    }

    // Clean up articles
    const articles = await ctx.db
      .query("articles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    for (const article of articles) {
      if (article.title.startsWith(E2E_TEST_PREFIX) || article.slug.startsWith(E2E_TEST_PREFIX)) {
        await ctx.db.delete(article._id);
        cleaned.articles++;
      }
    }

    // Clean up collections
    const collections = await ctx.db
      .query("collections")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    for (const collection of collections) {
      if (
        collection.name.startsWith(E2E_TEST_PREFIX) ||
        collection.slug.startsWith(E2E_TEST_PREFIX)
      ) {
        await ctx.db.delete(collection._id);
        cleaned.collections++;
      }
    }

    // Clean up segments
    const segments = await ctx.db
      .query("segments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    for (const segment of segments) {
      if (segment.name.startsWith(E2E_TEST_PREFIX)) {
        await ctx.db.delete(segment._id);
        cleaned.segments++;
      }
    }

    // Clean up checklists
    const checklists = await ctx.db
      .query("checklists")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    for (const checklist of checklists) {
      if (checklist.name.startsWith(E2E_TEST_PREFIX)) {
        const progress = await ctx.db
          .query("checklistProgress")
          .withIndex("by_checklist", (q) => q.eq("checklistId", checklist._id))
          .collect();
        for (const p of progress) {
          await ctx.db.delete(p._id);
        }
        await ctx.db.delete(checklist._id);
        cleaned.checklists++;
      }
    }

    // Clean up tooltips
    const tooltips = await ctx.db
      .query("tooltips")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    for (const tooltip of tooltips) {
      if (tooltip.name.startsWith(E2E_TEST_PREFIX)) {
        await ctx.db.delete(tooltip._id);
        cleaned.tooltips++;
      }
    }

    // Clean up snippets
    const snippets = await ctx.db
      .query("snippets")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    for (const snippet of snippets) {
      if (snippet.name.startsWith(E2E_TEST_PREFIX)) {
        await ctx.db.delete(snippet._id);
        cleaned.snippets++;
      }
    }

    // Clean up email campaigns
    const emailCampaigns = await ctx.db
      .query("emailCampaigns")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    for (const campaign of emailCampaigns) {
      if (campaign.name.startsWith(E2E_TEST_PREFIX)) {
        await ctx.db.delete(campaign._id);
        cleaned.emailCampaigns++;
      }
    }

    // Clean up tickets
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    for (const ticket of tickets) {
      if (ticket.subject.startsWith(E2E_TEST_PREFIX)) {
        const comments = await ctx.db
          .query("ticketComments")
          .withIndex("by_ticket", (q) => q.eq("ticketId", ticket._id))
          .collect();
        for (const comment of comments) {
          await ctx.db.delete(comment._id);
        }
        await ctx.db.delete(ticket._id);
        cleaned.tickets++;
      }
    }

    // Clean up visitors with test prefix in session or email
    const visitors = await ctx.db
      .query("visitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    for (const visitor of visitors) {
      if (
        visitor.sessionId.startsWith(E2E_TEST_PREFIX) ||
        (visitor.email && visitor.email.startsWith(E2E_TEST_PREFIX))
      ) {
        // Delete visitor events
        const events = await ctx.db
          .query("events")
          .withIndex("by_visitor", (q) => q.eq("visitorId", visitor._id))
          .collect();
        for (const event of events) {
          await ctx.db.delete(event._id);
        }

        // Delete visitor conversations
        const conversations = await ctx.db
          .query("conversations")
          .withIndex("by_visitor", (q) => q.eq("visitorId", visitor._id))
          .collect();
        for (const conversation of conversations) {
          const messages = await ctx.db
            .query("messages")
            .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
            .collect();
          for (const message of messages) {
            await ctx.db.delete(message._id);
          }
          await ctx.db.delete(conversation._id);
        }

        await ctx.db.delete(visitor._id);
        cleaned.visitors++;
      }
    }

    return { success: true, cleaned };
  },
});

/**
 * Seeds all test data at once for a complete E2E test setup.
 */
export const seedAll = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    requireTestDataEnabled();
    const { workspaceId } = args;
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);

    // Create a test visitor
    const visitorSessionId = `${E2E_TEST_PREFIX}session_${timestamp}_${randomSuffix}`;
    const visitorId = await ctx.db.insert("visitors", {
      sessionId: visitorSessionId,
      workspaceId,
      email: `${E2E_TEST_PREFIX}visitor_${randomSuffix}@test.opencom.dev`,
      name: `E2E Test Visitor`,
      customAttributes: { plan: "pro", signupDate: new Date().toISOString() },
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      createdAt: timestamp,
    });

    await ctx.db.patch(visitorId, {
      readableId: formatReadableVisitorId(visitorId),
    });

    // Create a test tour
    const tourName = `${E2E_TEST_PREFIX}tour_${randomSuffix}`;
    const tourId = await ctx.db.insert("tours", {
      workspaceId,
      name: tourName,
      description: "E2E test tour",
      status: "active",
      displayMode: "first_time_only",
      priority: 100,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await ctx.db.insert("tourSteps", {
      workspaceId,
      tourId,
      type: "post",
      order: 0,
      title: "Welcome",
      content: "Welcome to the test tour!",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // Create a test survey
    const surveyName = `${E2E_TEST_PREFIX}survey_${randomSuffix}`;
    const surveyId = await ctx.db.insert("surveys", {
      workspaceId,
      name: surveyName,
      format: "small",
      status: "active",
      questions: [
        {
          id: `q_${randomSuffix}`,
          type: "nps",
          title: "How likely are you to recommend us?",
          required: true,
        },
      ],
      thankYouStep: {
        title: "Thank you!",
        description: "Your feedback is appreciated.",
      },
      triggers: { type: "immediate" },
      frequency: "once",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    // Create test articles
    const collectionName = `${E2E_TEST_PREFIX}collection_${randomSuffix}`;
    const collectionId = await ctx.db.insert("collections", {
      workspaceId,
      name: collectionName,
      slug: collectionName.toLowerCase().replace(/\s+/g, "-"),
      description: "E2E test collection",
      order: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const articleId = await ctx.db.insert("articles", {
      workspaceId,
      collectionId,
      title: `${E2E_TEST_PREFIX}Getting Started`,
      slug: `${E2E_TEST_PREFIX}getting-started-${randomSuffix}`,
      content: "# Getting Started\n\nWelcome to our platform!",
      status: "published",
      order: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      publishedAt: timestamp,
    });

    // Create test segment
    const segmentName = `${E2E_TEST_PREFIX}segment_${randomSuffix}`;
    const segmentId = await ctx.db.insert("segments", {
      workspaceId,
      name: segmentName,
      description: "E2E test segment",
      audienceRules: {
        type: "group" as const,
        operator: "and" as const,
        conditions: [
          {
            type: "condition" as const,
            property: { source: "system" as const, key: "email" },
            operator: "is_set" as const,
          },
        ],
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return {
      visitorId,
      visitorSessionId,
      tourId,
      surveyId,
      collectionId,
      articleId,
      segmentId,
    };
  },
});

/**
 * Cleans up all E2E test data across all workspaces.
 */
export const cleanupAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    requireTestDataEnabled();
    let totalCleaned = {
      workspaces: 0,
      items: 0,
    };

    // Get all workspaces
    const workspaces = await ctx.db.query("workspaces").collect();

    for (const workspace of workspaces) {
      // Clean up test data in each workspace
      const tours = await ctx.db
        .query("tours")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
        .collect();

      let hasTestData = false;
      for (const tour of tours) {
        if (tour.name.startsWith(E2E_TEST_PREFIX)) {
          hasTestData = true;
          const steps = await ctx.db
            .query("tourSteps")
            .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
            .collect();
          for (const step of steps) {
            await ctx.db.delete(step._id);
            totalCleaned.items++;
          }
          await ctx.db.delete(tour._id);
          totalCleaned.items++;
        }
      }

      const surveys = await ctx.db
        .query("surveys")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
        .collect();

      for (const survey of surveys) {
        if (survey.name.startsWith(E2E_TEST_PREFIX)) {
          hasTestData = true;
          await ctx.db.delete(survey._id);
          totalCleaned.items++;
        }
      }

      const articles = await ctx.db
        .query("articles")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
        .collect();

      for (const article of articles) {
        if (article.title.startsWith(E2E_TEST_PREFIX)) {
          hasTestData = true;
          await ctx.db.delete(article._id);
          totalCleaned.items++;
        }
      }

      const collections = await ctx.db
        .query("collections")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
        .collect();

      for (const collection of collections) {
        if (collection.name.startsWith(E2E_TEST_PREFIX)) {
          hasTestData = true;
          await ctx.db.delete(collection._id);
          totalCleaned.items++;
        }
      }

      const segments = await ctx.db
        .query("segments")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
        .collect();

      for (const segment of segments) {
        if (segment.name.startsWith(E2E_TEST_PREFIX)) {
          hasTestData = true;
          await ctx.db.delete(segment._id);
          totalCleaned.items++;
        }
      }

      const visitors = await ctx.db
        .query("visitors")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
        .collect();

      for (const visitor of visitors) {
        if (visitor.sessionId.startsWith(E2E_TEST_PREFIX)) {
          hasTestData = true;
          await ctx.db.delete(visitor._id);
          totalCleaned.items++;
        }
      }

      if (hasTestData) {
        totalCleaned.workspaces++;
      }
    }

    return { success: true, totalCleaned };
  },
});

/**
 * Clears all tours for a workspace. Used for testing empty state.
 * This is safe for parallel tests as it only affects the specified workspace.
 */
export const clearAllTours = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    requireTestDataEnabled();
    const { workspaceId } = args;
    let deletedCount = 0;

    // Get all tours for this workspace
    const tours = await ctx.db
      .query("tours")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();

    for (const tour of tours) {
      // Delete tour steps first
      const steps = await ctx.db
        .query("tourSteps")
        .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
        .collect();
      for (const step of steps) {
        await ctx.db.delete(step._id);
      }

      // Delete tour progress
      const progress = await ctx.db
        .query("tourProgress")
        .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
        .collect();
      for (const p of progress) {
        await ctx.db.delete(p._id);
      }

      // Delete the tour
      await ctx.db.delete(tour._id);
      deletedCount++;
    }

    return { success: true, deletedCount };
  },
});

/**
 * Seeds comprehensive demo data for screenshot automation.
 * Creates realistic data across all major features so screenshots
 * show a "full" workspace state.
 *
 * Use SEED_DATA=true with the screenshot scripts to invoke this.
 */
export const seedDemoData = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    requireTestDataEnabled();
    const { workspaceId } = args;
    const now = Date.now();
    const DAY = 86400000;

    // ── Clean up stale e2e_test segments from previous runs ────────
    const oldSegments = await ctx.db
      .query("segments")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const seg of oldSegments) {
      if (seg.name.startsWith(E2E_TEST_PREFIX)) {
        await ctx.db.delete(seg._id);
      }
    }

    // ── Visitors ────────────────────────────────────────────────────
    const visitors: Id<"visitors">[] = [];
    const visitorProfiles = [
      {
        name: "Sarah Chen",
        email: "sarah.chen@acme.io",
        city: "San Francisco",
        country: "United States",
        countryCode: "US",
        browser: "Chrome",
        os: "macOS",
        plan: "pro",
        company: "Acme Inc",
      },
      {
        name: "Marcus Johnson",
        email: "marcus@techstart.co",
        city: "Austin",
        country: "United States",
        countryCode: "US",
        browser: "Firefox",
        os: "Windows",
        plan: "free",
        company: "TechStart",
      },
      {
        name: "Priya Sharma",
        email: "priya@globalcorp.com",
        city: "London",
        country: "United Kingdom",
        countryCode: "GB",
        browser: "Safari",
        os: "macOS",
        plan: "enterprise",
        company: "GlobalCorp",
      },
      {
        name: "Alex Rivera",
        email: "alex@designhub.io",
        city: "New York",
        country: "United States",
        countryCode: "US",
        browser: "Chrome",
        os: "Windows",
        plan: "pro",
        company: "DesignHub",
      },
      {
        name: "Emma Wilson",
        email: "emma@retailplus.com",
        city: "Toronto",
        country: "Canada",
        countryCode: "CA",
        browser: "Edge",
        os: "Windows",
        plan: "free",
        company: "RetailPlus",
      },
      {
        name: "Kenji Tanaka",
        email: "kenji@appsol.jp",
        city: "Tokyo",
        country: "Japan",
        countryCode: "JP",
        browser: "Chrome",
        os: "macOS",
        plan: "pro",
        company: "AppSolutions",
      },
    ];

    for (let i = 0; i < visitorProfiles.length; i++) {
      const p = visitorProfiles[i];
      const vid = await ctx.db.insert("visitors", {
        sessionId: `${E2E_TEST_PREFIX}demo_session_${i}`,
        workspaceId,
        email: p.email,
        name: p.name,
        customAttributes: {
          plan: p.plan,
          company: p.company,
          signupDate: new Date(now - (i + 1) * 7 * DAY).toISOString(),
        },
        location: { city: p.city, country: p.country, countryCode: p.countryCode },
        device: { browser: p.browser, os: p.os, deviceType: "desktop" },
        firstSeenAt: now - (i + 1) * 7 * DAY,
        lastSeenAt: now - i * DAY,
        createdAt: now - (i + 1) * 7 * DAY,
      });
      await ctx.db.patch(vid, {
        readableId: formatReadableVisitorId(vid),
      });
      visitors.push(vid);
    }

    // ── Conversations + Messages ────────────────────────────────────
    const conversationData = [
      {
        visitorIdx: 0,
        status: "open" as const,
        msgs: [
          {
            sender: "visitor",
            content: "Hi! I'm having trouble setting up the API integration. Can you help?",
          },
          {
            sender: "bot",
            content:
              "Of course! I'd be happy to help with API integration. Could you tell me which endpoint you're working with?",
          },
          { sender: "visitor", content: "The webhooks endpoint — I keep getting 401 errors." },
        ],
      },
      {
        visitorIdx: 1,
        status: "open" as const,
        msgs: [
          { sender: "visitor", content: "Is there a way to export my analytics data as CSV?" },
          {
            sender: "bot",
            content:
              "Yes! You can export analytics from the Reports page. Click the export icon in the top right corner.",
          },
        ],
      },
      {
        visitorIdx: 2,
        status: "closed" as const,
        msgs: [
          {
            sender: "visitor",
            content: "We need to upgrade our plan to Enterprise. Who should I contact?",
          },
          {
            sender: "bot",
            content:
              "I'll connect you with our sales team right away. They typically respond within an hour.",
          },
          { sender: "visitor", content: "Great, thank you!" },
        ],
      },
      {
        visitorIdx: 3,
        status: "open" as const,
        msgs: [
          {
            sender: "visitor",
            content: "The tooltip builder is not loading on our staging environment.",
          },
        ],
      },
      {
        visitorIdx: 4,
        status: "snoozed" as const,
        msgs: [
          { sender: "visitor", content: "Can we customise the widget colours to match our brand?" },
          {
            sender: "bot",
            content:
              "Absolutely! Go to Settings → Messenger and update the primary colour. Changes apply instantly.",
          },
          { sender: "visitor", content: "Perfect, I'll try that after our deploy on Monday." },
        ],
      },
    ];

    const conversationIds: Id<"conversations">[] = [];
    for (const conv of conversationData) {
      const createdAt = now - (5 - conv.visitorIdx) * DAY;
      const cid = await ctx.db.insert("conversations", {
        workspaceId,
        visitorId: visitors[conv.visitorIdx],
        status: conv.status,
        createdAt,
        updatedAt: createdAt + conv.msgs.length * 60000,
        lastMessageAt: createdAt + conv.msgs.length * 60000,
        unreadByAgent: conv.status === "open" ? 1 : 0,
      });
      conversationIds.push(cid);

      for (let j = 0; j < conv.msgs.length; j++) {
        const m = conv.msgs[j];
        await ctx.db.insert("messages", {
          conversationId: cid,
          senderId:
            m.sender === "visitor" ? (visitors[conv.visitorIdx] as unknown as string) : "system",
          senderType: m.sender === "visitor" ? "visitor" : "bot",
          content: m.content,
          createdAt: createdAt + j * 60000,
        });
      }
    }

    // ── Tickets ──────────────────────────────────────────────────────
    const ticketData = [
      {
        visitorIdx: 0,
        subject: "API webhook returns 401 Unauthorized",
        priority: "high" as const,
        status: "in_progress" as const,
      },
      {
        visitorIdx: 1,
        subject: "CSV export missing date column",
        priority: "normal" as const,
        status: "submitted" as const,
      },
      {
        visitorIdx: 2,
        subject: "Enterprise plan upgrade request",
        priority: "normal" as const,
        status: "resolved" as const,
      },
      {
        visitorIdx: 3,
        subject: "Tooltip builder blank on staging",
        priority: "high" as const,
        status: "submitted" as const,
      },
      {
        visitorIdx: 4,
        subject: "Widget colour customisation help",
        priority: "low" as const,
        status: "waiting_on_customer" as const,
      },
      {
        visitorIdx: 5,
        subject: "SDK initialisation error on iOS 17",
        priority: "urgent" as const,
        status: "in_progress" as const,
      },
    ];

    for (let i = 0; i < ticketData.length; i++) {
      const t = ticketData[i];
      await ctx.db.insert("tickets", {
        workspaceId,
        visitorId: visitors[t.visitorIdx],
        subject: `${E2E_TEST_PREFIX}${t.subject}`,
        description: `Customer reported: ${t.subject}`,
        status: t.status,
        priority: t.priority,
        createdAt: now - (6 - i) * DAY,
        updatedAt: now - i * DAY,
        resolvedAt: t.status === "resolved" ? now - i * DAY : undefined,
      });
    }

    // ── Articles + Collections ───────────────────────────────────────
    const collections = [
      {
        name: "Getting Started",
        desc: "Everything you need to begin",
        articles: [
          {
            title: "Quick Start Guide",
            content:
              "# Quick Start Guide\n\nWelcome to Opencom! Follow these steps to get started in under 5 minutes.\n\n## Step 1: Install the Widget\n\nAdd the JavaScript snippet to your website's `<head>` tag.\n\n## Step 2: Configure Your Messenger\n\nCustomise colours, welcome message, and team availability.\n\n## Step 3: Start Conversations\n\nYour visitors can now reach you through the widget!",
          },
          {
            title: "Installing the Widget",
            content:
              '# Installing the Widget\n\nThe Opencom widget can be installed on any website.\n\n## HTML Installation\n\n```html\n<script src="https://widget.opencom.dev/v1.js"></script>\n```\n\n## React Installation\n\n```bash\nnpm install @opencom/react\n```\n\nSee the SDK documentation for framework-specific guides.',
          },
          {
            title: "Setting Up Your Team",
            content:
              "# Setting Up Your Team\n\nInvite your team members and assign roles.\n\n## Roles\n\n- **Owner**: Full access\n- **Admin**: Manage settings and team\n- **Agent**: Handle conversations and tickets",
          },
        ],
      },
      {
        name: "Messaging & Inbox",
        desc: "Managing conversations and messages",
        articles: [
          {
            title: "Using the Inbox",
            content:
              "# Using the Inbox\n\nThe inbox is your central hub for all customer conversations.\n\n## Filtering Conversations\n\nUse the sidebar filters to view open, closed, or snoozed conversations.\n\n## Assigning Conversations\n\nClick the assignee dropdown to route conversations to specific agents.",
          },
          {
            title: "Outbound Messages",
            content:
              "# Outbound Messages\n\nSend targeted messages to your users based on behaviour and attributes.\n\n## Message Types\n\n- **Chat**: Appears as a chat bubble\n- **Post**: Rich content card\n- **Banner**: Top or bottom bar\n\n## Targeting\n\nUse audience rules to show messages to specific segments.",
          },
        ],
      },
      {
        name: "Help Center",
        desc: "Build a self-service knowledge base",
        articles: [
          {
            title: "Creating Articles",
            content:
              "# Creating Articles\n\nWrite help articles with our rich text editor.\n\n## Markdown Support\n\nArticles support full Markdown including code blocks, tables, and images.\n\n## Publishing\n\nSave as draft or publish immediately. Published articles appear in the widget.",
          },
          {
            title: "Organising Collections",
            content:
              "# Organising Collections\n\nGroup related articles into collections for easy browsing.\n\n## Collection Icons\n\nChoose an icon for each collection to make navigation intuitive.\n\n## Ordering\n\nDrag and drop to reorder collections and articles.",
          },
        ],
      },
    ];

    for (let ci = 0; ci < collections.length; ci++) {
      const c = collections[ci];
      const slug = `${E2E_TEST_PREFIX}${c.name.toLowerCase().replace(/\s+/g, "-")}`;
      const collectionId = await ctx.db.insert("collections", {
        workspaceId,
        name: `${E2E_TEST_PREFIX}${c.name}`,
        slug,
        description: c.desc,
        order: ci,
        createdAt: now - 30 * DAY,
        updatedAt: now,
      });

      for (let ai = 0; ai < c.articles.length; ai++) {
        const a = c.articles[ai];
        await ctx.db.insert("articles", {
          workspaceId,
          collectionId,
          title: `${E2E_TEST_PREFIX}${a.title}`,
          slug: `${E2E_TEST_PREFIX}${a.title.toLowerCase().replace(/\s+/g, "-")}-${ci}-${ai}`,
          content: a.content,
          status: "published",
          order: ai,
          createdAt: now - 30 * DAY + ai * DAY,
          updatedAt: now,
          publishedAt: now - 30 * DAY + ai * DAY,
        });
      }
    }

    // ── Snippets ─────────────────────────────────────────────────────
    const snippetData = [
      {
        name: "Greeting",
        shortcut: "hi",
        content: "Hi there! Thanks for reaching out. How can I help you today?",
      },
      {
        name: "Escalation",
        shortcut: "esc",
        content:
          "I'm going to loop in a specialist who can help with this. They'll follow up shortly.",
      },
      {
        name: "Follow Up",
        shortcut: "fu",
        content:
          "Just checking in — were you able to resolve the issue? Let me know if you need any further help.",
      },
      {
        name: "Closing",
        shortcut: "close",
        content: "Glad I could help! Feel free to reach out any time. Have a great day!",
      },
      {
        name: "Bug Report Ack",
        shortcut: "bug",
        content:
          "Thanks for reporting this. I've created a ticket and our engineering team will investigate. I'll keep you posted on progress.",
      },
    ];

    for (const s of snippetData) {
      await ctx.db.insert("snippets", {
        workspaceId,
        name: `${E2E_TEST_PREFIX}${s.name}`,
        shortcut: s.shortcut,
        content: s.content,
        createdAt: now - 14 * DAY,
        updatedAt: now,
      });
    }

    // ── Outbound Messages ────────────────────────────────────────────
    const outboundData = [
      {
        name: "Welcome Chat",
        type: "chat" as const,
        status: "active" as const,
        text: "Welcome! Let us know if you need help getting started.",
      },
      {
        name: "Feature Announcement",
        type: "post" as const,
        status: "active" as const,
        title: "New: AI-Powered Suggestions",
        body: "Our AI agent can now suggest help articles to your visitors automatically.",
      },
      {
        name: "Upgrade Banner",
        type: "banner" as const,
        status: "active" as const,
        text: "Unlock advanced analytics — upgrade to Pro today.",
      },
      {
        name: "Feedback Request",
        type: "chat" as const,
        status: "draft" as const,
        text: "We'd love to hear your feedback! How has your experience been so far?",
      },
    ];

    for (let i = 0; i < outboundData.length; i++) {
      const o = outboundData[i];
      const content: Record<string, unknown> = {};
      if (o.type === "chat") {
        content.text = o.text;
      } else if (o.type === "post") {
        content.title = o.title;
        content.body = o.body;
      } else {
        content.text = o.text;
        content.style = "floating";
        content.dismissible = true;
      }

      await ctx.db.insert("outboundMessages", {
        workspaceId,
        name: `${E2E_TEST_PREFIX}${o.name}`,
        type: o.type,
        content: content as any,
        status: o.status,
        triggers: { type: "immediate" },
        frequency: "once",
        priority: 100 - i * 10,
        createdAt: now - (10 - i) * DAY,
        updatedAt: now,
      });
    }

    // ── Tours ────────────────────────────────────────────────────────
    const tourData = [
      {
        name: "Product Walkthrough",
        status: "active" as const,
        targetPageUrl: undefined as string | undefined,
        steps: [
          {
            type: "post" as const,
            title: "Welcome to Opencom!",
            content: "Let us show you around the key features.",
          },
          {
            type: "pointer" as const,
            title: "Your Inbox",
            content: "All customer conversations land here.",
            elementSelector: "[data-testid='nav-inbox']",
          },
          {
            type: "pointer" as const,
            title: "Knowledge Base",
            content: "Create help articles for self-service.",
            elementSelector: "[data-testid='nav-knowledge']",
          },
        ],
      },
      {
        name: "Widget Demo Tour",
        status: "active" as const,
        targetPageUrl: "*widget-demo*",
        steps: [
          {
            type: "post" as const,
            title: "Welcome to Opencom!",
            content: "Let us give you a quick tour of our platform and show you the key features.",
          },
          {
            type: "pointer" as const,
            title: "Tour Target 1",
            content: "This is the first interactive element you can explore.",
            elementSelector: "#tour-target-1",
          },
          {
            type: "pointer" as const,
            title: "Tour Target 2",
            content: "Here's another feature worth checking out.",
            elementSelector: "#tour-target-2",
          },
          {
            type: "pointer" as const,
            title: "Tour Target 3",
            content: "And one more thing to discover!",
            elementSelector: "#tour-target-3",
          },
        ],
      },
      {
        name: "Inbox Tour",
        status: "active" as const,
        targetPageUrl: undefined as string | undefined,
        steps: [
          {
            type: "post" as const,
            title: "Master Your Inbox",
            content: "Learn how to manage conversations efficiently.",
          },
          {
            type: "pointer" as const,
            title: "Filters",
            content: "Filter by status, assignee, or channel.",
            elementSelector: "[data-testid='inbox-filters']",
          },
        ],
      },
      {
        name: "Settings Tour",
        status: "draft" as const,
        targetPageUrl: undefined as string | undefined,
        steps: [
          {
            type: "post" as const,
            title: "Customise Your Workspace",
            content: "Adjust settings to match your workflow.",
          },
        ],
      },
    ];

    for (let i = 0; i < tourData.length; i++) {
      const t = tourData[i];
      const tourId = await ctx.db.insert("tours", {
        workspaceId,
        name: `${E2E_TEST_PREFIX}${t.name}`,
        description: `Demo tour: ${t.name}`,
        status: t.status,
        targetingRules: t.targetPageUrl ? { pageUrl: t.targetPageUrl } : undefined,
        displayMode: "first_time_only",
        priority: 100 - i * 10,
        createdAt: now - 20 * DAY,
        updatedAt: now,
      });

      for (let si = 0; si < t.steps.length; si++) {
        const s = t.steps[si];
        await ctx.db.insert("tourSteps", {
          workspaceId: args.workspaceId,
          tourId,
          type: s.type,
          order: si,
          title: s.title,
          content: s.content,
          elementSelector: "elementSelector" in s ? s.elementSelector : undefined,
          position: "auto",
          advanceOn: "click",
          createdAt: now - 20 * DAY,
          updatedAt: now,
        });
      }
    }

    // ── Surveys ──────────────────────────────────────────────────────
    const surveyData = [
      {
        name: "NPS Survey",
        format: "small" as const,
        status: "active" as const,
        qType: "nps" as const,
        qTitle: "How likely are you to recommend Opencom?",
      },
      {
        name: "Feature Satisfaction",
        format: "large" as const,
        status: "active" as const,
        qType: "star_rating" as const,
        qTitle: "How would you rate our product tours feature?",
      },
      {
        name: "Onboarding Feedback",
        format: "small" as const,
        status: "draft" as const,
        qType: "multiple_choice" as const,
        qTitle: "How did you hear about us?",
      },
    ];

    for (const s of surveyData) {
      await ctx.db.insert("surveys", {
        workspaceId,
        name: `${E2E_TEST_PREFIX}${s.name}`,
        description: `Demo survey: ${s.name}`,
        format: s.format,
        status: s.status,
        questions: [
          {
            id: `q_demo_${s.name.toLowerCase().replace(/\s+/g, "_")}`,
            type: s.qType as
              | "nps"
              | "numeric_scale"
              | "star_rating"
              | "emoji_rating"
              | "dropdown"
              | "short_text"
              | "long_text"
              | "multiple_choice",
            title: s.qTitle,
            required: true,
            ...(s.qType === "multiple_choice"
              ? {
                  options: {
                    choices: [
                      "Google Search",
                      "Friend or Colleague",
                      "Social Media",
                      "Blog Post",
                      "Other",
                    ],
                  },
                }
              : {}),
          },
        ],
        introStep:
          s.format === "large"
            ? {
                title: s.name,
                description: "Help us improve by sharing your feedback",
                buttonText: "Start",
              }
            : undefined,
        thankYouStep: { title: "Thank you!", description: "Your feedback helps us improve." },
        triggers: { type: "immediate" },
        frequency: "once",
        createdAt: now - 15 * DAY,
        updatedAt: now,
      });
    }

    // ── Checklists ───────────────────────────────────────────────────
    await ctx.db.insert("checklists", {
      workspaceId,
      name: `${E2E_TEST_PREFIX}Onboarding Checklist`,
      description: "Get started with Opencom in 5 easy steps",
      tasks: [
        {
          id: "task_1",
          title: "Install the widget",
          description: "Add the snippet to your site",
          completionType: "manual",
        },
        {
          id: "task_2",
          title: "Customise your messenger",
          description: "Set brand colours and welcome message",
          completionType: "manual",
        },
        {
          id: "task_3",
          title: "Create your first article",
          description: "Write a help article for your users",
          completionType: "manual",
        },
        {
          id: "task_4",
          title: "Invite a teammate",
          description: "Add a colleague to your workspace",
          completionType: "manual",
        },
        {
          id: "task_5",
          title: "Send your first message",
          description: "Create an outbound message",
          completionType: "manual",
        },
      ],
      status: "active",
      createdAt: now - 14 * DAY,
      updatedAt: now,
    });

    await ctx.db.insert("checklists", {
      workspaceId,
      name: `${E2E_TEST_PREFIX}Advanced Setup`,
      description: "Unlock the full power of Opencom",
      tasks: [
        {
          id: "task_a1",
          title: "Set up audience segments",
          description: "Target users by attributes",
          completionType: "manual",
        },
        {
          id: "task_a2",
          title: "Create a product tour",
          description: "Guide users through features",
          completionType: "manual",
        },
        {
          id: "task_a3",
          title: "Configure AI agent",
          description: "Enable AI-powered responses",
          completionType: "manual",
        },
      ],
      status: "draft",
      createdAt: now - 7 * DAY,
      updatedAt: now,
    });

    // ── Tooltips ─────────────────────────────────────────────────────
    const tooltipData = [
      {
        name: "Inbox Filter Tip",
        selector: "[data-testid='inbox-filters']",
        content: "Use filters to quickly find conversations by status or assignee.",
        trigger: "hover" as const,
      },
      {
        name: "New Article Tip",
        selector: "[data-testid='new-article-btn']",
        content: "Click here to create a new help article for your knowledge base.",
        trigger: "hover" as const,
      },
      {
        name: "Export Data Tip",
        selector: "[data-testid='export-btn']",
        content: "Export your data as CSV or JSON for reporting.",
        trigger: "click" as const,
      },
    ];

    for (const t of tooltipData) {
      await ctx.db.insert("tooltips", {
        workspaceId,
        name: `${E2E_TEST_PREFIX}${t.name}`,
        elementSelector: t.selector,
        content: t.content,
        triggerType: t.trigger,
        createdAt: now - 10 * DAY,
        updatedAt: now,
      });
    }

    // ── Segments ─────────────────────────────────────────────────────
    const segmentData = [
      {
        name: "Active Users",
        desc: "Users seen in the last 7 days",
        rules: {
          type: "group" as const,
          operator: "and" as const,
          conditions: [
            {
              type: "condition" as const,
              property: { source: "system" as const, key: "lastSeenAt" },
              operator: "greater_than" as const,
              value: now - 7 * DAY,
            },
          ],
        },
      },
      {
        name: "Pro Plan Users",
        desc: "Users on the Pro plan",
        rules: {
          type: "group" as const,
          operator: "and" as const,
          conditions: [
            {
              type: "condition" as const,
              property: { source: "custom" as const, key: "plan" },
              operator: "equals" as const,
              value: "pro",
            },
          ],
        },
      },
      {
        name: "Enterprise Leads",
        desc: "Enterprise plan users",
        rules: {
          type: "group" as const,
          operator: "and" as const,
          conditions: [
            {
              type: "condition" as const,
              property: { source: "custom" as const, key: "plan" },
              operator: "equals" as const,
              value: "enterprise",
            },
          ],
        },
      },
    ];

    for (const s of segmentData) {
      await ctx.db.insert("segments", {
        workspaceId,
        name: `${E2E_TEST_PREFIX}${s.name}`,
        description: s.desc,
        audienceRules: s.rules,
        createdAt: now - 14 * DAY,
        updatedAt: now,
      });
    }

    // ── Email Campaigns ──────────────────────────────────────────────
    const campaignData = [
      {
        name: "Welcome Email",
        subject: "Welcome to Opencom!",
        status: "sent" as const,
        content: "<h1>Welcome!</h1><p>Thanks for signing up. Here's how to get started...</p>",
        stats: {
          pending: 0,
          sent: 1240,
          delivered: 1210,
          opened: 845,
          clicked: 320,
          bounced: 12,
          unsubscribed: 3,
        },
      },
      {
        name: "Feature Update",
        subject: "New: AI Agent is here",
        status: "sent" as const,
        content: "<h1>AI Agent</h1><p>Your visitors can now get instant answers powered by AI.</p>",
        stats: {
          pending: 0,
          sent: 980,
          delivered: 965,
          opened: 612,
          clicked: 198,
          bounced: 5,
          unsubscribed: 1,
        },
      },
      {
        name: "Re-engagement",
        subject: "We miss you!",
        status: "draft" as const,
        content: "<h1>Come back!</h1><p>It's been a while. See what's new...</p>",
        stats: undefined,
      },
    ];

    for (const c of campaignData) {
      await ctx.db.insert("emailCampaigns", {
        workspaceId,
        name: `${E2E_TEST_PREFIX}${c.name}`,
        subject: c.subject,
        content: c.content,
        status: c.status,
        stats: c.stats,
        sentAt: c.status === "sent" ? now - 3 * DAY : undefined,
        createdAt: now - 10 * DAY,
        updatedAt: now,
      });
    }

    // ── Messenger Settings ───────────────────────────────────────────
    const existingSettings = await ctx.db
      .query("messengerSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, {
        primaryColor: "#792cd4",
        backgroundColor: "#792cd4",
        welcomeMessage: "Hi there! How can we help you today?",
        launcherPosition: "right",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("messengerSettings", {
        workspaceId,
        primaryColor: "#792cd4",
        backgroundColor: "#792cd4",
        themeMode: "light",
        launcherPosition: "right",
        launcherSideSpacing: 20,
        launcherBottomSpacing: 20,
        showLauncher: true,
        welcomeMessage: "Hi there! How can we help you today?",
        showTeammateAvatars: true,
        supportedLanguages: ["en"],
        defaultLanguage: "en",
        mobileEnabled: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    // ── AI Agent Settings ────────────────────────────────────────────
    const existingAI = await ctx.db
      .query("aiAgentSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    if (!existingAI) {
      await ctx.db.insert("aiAgentSettings", {
        workspaceId,
        enabled: true,
        knowledgeSources: ["articles"],
        confidenceThreshold: 0.7,
        personality: "helpful and friendly",
        handoffMessage: "Let me connect you with a human agent.",
        model: "gpt-5-nano",
        suggestionsEnabled: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      visitors: visitors.length,
      conversations: conversationIds.length,
      tickets: ticketData.length,
      articles: collections.reduce((sum, c) => sum + c.articles.length, 0),
      collections: collections.length,
      snippets: snippetData.length,
      outboundMessages: outboundData.length,
      tours: tourData.length,
      surveys: surveyData.length,
      checklists: 2,
      tooltips: tooltipData.length,
      segments: segmentData.length,
      emailCampaigns: campaignData.length,
    };
  },
});

/**
 * Gets the count of tours for a workspace. Used for testing.
 */
export const getTourCount = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    requireTestDataEnabled();
    const tours = await ctx.db
      .query("tours")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    return { count: tours.length };
  },
});

const LANDING_DEMO_PREFIX = "LANDING_DEMO_";

/**
 * Cleans up all landing demo data from a workspace.
 */
export const cleanupLandingDemo = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    requireTestDataEnabled();
    const { workspaceId } = args;
    let cleaned = {
      tours: 0,
      tourSteps: 0,
      checklists: 0,
      articles: 0,
      collections: 0,
      outboundMessages: 0,
      surveys: 0,
      tooltips: 0,
    };

    // Clean up tours and steps
    const tours = await ctx.db
      .query("tours")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const tour of tours) {
      if (tour.name.startsWith(LANDING_DEMO_PREFIX)) {
        const steps = await ctx.db
          .query("tourSteps")
          .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
          .collect();
        for (const step of steps) {
          await ctx.db.delete(step._id);
          cleaned.tourSteps++;
        }
        const progress = await ctx.db
          .query("tourProgress")
          .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
          .collect();
        for (const p of progress) {
          await ctx.db.delete(p._id);
        }
        await ctx.db.delete(tour._id);
        cleaned.tours++;
      }
    }

    // Clean up checklists
    const checklists = await ctx.db
      .query("checklists")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const checklist of checklists) {
      if (checklist.name.startsWith(LANDING_DEMO_PREFIX)) {
        const progress = await ctx.db
          .query("checklistProgress")
          .withIndex("by_checklist", (q) => q.eq("checklistId", checklist._id))
          .collect();
        for (const p of progress) {
          await ctx.db.delete(p._id);
        }
        await ctx.db.delete(checklist._id);
        cleaned.checklists++;
      }
    }

    // Clean up articles
    const articles = await ctx.db
      .query("articles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const article of articles) {
      if (article.title.startsWith(LANDING_DEMO_PREFIX)) {
        await ctx.db.delete(article._id);
        cleaned.articles++;
      }
    }

    // Clean up collections
    const collections = await ctx.db
      .query("collections")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const collection of collections) {
      if (collection.name.startsWith(LANDING_DEMO_PREFIX)) {
        await ctx.db.delete(collection._id);
        cleaned.collections++;
      }
    }

    // Clean up outbound messages
    const outboundMessages = await ctx.db
      .query("outboundMessages")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const message of outboundMessages) {
      if (message.name.startsWith(LANDING_DEMO_PREFIX)) {
        const impressions = await ctx.db
          .query("outboundMessageImpressions")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
          .collect();
        for (const imp of impressions) {
          await ctx.db.delete(imp._id);
        }
        await ctx.db.delete(message._id);
        cleaned.outboundMessages++;
      }
    }

    // Clean up surveys
    const surveys = await ctx.db
      .query("surveys")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const survey of surveys) {
      if (survey.name.startsWith(LANDING_DEMO_PREFIX)) {
        const responses = await ctx.db
          .query("surveyResponses")
          .withIndex("by_survey", (q) => q.eq("surveyId", survey._id))
          .collect();
        for (const r of responses) {
          await ctx.db.delete(r._id);
        }
        const impressions = await ctx.db
          .query("surveyImpressions")
          .withIndex("by_survey", (q) => q.eq("surveyId", survey._id))
          .collect();
        for (const imp of impressions) {
          await ctx.db.delete(imp._id);
        }
        await ctx.db.delete(survey._id);
        cleaned.surveys++;
      }
    }

    // Clean up tooltips
    const tooltips = await ctx.db
      .query("tooltips")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const tooltip of tooltips) {
      if (tooltip.name.startsWith(LANDING_DEMO_PREFIX)) {
        await ctx.db.delete(tooltip._id);
        cleaned.tooltips++;
      }
    }

    return { success: true, cleaned };
  },
});

/**
 * Seeds curated demo content for the landing page workspace.
 * Idempotent — cleans up previous landing demo data before re-seeding.
 */
export const seedLandingDemo = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    requireTestDataEnabled();
    const { workspaceId } = args;
    const now = Date.now();
    const DAY = 86400000;

    // ── Idempotent: clean up previous landing demo data ──────────
    const oldTours = await ctx.db
      .query("tours")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const tour of oldTours) {
      if (tour.name.startsWith(LANDING_DEMO_PREFIX)) {
        const steps = await ctx.db
          .query("tourSteps")
          .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
          .collect();
        for (const s of steps) await ctx.db.delete(s._id);
        const prog = await ctx.db
          .query("tourProgress")
          .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
          .collect();
        for (const p of prog) await ctx.db.delete(p._id);
        await ctx.db.delete(tour._id);
      }
    }
    const oldChecklists = await ctx.db
      .query("checklists")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const c of oldChecklists) {
      if (c.name.startsWith(LANDING_DEMO_PREFIX)) {
        const prog = await ctx.db
          .query("checklistProgress")
          .withIndex("by_checklist", (q) => q.eq("checklistId", c._id))
          .collect();
        for (const p of prog) await ctx.db.delete(p._id);
        await ctx.db.delete(c._id);
      }
    }
    const oldArticles = await ctx.db
      .query("articles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const a of oldArticles) {
      if (a.title.startsWith(LANDING_DEMO_PREFIX)) await ctx.db.delete(a._id);
    }
    const oldCollections = await ctx.db
      .query("collections")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const c of oldCollections) {
      if (c.name.startsWith(LANDING_DEMO_PREFIX)) await ctx.db.delete(c._id);
    }
    const oldOutbound = await ctx.db
      .query("outboundMessages")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const m of oldOutbound) {
      if (m.name.startsWith(LANDING_DEMO_PREFIX)) {
        const imps = await ctx.db
          .query("outboundMessageImpressions")
          .withIndex("by_message", (q) => q.eq("messageId", m._id))
          .collect();
        for (const i of imps) await ctx.db.delete(i._id);
        await ctx.db.delete(m._id);
      }
    }
    const oldSurveys = await ctx.db
      .query("surveys")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const s of oldSurveys) {
      if (s.name.startsWith(LANDING_DEMO_PREFIX)) {
        const resp = await ctx.db
          .query("surveyResponses")
          .withIndex("by_survey", (q) => q.eq("surveyId", s._id))
          .collect();
        for (const r of resp) await ctx.db.delete(r._id);
        const imps = await ctx.db
          .query("surveyImpressions")
          .withIndex("by_survey", (q) => q.eq("surveyId", s._id))
          .collect();
        for (const i of imps) await ctx.db.delete(i._id);
        await ctx.db.delete(s._id);
      }
    }
    const oldTooltips = await ctx.db
      .query("tooltips")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    for (const t of oldTooltips) {
      if (t.name.startsWith(LANDING_DEMO_PREFIX)) await ctx.db.delete(t._id);
    }

    // ── Product Tour ─────────────────────────────────────────────
    const tourId = await ctx.db.insert("tours", {
      workspaceId,
      name: `${LANDING_DEMO_PREFIX}Landing Page Tour`,
      description: "Interactive tour of the Opencom landing page",
      status: "active",
      targetingRules: undefined,
      displayMode: "first_time_only",
      priority: 100,
      createdAt: now - 7 * DAY,
      updatedAt: now,
    });

    const tourSteps = [
      {
        type: "post" as const,
        title: "Welcome to Opencom!",
        content: "Let us give you a quick tour of the open-source customer messaging platform.",
      },
      {
        type: "pointer" as const,
        title: "Launch the Hosted Demo",
        content: "Start here to open a live Opencom workspace and explore the product in minutes.",
        elementSelector: "[data-tour-target='hero-primary-cta']",
      },
      {
        type: "pointer" as const,
        title: "Explore the Platform",
        content:
          "Shared inbox, product tours, tickets, outbound messages, and AI agent workflows run on one real-time stack.",
        elementSelector: "[data-tour-target='features-section']",
      },
      {
        type: "pointer" as const,
        title: "Native Product Tours",
        content:
          "Opencom tours attach to real UI elements, so onboarding remains fast and resilient as your app evolves.",
        elementSelector: "[data-tour-target='showcase-product-tour']",
      },
      {
        type: "pointer" as const,
        title: "Ready to Build",
        content:
          "Jump into the hosted onboarding flow and start shipping your own customer messaging stack.",
        elementSelector: "[data-tour-target='final-cta-primary']",
      },
    ];

    const stepIds: Id<"tourSteps">[] = [];
    for (let i = 0; i < tourSteps.length; i++) {
      const s = tourSteps[i];
      const stepId = await ctx.db.insert("tourSteps", {
        workspaceId: workspaceId,
        tourId,
        type: s.type,
        order: i,
        title: s.title,
        content: s.content,
        elementSelector: s.elementSelector,
        position: "auto",
        advanceOn: "click",
        createdAt: now - 7 * DAY,
        updatedAt: now,
      });
      stepIds.push(stepId);
    }

    // ── Checklist ────────────────────────────────────────────────
    const checklistId = await ctx.db.insert("checklists", {
      workspaceId,
      name: `${LANDING_DEMO_PREFIX}Explore Opencom`,
      description: "Discover the key features of the open-source customer messaging platform",
      tasks: [
        {
          id: "task_1",
          title: "Take the guided tour",
          description: "Walk through the landing page highlights",
          completionType: "manual",
        },
        {
          id: "task_2",
          title: "Browse the knowledge base",
          description: "Read help articles in the widget Help tab",
          completionType: "manual",
        },
        {
          id: "task_3",
          title: "Start a conversation",
          description: "Send a message through the chat widget",
          completionType: "manual",
        },
        {
          id: "task_4",
          title: "Check out the docs",
          description: "Visit the documentation to learn about deployment",
          completionType: "manual",
        },
        {
          id: "task_5",
          title: "Star us on GitHub",
          description: "Show your support by starring the repository",
          completionType: "manual",
        },
      ],
      status: "active",
      createdAt: now - 7 * DAY,
      updatedAt: now,
    });

    // ── Knowledge Base ───────────────────────────────────────────
    const collectionsData = [
      {
        name: "Getting Started",
        desc: "Everything you need to deploy and configure Opencom",
        articles: [
          {
            title: "Quick Start Guide",
            content:
              "# Quick Start Guide\n\nGet Opencom up and running in under 5 minutes.\n\n## 1. Clone the Repository\n\n```bash\ngit clone https://github.com/opencom-org/opencom.git\ncd opencom\npnpm install\n```\n\n## 2. Set Up Convex\n\nCreate a Convex project and configure your environment variables.\n\n## 3. Start the Dev Server\n\n```bash\npnpm dev\n```\n\nYour workspace is now live with live chat, product tours, surveys, and more.",
          },
          {
            title: "Widget Installation",
            content:
              "# Widget Installation\n\nEmbed the Opencom widget on any website.\n\n## Script Tag\n\n```html\n<script src=\"https://your-domain.com/opencom-widget.iife.js\"></script>\n<script>\n  OpencomWidget.init({\n    workspaceId: 'your-workspace-id',\n    convexUrl: 'https://your-convex-url.convex.cloud'\n  });\n</script>\n```\n\n## React / Next.js\n\nUse the `@opencom/react-native-sdk` package for React Native apps, or load the widget script in your layout.",
          },
          {
            title: "Configuring Your Messenger",
            content:
              "# Configuring Your Messenger\n\nCustomise the widget appearance and behaviour.\n\n## Brand Colours\n\nSet your primary colour in **Settings → Messenger** to match your brand.\n\n## Welcome Message\n\nWrite a personalised greeting that visitors see when they open the widget.\n\n## Launcher Position\n\nChoose left or right positioning for the floating launcher button.",
          },
        ],
      },
      {
        name: "Features & Guides",
        desc: "Learn how to use every Opencom feature",
        articles: [
          {
            title: "Product Tours",
            content:
              "# Product Tours\n\nCreate interactive step-by-step walkthroughs.\n\n## Tour Types\n\n- **Pointer steps**: Highlight a specific element on the page\n- **Post steps**: Show a floating card with rich content\n- **Video steps**: Embed a video walkthrough\n\n## Targeting\n\nTarget tours to specific pages using URL rules. Set display frequency to show once, every time, or on a schedule.",
          },
          {
            title: "Surveys & Feedback",
            content:
              "# Surveys & Feedback\n\nCollect user feedback with in-app surveys.\n\n## Survey Types\n\n- **NPS**: Net Promoter Score (0–10 scale)\n- **Star Rating**: 1–5 stars\n- **Multiple Choice**: Custom options\n- **Free Text**: Open-ended responses\n\n## Triggers\n\nShow surveys immediately, after a delay, on specific pages, or based on custom events.",
          },
          {
            title: "Outbound Messages",
            content:
              "# Outbound Messages\n\nReach users proactively with targeted in-app messages.\n\n## Message Types\n\n- **Chat**: Appears as a conversation bubble\n- **Post**: Rich content card with buttons\n- **Banner**: Floating bar at top or bottom\n\n## Click Actions\n\nConfigure what happens when users click a message — open the messenger, start a conversation, navigate to a help article, or visit an external URL.",
          },
        ],
      },
    ];

    const collectionIds: Id<"collections">[] = [];
    const articleIds: Id<"articles">[] = [];
    for (let ci = 0; ci < collectionsData.length; ci++) {
      const c = collectionsData[ci];
      const slug =
        `${LANDING_DEMO_PREFIX}${c.name.toLowerCase().replace(/\s+/g, "-")}`.toLowerCase();
      const collectionId = await ctx.db.insert("collections", {
        workspaceId,
        name: `${LANDING_DEMO_PREFIX}${c.name}`,
        slug,
        description: c.desc,
        order: ci,
        createdAt: now - 14 * DAY,
        updatedAt: now,
      });
      collectionIds.push(collectionId);

      for (let ai = 0; ai < c.articles.length; ai++) {
        const a = c.articles[ai];
        const articleId = await ctx.db.insert("articles", {
          workspaceId,
          collectionId,
          title: `${LANDING_DEMO_PREFIX}${a.title}`,
          slug: `${LANDING_DEMO_PREFIX}${a.title.toLowerCase().replace(/\s+/g, "-")}-${ci}-${ai}`.toLowerCase(),
          content: a.content,
          status: "published",
          order: ai,
          createdAt: now - 14 * DAY + ai * DAY,
          updatedAt: now,
          publishedAt: now - 14 * DAY + ai * DAY,
        });
        articleIds.push(articleId);
      }
    }

    // ── Outbound Messages ────────────────────────────────────────
    const postMessageId = await ctx.db.insert("outboundMessages", {
      workspaceId,
      name: `${LANDING_DEMO_PREFIX}Welcome Post`,
      type: "post",
      content: {
        title: "Welcome to Opencom!",
        body: "The open-source customer messaging platform. Explore live chat, product tours, surveys, and a full knowledge base — all self-hosted.",
        buttons: [
          { text: "Start a Conversation", action: "open_new_conversation" as const },
          { text: "Dismiss", action: "dismiss" as const },
        ],
        clickAction: {
          type: "open_new_conversation" as const,
        },
      },
      status: "active",
      triggers: { type: "time_on_page", delaySeconds: 10 },
      frequency: "once",
      priority: 100,
      createdAt: now - 7 * DAY,
      updatedAt: now,
    });

    const bannerMessageId = await ctx.db.insert("outboundMessages", {
      workspaceId,
      name: `${LANDING_DEMO_PREFIX}Docs Banner`,
      type: "banner",
      content: {
        text: "Read the docs to deploy Opencom on your own infrastructure in minutes.",
        style: "floating" as const,
        dismissible: true,
        buttons: [{ text: "View Docs", action: "url" as const, url: "https://opencom.dev/docs" }],
        clickAction: {
          type: "open_url" as const,
          url: "https://opencom.dev/docs",
        },
      },
      status: "active",
      triggers: { type: "time_on_page", delaySeconds: 30 },
      frequency: "once",
      priority: 90,
      createdAt: now - 7 * DAY,
      updatedAt: now,
    });

    // ── Survey ───────────────────────────────────────────────────
    const surveyId = await ctx.db.insert("surveys", {
      workspaceId,
      name: `${LANDING_DEMO_PREFIX}Landing NPS`,
      description: "Quick NPS survey for landing page visitors",
      format: "small",
      status: "active",
      questions: [
        {
          id: "q_landing_nps",
          type: "nps",
          title: "How likely are you to recommend Opencom to a colleague?",
          required: true,
        },
      ],
      thankYouStep: {
        title: "Thank you!",
        description: "Your feedback helps us improve Opencom.",
      },
      triggers: { type: "time_on_page", delaySeconds: 60 },
      frequency: "once",
      createdAt: now - 7 * DAY,
      updatedAt: now,
    });

    // ── Tooltips ─────────────────────────────────────────────────
    const tooltipData = [
      {
        name: "Hero CTA Tooltip",
        selector: "[data-tour-target='hero-primary-cta']",
        content: "Open the hosted onboarding flow to get a live Opencom workspace running quickly.",
      },
      {
        name: "Tour Showcase Tooltip",
        selector: "[data-tour-target='showcase-product-tour']",
        content:
          "Preview how native product tours look when attached directly to your app interface.",
      },
      {
        name: "GitHub Nav Tooltip",
        selector: "[data-tour-target='nav-github']",
        content: "Star us on GitHub to show your support and stay updated on new releases.",
      },
    ];

    const tooltipIds: Id<"tooltips">[] = [];
    for (const t of tooltipData) {
      const tooltipId = await ctx.db.insert("tooltips", {
        workspaceId,
        name: `${LANDING_DEMO_PREFIX}${t.name}`,
        elementSelector: t.selector,
        content: t.content,
        triggerType: "hover",
        createdAt: now - 7 * DAY,
        updatedAt: now,
      });
      tooltipIds.push(tooltipId);
    }

    // ── Messenger Settings ───────────────────────────────────────
    const existingSettings = await ctx.db
      .query("messengerSettings")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, {
        primaryColor: "#792cd4",
        backgroundColor: "#792cd4",
        welcomeMessage:
          "Hey there! Welcome to Opencom — the open-source customer messaging platform. Ask us anything or explore the widget features.",
        launcherPosition: "right",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("messengerSettings", {
        workspaceId,
        primaryColor: "#792cd4",
        backgroundColor: "#792cd4",
        themeMode: "light",
        launcherPosition: "right",
        launcherSideSpacing: 20,
        launcherBottomSpacing: 20,
        showLauncher: true,
        welcomeMessage:
          "Hey there! Welcome to Opencom — the open-source customer messaging platform. Ask us anything or explore the widget features.",
        showTeammateAvatars: true,
        supportedLanguages: ["en"],
        defaultLanguage: "en",
        mobileEnabled: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      tourId,
      tourSteps: stepIds.length,
      checklistId,
      collections: collectionIds.length,
      articles: articleIds.length,
      outboundMessages: { postMessageId, bannerMessageId },
      surveyId,
      tooltips: tooltipIds.length,
    };
  },
});
