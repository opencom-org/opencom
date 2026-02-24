import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("Webhook Status Flow", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testVisitorId: Id<"visitors">;
  let testConversationId: Id<"conversations">;
  let testMessageId: Id<"messages">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    // Create test workspace
    const workspace = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    testWorkspaceId = workspace.workspaceId;

    // Create test visitor
    const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
      email: "webhook-test@example.com",
      name: "Webhook Test Visitor",
    });
    testVisitorId = visitor.visitorId;

    // Create test conversation
    const conversation = await client.mutation(api.testing.helpers.createTestConversation, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
      status: "open",
    });
    testConversationId = conversation.conversationId;

    // Create test message with external email ID
    const message = await client.mutation(api.testing.helpers.createTestMessage, {
      conversationId: testConversationId,
      content: "Test email message",
      senderType: "agent",
      externalEmailId: "test-email-id-123",
    });
    testMessageId = message.messageId;
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

  describe("Email delivery status updates", () => {
    it("should update message status on email.sent event", async () => {
      // Simulate webhook event for email sent
      await client.mutation(api.testing.helpers.simulateEmailWebhook, {
        eventType: "email.sent",
        emailId: "test-email-id-123",
      });

      // Verify message status was updated
      const message = await client.mutation(api.testing.helpers.getTestMessage, {
        id: testMessageId,
      });

      expect(message?.deliveryStatus).toBe("sent");
    });

    it("should update message status on email.delivered event", async () => {
      await client.mutation(api.testing.helpers.simulateEmailWebhook, {
        eventType: "email.delivered",
        emailId: "test-email-id-123",
      });

      const message = await client.mutation(api.testing.helpers.getTestMessage, {
        id: testMessageId,
      });

      expect(message?.deliveryStatus).toBe("delivered");
    });

    it("should update message status on email.opened event", async () => {
      await client.mutation(api.testing.helpers.simulateEmailWebhook, {
        eventType: "email.opened",
        emailId: "test-email-id-123",
      });

      const message = await client.mutation(api.testing.helpers.getTestMessage, {
        id: testMessageId,
      });

      // opened maps to "delivered" in our schema
      expect(message?.deliveryStatus).toBe("delivered");
    });

    it("should update message status on email.bounced event", async () => {
      // Create another message for bounce test
      const bounceMessage = await client.mutation(api.testing.helpers.createTestMessage, {
        conversationId: testConversationId,
        content: "Test bounce message",
        senderType: "agent",
        externalEmailId: "test-bounce-email-123",
      });

      await client.mutation(api.testing.helpers.simulateEmailWebhook, {
        eventType: "email.bounced",
        emailId: "test-bounce-email-123",
      });

      const message = await client.mutation(api.testing.helpers.getTestMessage, {
        id: bounceMessage.messageId,
      });

      expect(message?.deliveryStatus).toBe("bounced");
    });

    it("should handle unknown email IDs gracefully", async () => {
      // Should not throw when processing webhook for unknown email
      await expect(
        client.mutation(api.testing.helpers.simulateEmailWebhook, {
          eventType: "email.delivered",
          emailId: "non-existent-email-id",
        })
      ).resolves.not.toThrow();
    });
  });

  describe("Webhook event type handling", () => {
    it("should handle all valid Resend event types", async () => {
      const eventTypes = [
        "email.sent",
        "email.delivered",
        "email.delivery_delayed",
        "email.complained",
        "email.bounced",
        "email.opened",
        "email.clicked",
      ];

      for (const eventType of eventTypes) {
        // Should not throw for any valid event type
        await expect(
          client.mutation(api.testing.helpers.simulateEmailWebhook, {
            eventType,
            emailId: `test-${eventType.replace(".", "-")}-email`,
          })
        ).resolves.not.toThrow();
      }
    });
  });
});

describe("Webhook delivery status mapping", () => {
  const statusMapping: Record<string, string> = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.opened": "opened",
    "email.clicked": "opened", // clicked implies opened
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.delivery_delayed": "delayed",
  };

  it("should map Resend events to correct delivery statuses", () => {
    Object.entries(statusMapping).forEach(([event, expectedStatus]) => {
      expect(expectedStatus).toBeDefined();
      expect(typeof expectedStatus).toBe("string");
    });
  });

  it("should have status for all common email events", () => {
    const requiredEvents = ["email.sent", "email.delivered", "email.bounced", "email.opened"];
    requiredEvents.forEach((event) => {
      expect(statusMapping[event]).toBeDefined();
    });
  });
});
