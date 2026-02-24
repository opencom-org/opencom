import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";

describe("outboundMessages", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testVisitorId: Id<"visitors">;
  let testMessageId: Id<"outboundMessages">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);
    testWorkspaceId = (await authenticateClientForWorkspace(client)).workspaceId;

    // Create a test visitor
    const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
    });
    testVisitorId = visitor.visitorId;
  });

  afterAll(async () => {
    if (testWorkspaceId) {
      try {
        await client.mutation(api.testing.helpers.cleanupTestData, {
          workspaceId: testWorkspaceId,
        });
      } catch (e) {
        console.warn("Cleanup failed:", e);
      }
    }
    await client.close();
  });

  describe("CRUD operations", () => {
    it("should create a chat message", async () => {
      testMessageId = await client.mutation(api.outboundMessages.create, {
        workspaceId: testWorkspaceId,
        type: "chat",
        name: "Welcome Chat",
        content: {
          text: "Hello! How can we help you today?",
        },
      });

      expect(testMessageId).toBeDefined();
    });

    it("should get a message by id", async () => {
      const message = await client.query(api.outboundMessages.get, { id: testMessageId });

      expect(message).toBeDefined();
      expect(message?.name).toBe("Welcome Chat");
      expect(message?.type).toBe("chat");
      expect(message?.status).toBe("draft");
      expect(message?.content.text).toBe("Hello! How can we help you today?");
    });

    it("should list messages for workspace", async () => {
      const messages = await client.query(api.outboundMessages.list, {
        workspaceId: testWorkspaceId,
      });

      expect(messages).toBeDefined();
      expect(messages.length).toBeGreaterThan(0);
      expect(messages.some((m: { _id: Id<"outboundMessages"> }) => m._id === testMessageId)).toBe(
        true
      );
    });

    it("should update a message", async () => {
      await client.mutation(api.outboundMessages.update, {
        id: testMessageId,
        name: "Updated Welcome Chat",
        content: {
          text: "Welcome! We're here to help.",
        },
        frequency: "once_per_session",
      });

      const message = await client.query(api.outboundMessages.get, { id: testMessageId });

      expect(message?.name).toBe("Updated Welcome Chat");
      expect(message?.content.text).toBe("Welcome! We're here to help.");
      expect(message?.frequency).toBe("once_per_session");
    });

    it("should activate a message", async () => {
      await client.mutation(api.outboundMessages.activate, { id: testMessageId });

      const message = await client.query(api.outboundMessages.get, { id: testMessageId });

      expect(message?.status).toBe("active");
    });

    it("should pause a message", async () => {
      await client.mutation(api.outboundMessages.pause, { id: testMessageId });

      const message = await client.query(api.outboundMessages.get, { id: testMessageId });

      expect(message?.status).toBe("paused");
    });
  });

  describe("message types", () => {
    it("should create a post message", async () => {
      const postId = await client.mutation(api.outboundMessages.create, {
        workspaceId: testWorkspaceId,
        type: "post",
        name: "Feature Announcement",
        content: {
          title: "New Feature!",
          body: "Check out our latest update.",
          imageUrl: "https://example.com/image.png",
        },
      });

      const post = await client.query(api.outboundMessages.get, { id: postId });

      expect(post?.type).toBe("post");
      expect(post?.content.title).toBe("New Feature!");
      expect(post?.content.body).toBe("Check out our latest update.");
    });

    it("should create a banner message", async () => {
      const bannerId = await client.mutation(api.outboundMessages.create, {
        workspaceId: testWorkspaceId,
        type: "banner",
        name: "Promo Banner",
        content: {
          text: "50% off this week only!",
          style: "floating",
          dismissible: true,
        },
      });

      const banner = await client.query(api.outboundMessages.get, { id: bannerId });

      expect(banner?.type).toBe("banner");
      expect(banner?.content.text).toBe("50% off this week only!");
      expect(banner?.content.style).toBe("floating");
      expect(banner?.content.dismissible).toBe(true);
    });
  });

  describe("targeting and eligibility", () => {
    it("should return eligible messages for visitor", async () => {
      // Activate the test message
      await client.mutation(api.outboundMessages.activate, { id: testMessageId });

      const eligible = await client.query(api.outboundMessages.getEligible, {
        workspaceId: testWorkspaceId,
        visitorId: testVisitorId,
        currentUrl: "https://example.com/page",
        sessionId: "test-session",
      });

      expect(eligible).toBeDefined();
      expect(Array.isArray(eligible)).toBe(true);
    });

    it("should filter by status", async () => {
      const activeMessages = await client.query(api.outboundMessages.list, {
        workspaceId: testWorkspaceId,
        status: "active",
      });

      expect(activeMessages.every((m: { status: string }) => m.status === "active")).toBe(true);
    });

    it("should filter by type", async () => {
      const chatMessages = await client.query(api.outboundMessages.list, {
        workspaceId: testWorkspaceId,
        type: "chat",
      });

      expect(chatMessages.every((m: { type: string }) => m.type === "chat")).toBe(true);
    });
  });

  describe("impression tracking", () => {
    it("should track message shown", async () => {
      const impressionId = await client.mutation(api.outboundMessages.trackImpression, {
        messageId: testMessageId,
        visitorId: testVisitorId,
        sessionId: "test-session",
        action: "shown",
      });

      expect(impressionId).toBeDefined();
    });

    it("should track message clicked", async () => {
      const impressionId = await client.mutation(api.outboundMessages.trackImpression, {
        messageId: testMessageId,
        visitorId: testVisitorId,
        sessionId: "test-session",
        action: "clicked",
        buttonIndex: 0,
      });

      expect(impressionId).toBeDefined();
    });

    it("should ignore impressions for deleted messages", async () => {
      const transientMessageId = await client.mutation(api.outboundMessages.create, {
        workspaceId: testWorkspaceId,
        type: "banner",
        name: "Transient Banner",
        content: {
          text: "This may be deleted before impression is sent.",
        },
      });

      await client.mutation(api.outboundMessages.remove, { id: transientMessageId });

      const impressionResult = await client.mutation(api.outboundMessages.trackImpression, {
        messageId: transientMessageId,
        visitorId: testVisitorId,
        sessionId: "test-session",
        action: "shown",
      });

      expect(impressionResult).toBeNull();
    });

    it("should get message stats", async () => {
      const stats = await client.query(api.outboundMessages.getStats, {
        id: testMessageId,
      });

      expect(stats).toBeDefined();
      expect(stats.shown).toBeGreaterThanOrEqual(1);
      expect(stats.clicked).toBeGreaterThanOrEqual(1);
      expect(typeof stats.clickRate).toBe("number");
    });
  });

  describe("click actions", () => {
    it("should create a message with clickAction", async () => {
      const id = await client.mutation(api.outboundMessages.create, {
        workspaceId: testWorkspaceId,
        type: "chat",
        name: "Click Action Chat",
        content: {
          text: "Click me to open help!",
          clickAction: {
            type: "open_widget_tab",
            tabId: "help",
          },
        },
      });

      const message = await client.query(api.outboundMessages.get, { id });
      expect(message?.content.clickAction).toBeDefined();
      expect(message?.content.clickAction?.type).toBe("open_widget_tab");
      expect(message?.content.clickAction?.tabId).toBe("help");

      await client.mutation(api.outboundMessages.remove, { id });
    });

    it("should create a message with open_url clickAction", async () => {
      const id = await client.mutation(api.outboundMessages.create, {
        workspaceId: testWorkspaceId,
        type: "banner",
        name: "URL Banner",
        content: {
          text: "Check out our pricing!",
          clickAction: {
            type: "open_url",
            url: "https://example.com/pricing",
          },
        },
      });

      const message = await client.query(api.outboundMessages.get, { id });
      expect(message?.content.clickAction?.type).toBe("open_url");
      expect(message?.content.clickAction?.url).toBe("https://example.com/pricing");

      await client.mutation(api.outboundMessages.remove, { id });
    });

    it("should create a message with open_new_conversation clickAction and prefillMessage", async () => {
      const id = await client.mutation(api.outboundMessages.create, {
        workspaceId: testWorkspaceId,
        type: "chat",
        name: "Prefill Chat",
        content: {
          text: "Need help? Click here!",
          clickAction: {
            type: "open_new_conversation",
            prefillMessage: "I'd like to learn more",
          },
        },
      });

      const message = await client.query(api.outboundMessages.get, { id });
      expect(message?.content.clickAction?.type).toBe("open_new_conversation");
      expect(message?.content.clickAction?.prefillMessage).toBe("I'd like to learn more");

      await client.mutation(api.outboundMessages.remove, { id });
    });

    it("should update a message to add clickAction", async () => {
      const id = await client.mutation(api.outboundMessages.create, {
        workspaceId: testWorkspaceId,
        type: "chat",
        name: "No Action Chat",
        content: {
          text: "Hello!",
        },
      });

      // Verify no click action initially
      let message = await client.query(api.outboundMessages.get, { id });
      expect(message?.content.clickAction).toBeUndefined();

      // Update to add click action
      await client.mutation(api.outboundMessages.update, {
        id,
        content: {
          text: "Hello!",
          clickAction: {
            type: "dismiss",
          },
        },
      });

      message = await client.query(api.outboundMessages.get, { id });
      expect(message?.content.clickAction?.type).toBe("dismiss");

      await client.mutation(api.outboundMessages.remove, { id });
    });

    it("should create a message with expanded button action types", async () => {
      const id = await client.mutation(api.outboundMessages.create, {
        workspaceId: testWorkspaceId,
        type: "post",
        name: "Expanded Buttons Post",
        content: {
          title: "Check it out",
          body: "New features available",
          buttons: [
            {
              text: "Start Chat",
              action: "open_new_conversation" as const,
              prefillMessage: "Hi there",
            },
            { text: "Help Center", action: "open_widget_tab" as const, tabId: "help" },
            { text: "Dismiss", action: "dismiss" as const },
          ],
        },
      });

      const message = await client.query(api.outboundMessages.get, { id });
      expect(message?.content.buttons).toHaveLength(3);
      expect(message?.content.buttons?.[0].action).toBe("open_new_conversation");
      expect(message?.content.buttons?.[0].prefillMessage).toBe("Hi there");
      expect(message?.content.buttons?.[1].action).toBe("open_widget_tab");
      expect(message?.content.buttons?.[1].tabId).toBe("help");

      await client.mutation(api.outboundMessages.remove, { id });
    });

    it("should default to open_messenger when no clickAction (backward compat)", async () => {
      const id = await client.mutation(api.outboundMessages.create, {
        workspaceId: testWorkspaceId,
        type: "chat",
        name: "Legacy Chat",
        content: {
          text: "Hello!",
        },
      });

      const message = await client.query(api.outboundMessages.get, { id });
      expect(message?.content.clickAction).toBeUndefined();
      // Consumers default to open_messenger when clickAction is absent

      await client.mutation(api.outboundMessages.remove, { id });
    });
  });

  describe("cleanup", () => {
    it("should delete a message", async () => {
      await client.mutation(api.outboundMessages.remove, { id: testMessageId });

      const message = await client.query(api.outboundMessages.get, { id: testMessageId });

      expect(message).toBeNull();
    });
  });
});
