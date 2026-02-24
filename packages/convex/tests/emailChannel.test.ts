import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

const WEBHOOK_ACCESS_ERROR = /Unauthorized|Webhook internal secret is not configured/;

describe("emailChannel", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testVisitorId: Id<"visitors">;
  let testUserId: Id<"users">;
  let testForwardingAddress: string;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    const workspace = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    testWorkspaceId = workspace.workspaceId;

    const user = await client.mutation(api.testing.helpers.createTestUser, {
      workspaceId: testWorkspaceId,
      role: "agent",
    });
    testUserId = user.userId;

    const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
      email: "customer@example.com",
      name: "Test Customer",
    });
    testVisitorId = visitor.visitorId;

    const emailConfig = await client.mutation(api.testing.helpers.createTestEmailConfig, {
      workspaceId: testWorkspaceId,
      enabled: true,
      fromName: "Support Team",
      fromEmail: "support@test.opencom.dev",
      signature: "Best regards",
    });
    testForwardingAddress = emailConfig.forwardingAddress;
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

  it("email config read is hidden for unauthenticated callers", async () => {
    const config = await client.query(api.emailChannel.getEmailConfig, {
      workspaceId: testWorkspaceId,
    });

    expect(config).toBeNull();
  });

  it("email config writes require authentication", async () => {
    await expect(
      client.mutation(api.emailChannel.upsertEmailConfig, {
        workspaceId: testWorkspaceId,
        fromName: "Updated Support",
        fromEmail: "updated@test.opencom.dev",
        enabled: true,
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("webhook-only config lookup is protected by internal secret", async () => {
    await expect(
      client.query(api.emailChannel.getEmailConfigByForwardingAddress, {
        forwardingAddress: testForwardingAddress,
      })
    ).rejects.toThrow(WEBHOOK_ACCESS_ERROR);
  });

  it("inbound/forwarded processing is protected by internal secret", async () => {
    await expect(
      client.mutation(api.emailChannel.processInboundEmail, {
        workspaceId: testWorkspaceId,
        from: "newcustomer@example.com",
        to: [testForwardingAddress],
        subject: "Need help",
        textBody: "I need help with my order",
        messageId: `<test-msg-${Date.now()}@example.com>`,
      })
    ).rejects.toThrow(WEBHOOK_ACCESS_ERROR);

    await expect(
      client.mutation(api.emailChannel.processForwardedEmail, {
        workspaceId: testWorkspaceId,
        forwarderEmail: "agent@company.com",
        originalFrom: "Original Customer <original@customer.com>",
        to: [testForwardingAddress],
        subject: "Fwd: Customer inquiry",
        textBody: "Forwarded body",
        messageId: `<forwarded-${Date.now()}@example.com>`,
      })
    ).rejects.toThrow(WEBHOOK_ACCESS_ERROR);
  });

  it("email thread list stays protected for unauthenticated callers", async () => {
    const conv = await client.mutation(api.testing.helpers.createTestEmailConversation, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
      subject: "Thread list test",
    });

    await client.mutation(api.testing.helpers.createTestEmailThread, {
      workspaceId: testWorkspaceId,
      conversationId: conv.conversationId,
      messageId: `<thread-${Date.now()}@example.com>`,
      subject: "Thread list test",
      senderEmail: "customer@example.com",
    });

    const threads = await client.query(api.emailChannel.listEmailThreads, {
      conversationId: conv.conversationId,
    });

    expect(threads).toEqual([]);
  });

  it("agent reply endpoint requires authentication", async () => {
    const conv = await client.mutation(api.testing.helpers.createTestEmailConversation, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
      subject: "Reply auth test",
    });

    await expect(
      client.mutation(api.emailChannel.sendEmailReply, {
        conversationId: conv.conversationId,
        agentId: testUserId,
        to: ["customer@example.com"],
        subject: "Re: Reply auth test",
        htmlBody: "<p>Hi</p>",
      })
    ).rejects.toThrow("Not authenticated");
  });
});
