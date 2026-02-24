import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

// These tests require ALLOW_TEST_DATA=true to be set as a Convex server env var.
// Skip when running unit tests (seed functions are tested as part of E2E).
describe.skip("testData seeding functions", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    const workspace = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    testWorkspaceId = workspace.workspaceId;
  });

  afterAll(async () => {
    if (testWorkspaceId) {
      try {
        await client.mutation(api.testData.cleanupTestData, {
          workspaceId: testWorkspaceId,
        });
        await client.mutation(api.testing.helpers.cleanupTestData, {
          workspaceId: testWorkspaceId,
        });
      } catch (e) {
        console.warn("Cleanup failed:", e);
      }
    }
    await client.close();
  });

  describe("seedTour", () => {
    it("should create a tour with default steps", async () => {
      const result = await client.mutation(api.testData.seedTour, {
        workspaceId: testWorkspaceId,
      });

      expect(result.tourId).toBeDefined();
      expect(result.stepIds).toBeDefined();
      expect(result.stepIds.length).toBe(3);
      expect(result.name).toMatch(/^e2e_test_tour_/);
    });

    it("should create a tour with custom name", async () => {
      const result = await client.mutation(api.testData.seedTour, {
        workspaceId: testWorkspaceId,
        name: "e2e_test_custom_tour",
        status: "active",
      });

      expect(result.name).toBe("e2e_test_custom_tour");
    });

    it("should create a tour with custom steps", async () => {
      const result = await client.mutation(api.testData.seedTour, {
        workspaceId: testWorkspaceId,
        steps: [
          { type: "post", title: "Intro", content: "Welcome!" },
          { type: "pointer", title: "Button", content: "Click here", elementSelector: "#btn" },
        ],
      });

      expect(result.stepIds.length).toBe(2);
    });
  });

  describe("seedSurvey", () => {
    it("should create an NPS survey by default", async () => {
      const result = await client.mutation(api.testData.seedSurvey, {
        workspaceId: testWorkspaceId,
      });

      expect(result.surveyId).toBeDefined();
      expect(result.questionId).toBeDefined();
      expect(result.name).toMatch(/^e2e_test_survey_/);
    });

    it("should create a survey with custom format and type", async () => {
      const result = await client.mutation(api.testData.seedSurvey, {
        workspaceId: testWorkspaceId,
        format: "large",
        questionType: "star_rating",
      });

      expect(result.surveyId).toBeDefined();
    });

    it("should create a survey with page trigger", async () => {
      const result = await client.mutation(api.testData.seedSurvey, {
        workspaceId: testWorkspaceId,
        triggerType: "page_visit",
        triggerPageUrl: "/pricing",
      });

      expect(result.surveyId).toBeDefined();
    });
  });

  describe("seedCarousel", () => {
    it("should create a carousel with default screens", async () => {
      const result = await client.mutation(api.testData.seedCarousel, {
        workspaceId: testWorkspaceId,
      });

      expect(result.carouselId).toBeDefined();
      expect(result.name).toMatch(/^e2e_test_carousel_/);
    });

    it("should create a carousel with custom screens", async () => {
      const result = await client.mutation(api.testData.seedCarousel, {
        workspaceId: testWorkspaceId,
        screens: [
          { title: "Screen 1", body: "First screen" },
          { title: "Screen 2", body: "Second screen", imageUrl: "https://example.com/img.png" },
        ],
      });

      expect(result.carouselId).toBeDefined();
    });
  });

  describe("seedOutboundMessage", () => {
    it("should create a chat message by default", async () => {
      const result = await client.mutation(api.testData.seedOutboundMessage, {
        workspaceId: testWorkspaceId,
      });

      expect(result.messageId).toBeDefined();
      expect(result.name).toMatch(/^e2e_test_message_/);
    });

    it("should create a post message", async () => {
      const result = await client.mutation(api.testData.seedOutboundMessage, {
        workspaceId: testWorkspaceId,
        type: "post",
      });

      expect(result.messageId).toBeDefined();
    });

    it("should create a banner message", async () => {
      const result = await client.mutation(api.testData.seedOutboundMessage, {
        workspaceId: testWorkspaceId,
        type: "banner",
      });

      expect(result.messageId).toBeDefined();
    });
  });

  describe("seedArticles", () => {
    it("should create articles with a collection", async () => {
      const result = await client.mutation(api.testData.seedArticles, {
        workspaceId: testWorkspaceId,
      });

      expect(result.collectionId).toBeDefined();
      expect(result.articleIds.length).toBe(3);
      expect(result.collectionName).toMatch(/^e2e_test_collection_/);
    });

    it("should create articles with draft included", async () => {
      const result = await client.mutation(api.testData.seedArticles, {
        workspaceId: testWorkspaceId,
        articleCount: 2,
        includesDraft: true,
      });

      expect(result.articleIds.length).toBe(2);
    });
  });

  describe("seedVisitor", () => {
    it("should create a visitor with defaults", async () => {
      const result = await client.mutation(api.testData.seedVisitor, {
        workspaceId: testWorkspaceId,
      });

      expect(result.visitorId).toBeDefined();
      expect(result.sessionId).toMatch(/^e2e_test_session_/);
    });

    it("should create a visitor with custom attributes", async () => {
      const result = await client.mutation(api.testData.seedVisitor, {
        workspaceId: testWorkspaceId,
        email: "e2e_test_custom@test.com",
        name: "Custom Visitor",
        customAttributes: { tier: "premium", industry: "tech" },
      });

      expect(result.visitorId).toBeDefined();
    });
  });

  describe("seedSegment", () => {
    it("should create a segment with default rules", async () => {
      const result = await client.mutation(api.testData.seedSegment, {
        workspaceId: testWorkspaceId,
      });

      expect(result.segmentId).toBeDefined();
      expect(result.name).toMatch(/^e2e_test_segment_/);
    });

    it("should create a segment with custom rules", async () => {
      const result = await client.mutation(api.testData.seedSegment, {
        workspaceId: testWorkspaceId,
        name: "e2e_test_premium_users",
        audienceRules: {
          match: "all",
          conditions: [
            { type: "attribute", attribute: "plan", operator: "equals", value: "premium" },
          ],
        },
      });

      expect(result.name).toBe("e2e_test_premium_users");
    });
  });

  describe("seedMessengerSettings", () => {
    it("should create messenger settings", async () => {
      const result = await client.mutation(api.testData.seedMessengerSettings, {
        workspaceId: testWorkspaceId,
        primaryColor: "#ff0000",
        welcomeMessage: "E2E Test Welcome!",
      });

      expect(result.settingsId).toBeDefined();
    });
  });

  describe("seedAIAgentSettings", () => {
    it("should create AI agent settings", async () => {
      const result = await client.mutation(api.testData.seedAIAgentSettings, {
        workspaceId: testWorkspaceId,
        enabled: true,
      });

      expect(result.settingsId).toBeDefined();
    });
  });

  describe("seedAll", () => {
    it("should create all test data at once", async () => {
      const result = await client.mutation(api.testData.seedAll, {
        workspaceId: testWorkspaceId,
      });

      expect(result.visitorId).toBeDefined();
      expect(result.tourId).toBeDefined();
      expect(result.surveyId).toBeDefined();
      expect(result.collectionId).toBeDefined();
      expect(result.articleId).toBeDefined();
      expect(result.segmentId).toBeDefined();
    });
  });

  describe("cleanupTestData", () => {
    it("should clean up all e2e_test_ prefixed data", async () => {
      // First seed some data
      await client.mutation(api.testData.seedTour, { workspaceId: testWorkspaceId });
      await client.mutation(api.testData.seedSurvey, { workspaceId: testWorkspaceId });
      await client.mutation(api.testData.seedVisitor, { workspaceId: testWorkspaceId });

      // Then clean it up
      const result = await client.mutation(api.testData.cleanupTestData, {
        workspaceId: testWorkspaceId,
      });

      expect(result.success).toBe(true);
      expect(result.cleaned.tours).toBeGreaterThan(0);
      expect(result.cleaned.surveys).toBeGreaterThan(0);
      expect(result.cleaned.visitors).toBeGreaterThan(0);
    });
  });
});
