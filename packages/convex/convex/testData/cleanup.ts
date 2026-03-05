import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { formatReadableVisitorId } from "../visitorReadableId";

const E2E_TEST_PREFIX = "e2e_test_";

function requireTestDataEnabled() {
  if (process.env.ALLOW_TEST_DATA !== "true") {
    throw new Error("Test data mutations are disabled");
  }
}

const cleanupTestData = internalMutation({
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
const seedAll = internalMutation({
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
const cleanupAll = internalMutation({
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
const clearAllTours = internalMutation({
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
const getTourCount = internalMutation({
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

export const cleanupMutations: Record<string, ReturnType<typeof internalMutation>> = {
  cleanupTestData,
  seedAll,
  cleanupAll,
  clearAllTours,
  getTourCount,
} as const;
