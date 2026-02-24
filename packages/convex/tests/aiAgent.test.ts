import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";

describe("aiAgent", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testArticleId: Id<"articles">;
  let testConversationId: Id<"conversations">;
  let testVisitorId: Id<"visitors">;
  let testMessageId: Id<"messages">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);
    testWorkspaceId = (await authenticateClientForWorkspace(client)).workspaceId;

    // Create test article for knowledge retrieval
    testArticleId = await client.mutation(api.testing.helpers.createTestArticle, {
      workspaceId: testWorkspaceId,
      title: "How to reset your password",
      content:
        "To reset your password, go to Settings > Security > Reset Password. Click the reset button and follow the instructions sent to your email.",
    });
    await client.mutation(api.testing.helpers.publishTestArticle, { id: testArticleId });

    // Create test visitor
    const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
    });
    testVisitorId = visitor.visitorId;

    // Create test conversation
    const conversation = await client.mutation(
      api.testing.helpers.createTestConversationForVisitor,
      {
        workspaceId: testWorkspaceId,
        visitorId: testVisitorId,
      }
    );
    testConversationId = conversation!._id;

    // Create test message
    testMessageId = await client.mutation(api.testing.helpers.sendTestMessageDirect, {
      conversationId: testConversationId,
      senderId: testVisitorId,
      senderType: "visitor",
      content: "How do I reset my password?",
    });
  });

  afterAll(async () => {
    if (client) {
      await client.mutation(api.testing.helpers.cleanupTestData, {
        workspaceId: testWorkspaceId,
      });
      await client.close();
    }
  });

  describe("getSettings", () => {
    it("should return default settings for new workspace", async () => {
      const settings = await client.mutation(api.testing.helpers.getTestAISettings, {
        workspaceId: testWorkspaceId,
      });

      expect(settings).toBeDefined();
      expect(settings.enabled).toBe(false);
      expect(settings.confidenceThreshold).toBe(0.6);
      expect(settings.model).toBe("openai/gpt-5-nano");
    });
  });

  describe("updateSettings", () => {
    it("should create settings if none exist", async () => {
      await client.mutation(api.testing.helpers.updateTestAISettings, {
        workspaceId: testWorkspaceId,
        enabled: true,
        model: "openai/gpt-5-nano",
        confidenceThreshold: 0.7,
        knowledgeSources: ["articles", "snippets"],
      });

      const settings = await client.mutation(api.testing.helpers.getTestAISettings, {
        workspaceId: testWorkspaceId,
      });

      expect(settings.enabled).toBe(true);
      expect(settings.model).toBe("openai/gpt-5-nano");
      expect(settings.confidenceThreshold).toBe(0.7);
      expect(settings.knowledgeSources).toContain("articles");
      expect(settings.knowledgeSources).toContain("snippets");
    });

    it("should update existing settings", async () => {
      await client.mutation(api.testing.helpers.updateTestAISettings, {
        workspaceId: testWorkspaceId,
        enabled: false,
        personality: "Be friendly and helpful",
        handoffMessage: "Connecting you to a human now...",
      });

      const settings = await client.mutation(api.testing.helpers.getTestAISettings, {
        workspaceId: testWorkspaceId,
      });

      expect(settings.enabled).toBe(false);
      expect(settings.personality).toBe("Be friendly and helpful");
      expect(settings.handoffMessage).toBe("Connecting you to a human now...");
    });
  });

  describe("getRelevantKnowledge", () => {
    it("should find relevant articles based on query", async () => {
      const results = await client.query(api.aiAgent.getRelevantKnowledge, {
        workspaceId: testWorkspaceId,
        query: "password reset",
        knowledgeSources: ["articles"],
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain("password");
    });

    it("should return empty array for unrelated query", async () => {
      const results = await client.query(api.aiAgent.getRelevantKnowledge, {
        workspaceId: testWorkspaceId,
        query: "quantum physics theories",
        knowledgeSources: ["articles"],
      });

      expect(results.length).toBe(0);
    });

    it("should respect limit parameter", async () => {
      const results = await client.query(api.aiAgent.getRelevantKnowledge, {
        workspaceId: testWorkspaceId,
        query: "password",
        knowledgeSources: ["articles"],
        limit: 1,
      });

      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe("storeResponse", () => {
    it("should store an AI response", async () => {
      const responseId = await client.mutation(api.aiAgent.storeResponse, {
        conversationId: testConversationId,
        messageId: testMessageId,
        query: "How do I reset my password?",
        response: "To reset your password, go to Settings > Security > Reset Password.",
        sources: [{ type: "article", id: testArticleId, title: "How to reset your password" }],
        confidence: 0.85,
        handedOff: false,
        generationTimeMs: 1200,
        tokensUsed: 150,
        model: "openai/gpt-5-nano",
        provider: "openai",
      });

      expect(responseId).toBeDefined();

      const responses = await client.query(api.aiAgent.getConversationResponses, {
        conversationId: testConversationId,
      });

      expect(responses.length).toBeGreaterThan(0);
      expect(responses[0].query).toBe("How do I reset my password?");
      expect(responses[0].confidence).toBe(0.85);
    });
  });

  describe("submitFeedback", () => {
    it("should update feedback on AI response", async () => {
      // First get the response
      const responses = await client.query(api.aiAgent.getConversationResponses, {
        conversationId: testConversationId,
      });

      expect(responses.length).toBeGreaterThan(0);
      const responseId = responses[0]._id;

      // Submit feedback
      await client.mutation(api.aiAgent.submitFeedback, {
        responseId,
        feedback: "helpful",
      });

      // Verify feedback was saved
      const updatedResponses = await client.query(api.aiAgent.getConversationResponses, {
        conversationId: testConversationId,
      });

      const updatedResponse = updatedResponses.find((r) => r._id === responseId);
      expect(updatedResponse?.feedback).toBe("helpful");
    });
  });

  describe("handoffToHuman", () => {
    it("should create handoff message and update conversation", async () => {
      // First enable AI agent with custom handoff message
      await client.mutation(api.testing.helpers.updateTestAISettings, {
        workspaceId: testWorkspaceId,
        handoffMessage: "Let me get a human to help you.",
      });

      const result = await client.mutation(api.aiAgent.handoffToHuman, {
        conversationId: testConversationId,
        reason: "Customer requested human agent",
      });

      expect(result.messageId).toBeDefined();
      expect(result.handoffMessage).toBe("Let me get a human to help you.");

      // Verify conversation is open
      const messages = await client.mutation(api.testing.helpers.listTestMessages, {
        conversationId: testConversationId,
      });

      const handoffMsg = messages.find((m) => m.content.includes("human"));
      expect(handoffMsg).toBeDefined();
    });
  });

  describe("shouldRespond", () => {
    it("should return false when AI is disabled", async () => {
      await client.mutation(api.testing.helpers.updateTestAISettings, {
        workspaceId: testWorkspaceId,
        enabled: false,
      });

      const result = await client.query(api.aiAgent.shouldRespond, {
        workspaceId: testWorkspaceId,
      });

      expect(result.shouldRespond).toBe(false);
      expect(result.reason).toBe("AI Agent is disabled");
    });

    it("should return true when AI is enabled", async () => {
      await client.mutation(api.testing.helpers.updateTestAISettings, {
        workspaceId: testWorkspaceId,
        enabled: true,
      });

      const result = await client.query(api.aiAgent.shouldRespond, {
        workspaceId: testWorkspaceId,
      });

      expect(result.shouldRespond).toBe(true);
    });
  });

  describe("getAnalytics", () => {
    it("should return analytics for workspace", async () => {
      const analytics = await client.query(api.aiAgent.getAnalytics, {
        workspaceId: testWorkspaceId,
      });

      expect(analytics).toBeDefined();
      expect(typeof analytics.totalResponses).toBe("number");
      expect(typeof analytics.handoffRate).toBe("number");
      expect(typeof analytics.resolutionRate).toBe("number");
      expect(typeof analytics.satisfactionRate).toBe("number");
    });
  });

  describe("listAvailableModels", () => {
    it("should return list of available models", async () => {
      const models = await client.query(api.aiAgent.listAvailableModels, {});

      expect(models.length).toBeGreaterThan(0);
      expect(models[0]).toHaveProperty("id");
      expect(models[0]).toHaveProperty("name");
      expect(models[0]).toHaveProperty("provider");
    });
  });
});
