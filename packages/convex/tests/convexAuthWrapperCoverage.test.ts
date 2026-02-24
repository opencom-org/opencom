import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";

describe("convex auth wrapper coverage", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testTourId: Id<"tours">;
  let testArticleId: Id<"articles">;
  let testConversationId: Id<"conversations">;
  let testMessageId: Id<"outboundMessages">;
  let testCarouselId: Id<"carousels">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    const seedClient = new ConvexClient(convexUrl);
    testWorkspaceId = (await authenticateClientForWorkspace(seedClient)).workspaceId;

    testTourId = await seedClient.mutation(api.testing.helpers.createTestTour, {
      workspaceId: testWorkspaceId,
      name: "Wrapper Coverage Tour",
    });

    testArticleId = await seedClient.mutation(api.testing.helpers.createTestArticle, {
      workspaceId: testWorkspaceId,
      title: "Wrapper Coverage Article",
      content: "Test content",
    });

    const visitor = await seedClient.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
    });
    const conversation = await seedClient.mutation(
      api.testing.helpers.createTestConversationForVisitor,
      {
        workspaceId: testWorkspaceId,
        visitorId: visitor.visitorId,
      }
    );
    testConversationId = conversation._id;

    testMessageId = await seedClient.mutation(api.outboundMessages.create, {
      workspaceId: testWorkspaceId,
      type: "chat",
      name: "Wrapper Coverage Message",
      content: { text: "seed" },
    });
    testCarouselId = await seedClient.mutation(api.carousels.create, {
      workspaceId: testWorkspaceId,
      name: "Wrapper Coverage Carousel",
      screens: [{ id: "screen-1", title: "Seed", body: "Body" }],
    });

    await seedClient.close();
    client = new ConvexClient(convexUrl);
  });

  afterAll(async () => {
    if (testWorkspaceId) {
      await client.mutation(api.testing.helpers.cleanupTestData, { workspaceId: testWorkspaceId });
    }
    await client.close();
  });

  it("rejects unauthenticated admin module operations", async () => {
    await expect(
      client.mutation(api.emailCampaigns.create, {
        workspaceId: testWorkspaceId,
        name: "NoAuth Campaign",
        subject: "Subject",
        content: "Body",
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.mutation(api.outboundMessages.create, {
        workspaceId: testWorkspaceId,
        type: "chat",
        name: "NoAuth Message",
        content: { text: "hello" },
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.mutation(api.carousels.create, {
        workspaceId: testWorkspaceId,
        name: "NoAuth Carousel",
        screens: [{ id: "screen-1", title: "One", body: "Two" }],
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.mutation(api.internalArticles.create, {
        workspaceId: testWorkspaceId,
        title: "NoAuth Internal",
        content: "secret",
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.mutation(api.contentFolders.create, {
        workspaceId: testWorkspaceId,
        name: "NoAuth Folder",
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.mutation(api.emailTemplates.create, {
        workspaceId: testWorkspaceId,
        name: "NoAuth Template",
        html: "<p>Hello</p>",
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.mutation(api.collections.create, {
        workspaceId: testWorkspaceId,
        name: "NoAuth Collection",
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.mutation(api.tooltips.create, {
        workspaceId: testWorkspaceId,
        name: "NoAuth Tooltip",
        elementSelector: "#app",
        content: "Hello",
        triggerType: "click",
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.mutation(api.tourSteps.create, {
        tourId: testTourId,
        type: "post",
        content: "NoAuth step",
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("allows unauthenticated public help-center article reads while keeping admin-sensitive paths locked", async () => {
    const publicList = await client.query(api.articles.list, {
      workspaceId: testWorkspaceId,
    });
    expect(Array.isArray(publicList)).toBe(true);
    expect(publicList).toHaveLength(0);

    const publicSearch = await client.query(api.articles.search, {
      workspaceId: testWorkspaceId,
      query: "hello",
    });
    expect(Array.isArray(publicSearch)).toBe(true);
    expect(publicSearch).toHaveLength(0);

    await expect(
      client.mutation(api.articles.publish, {
        id: testArticleId,
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.query(api.knowledge.search, {
        workspaceId: testWorkspaceId,
        query: "policy",
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.query(api.aiAgent.getRelevantKnowledge, {
        workspaceId: testWorkspaceId,
        query: "refund",
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.query(api.aiAgent.getAnalytics, {
        workspaceId: testWorkspaceId,
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.mutation(api.aiAgent.updateSettings, {
        workspaceId: testWorkspaceId,
        enabled: true,
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("rejects unauthenticated paid actions", async () => {
    await expect(
      client.action(api.embeddings.generate, {
        workspaceId: testWorkspaceId,
        contentType: "article",
        contentId: testArticleId,
        title: "Title",
        content: "Body",
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.action(api.suggestions.searchSimilar, {
        workspaceId: testWorkspaceId,
        query: "help center",
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.action(api.suggestions.getForConversation, {
        conversationId: testConversationId,
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.action(api.outboundMessages.sendPushForCampaign, {
        messageId: testMessageId,
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.action(api.carousels.sendPushTrigger, {
        carouselId: testCarouselId,
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("returns redacted setup and discovery metadata for unauthenticated callers", async () => {
    const setup = await client.query(api.setup.checkExistingSetup, {});
    expect(setup).toHaveProperty("hasWorkspaces");
    expect(setup).toHaveProperty("hasUsers");
    expect(setup).not.toHaveProperty("workspaceCount");
    expect(setup).not.toHaveProperty("userCount");

    const metadata = await client.query(api.discovery.getMetadata, {});
    expect(metadata).toHaveProperty("version");
    expect(metadata).toHaveProperty("name");
    expect(metadata).toHaveProperty("features");
    expect(metadata).not.toHaveProperty("signupMode");
    expect(metadata).not.toHaveProperty("authMethods");
  });
});
