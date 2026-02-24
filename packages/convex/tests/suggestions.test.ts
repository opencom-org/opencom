import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";

describe("suggestions", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testConversationId: Id<"conversations">;
  let testVisitorId: Id<"visitors">;
  let testArticleId: Id<"articles">;
  let testSnippetId: Id<"snippets">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);
    testWorkspaceId = (await authenticateClientForWorkspace(client)).workspaceId;

    // Create test article
    testArticleId = await client.mutation(api.testing.helpers.createTestArticle, {
      workspaceId: testWorkspaceId,
      title: "How to reset your password",
      content:
        "To reset your password, go to Settings > Security > Reset Password. Click the reset button and follow the instructions sent to your email.",
    });
    await client.mutation(api.testing.helpers.publishTestArticle, { id: testArticleId });

    // Create test snippet
    testSnippetId = await client.mutation(api.testing.helpers.createTestSnippet, {
      workspaceId: testWorkspaceId,
      name: "Password Reset Response",
      content:
        "I can help you reset your password. Please go to Settings > Security and click Reset Password.",
    });

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

    // Add a message to the conversation
    await client.mutation(api.testing.helpers.sendTestMessageDirect, {
      conversationId: testConversationId,
      senderId: testVisitorId,
      senderType: "visitor",
      content: "How do I reset my password?",
    });

    // Enable suggestions in settings
    await client.mutation(api.testing.helpers.updateTestAISettings, {
      workspaceId: testWorkspaceId,
      enabled: true,
      suggestionsEnabled: true,
      knowledgeSources: ["articles", "snippets"],
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

  describe("trackUsage", () => {
    it("should track when a suggestion is used", async () => {
      const feedbackId = await client.mutation(api.suggestions.trackUsage, {
        workspaceId: testWorkspaceId,
        conversationId: testConversationId,
        contentType: "article",
        contentId: testArticleId,
      });

      expect(feedbackId).toBeDefined();
    });
  });

  describe("trackDismissal", () => {
    it("should track when a suggestion is dismissed", async () => {
      const feedbackId = await client.mutation(api.suggestions.trackDismissal, {
        workspaceId: testWorkspaceId,
        conversationId: testConversationId,
        contentType: "snippet",
        contentId: testSnippetId,
      });

      expect(feedbackId).toBeDefined();
    });
  });

  describe("getFeedbackStats", () => {
    it("should return feedback statistics", async () => {
      const stats = await client.query(api.suggestions.getFeedbackStats, {
        workspaceId: testWorkspaceId,
      });

      expect(stats).toBeDefined();
      expect(stats.total).toBeGreaterThanOrEqual(0);
      expect(stats.used).toBeGreaterThanOrEqual(0);
      expect(stats.dismissed).toBeGreaterThanOrEqual(0);
      expect(stats.usageRate).toBeGreaterThanOrEqual(0);
      expect(stats.usageRate).toBeLessThanOrEqual(1);
    });
  });
});

describe("aiAgent settings with suggestions", () => {
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
    if (client) {
      await client.mutation(api.testing.helpers.cleanupTestData, {
        workspaceId: testWorkspaceId,
      });
      await client.close();
    }
  });

  it("should return default suggestionsEnabled as false", async () => {
    const settings = await client.mutation(api.testing.helpers.getTestAISettings, {
      workspaceId: testWorkspaceId,
    });

    expect(settings.suggestionsEnabled).toBe(false);
    expect(settings.embeddingModel).toBe("text-embedding-3-small");
  });

  it("should update suggestionsEnabled setting", async () => {
    await client.mutation(api.testing.helpers.updateTestAISettings, {
      workspaceId: testWorkspaceId,
      suggestionsEnabled: true,
    });

    const settings = await client.mutation(api.testing.helpers.getTestAISettings, {
      workspaceId: testWorkspaceId,
    });

    expect(settings.suggestionsEnabled).toBe(true);
  });
});
