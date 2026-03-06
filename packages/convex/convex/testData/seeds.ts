import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import type {
  MessageButton as SharedMessageButton,
  OutboundButtonAction,
  OutboundMessageContent,
} from "@opencom/types";
import { formatReadableVisitorId } from "../visitorReadableId";
import {
  outboundClickActionValidator,
  outboundMessageStatusValidator,
  outboundMessageTriggerTypeValidator,
  outboundMessageTypeValidator,
} from "../outboundContracts";

const E2E_TEST_PREFIX = "e2e_test_";

type SeedOutboundButtonAction = Exclude<OutboundButtonAction, "reply" | "chat">;
type SeedMessageButton = Omit<SharedMessageButton<Id<"tours">, Id<"articles">>, "action"> & {
  action: SeedOutboundButtonAction;
};
type SeedOutboundMessageContent = Omit<
  OutboundMessageContent<Id<"users">, Id<"tours">, Id<"articles">>,
  "buttons"
> & {
  buttons?: SeedMessageButton[];
};

function requireTestDataEnabled() {
  if (process.env.ALLOW_TEST_DATA !== "true") {
    throw new Error("Test data mutations are disabled");
  }
}

const seedTour = internalMutation({
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
const seedSurvey = internalMutation({
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
const seedCarousel = internalMutation({
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
const seedOutboundMessage = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.optional(v.string()),
    type: v.optional(outboundMessageTypeValidator),
    status: v.optional(outboundMessageStatusValidator),
    triggerType: v.optional(outboundMessageTriggerTypeValidator),
    triggerPageUrl: v.optional(v.string()),
    senderId: v.optional(v.id("users")),
    clickAction: v.optional(outboundClickActionValidator),
  },
  handler: async (ctx, args) => {
    requireTestDataEnabled();
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const name = args.name || `${E2E_TEST_PREFIX}message_${randomSuffix}`;
    const type = args.type || "chat";

    const content: SeedOutboundMessageContent = {};

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
const seedArticles = internalMutation({
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
const seedVisitor = internalMutation({
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
const seedSegment = internalMutation({
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
const seedMessengerSettings = internalMutation({
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
const seedAIAgentSettings = internalMutation({
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

export const seedMutations: Record<string, ReturnType<typeof internalMutation>> = {
  seedTour,
  seedSurvey,
  seedCarousel,
  seedOutboundMessage,
  seedArticles,
  seedVisitor,
  seedSegment,
  seedMessengerSettings,
  seedAIAgentSettings,
} as const;
