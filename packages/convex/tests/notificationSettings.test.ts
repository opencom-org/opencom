import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

describe("notification settings", () => {
  let client: ConvexClient;
  let workspaceId: Id<"workspaces">;
  let agentUserId: Id<"users">;
  let agentEmail: string;
  let visitorId: Id<"visitors">;
  let visitorConversationId: Id<"conversations">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }

    client = new ConvexClient(convexUrl);

    const workspace = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    workspaceId = workspace.workspaceId;

    const agent = await client.mutation(api.testing.helpers.createTestUser, {
      workspaceId,
      email: `notify-agent-${Date.now()}@test.opencom.dev`,
      role: "agent",
    });
    agentUserId = agent.userId;
    agentEmail = agent.email;

    const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId,
      email: `visitor-${Date.now()}@example.com`,
      name: "Notification Visitor",
    });
    visitorId = visitor.visitorId;

    const conversation = await client.mutation(api.testing.helpers.createTestConversation, {
      workspaceId,
      visitorId,
    });
    visitorConversationId = conversation.conversationId;
  });

  afterAll(async () => {
    if (workspaceId) {
      try {
        await client.mutation(api.testing.helpers.cleanupTestData, {
          workspaceId,
        });
      } catch (error) {
        console.warn("Cleanup failed:", error);
      }
    }

    await client.close();
  });

  it("defaults member email notifications to enabled for new visitor messages", async () => {
    const recipients = await client.mutation(
      api.testing.helpers.getTestMemberRecipientsForNewVisitorMessage,
      {
        workspaceId,
      }
    );

    expect(recipients.emailRecipients).toContain(agentEmail);
  });

  it("suppresses member email notifications after opt-out", async () => {
    await client.mutation(api.testing.helpers.upsertTestNotificationPreference, {
      userId: agentUserId,
      workspaceId,
      newVisitorMessageEmail: false,
    });

    const recipients = await client.mutation(
      api.testing.helpers.getTestMemberRecipientsForNewVisitorMessage,
      {
        workspaceId,
      }
    );

    expect(recipients.emailRecipients).not.toContain(agentEmail);
  });

  it("excludes disabled member device tokens from push recipients", async () => {
    const enabledToken = await client.mutation(api.testing.helpers.createTestPushToken, {
      userId: agentUserId,
      notificationsEnabled: true,
    });
    const disabledToken = await client.mutation(api.testing.helpers.createTestPushToken, {
      userId: agentUserId,
      notificationsEnabled: false,
    });

    await client.mutation(api.testing.helpers.upsertTestNotificationPreference, {
      userId: agentUserId,
      workspaceId,
      newVisitorMessagePush: true,
    });

    const recipients = await client.mutation(
      api.testing.helpers.getTestMemberRecipientsForNewVisitorMessage,
      {
        workspaceId,
      }
    );

    const agentTokens = recipients.pushRecipients
      .filter(
        (recipient: { userId: Id<"users">; token: string }) => recipient.userId === agentUserId
      )
      .map((recipient: { token: string }) => recipient.token);

    expect(agentTokens).toContain(enabledToken.token);
    expect(agentTokens).not.toContain(disabledToken.token);
  });

  it("resolves visitor support reply recipients and suppresses duplicate email-channel notifications", async () => {
    const enabledVisitorToken = await client.mutation(
      api.testing.helpers.createTestVisitorPushToken,
      {
        visitorId,
        notificationsEnabled: true,
      }
    );
    const disabledVisitorToken = await client.mutation(
      api.testing.helpers.createTestVisitorPushToken,
      {
        visitorId,
        notificationsEnabled: false,
      }
    );

    const chatRecipients = await client.mutation(
      api.testing.helpers.getTestVisitorRecipientsForSupportReply,
      {
        conversationId: visitorConversationId,
        channel: "chat",
      }
    );

    expect(chatRecipients.emailRecipient).toMatch(/@example\.com$/);
    expect(chatRecipients.pushTokens).toContain(enabledVisitorToken.token);
    expect(chatRecipients.pushTokens).not.toContain(disabledVisitorToken.token);

    const emailChannelRecipients = await client.mutation(
      api.testing.helpers.getTestVisitorRecipientsForSupportReply,
      {
        conversationId: visitorConversationId,
        channel: "email",
      }
    );

    expect(emailChannelRecipients.emailRecipient).toBeNull();
  });

  it("does not resolve visitor email recipient when visitor email is missing", async () => {
    const noEmailVisitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId,
      name: "No Email Visitor",
    });

    const noEmailConversation = await client.mutation(api.testing.helpers.createTestConversation, {
      workspaceId,
      visitorId: noEmailVisitor.visitorId,
    });

    const recipients = await client.mutation(
      api.testing.helpers.getTestVisitorRecipientsForSupportReply,
      {
        conversationId: noEmailConversation.conversationId,
        channel: "chat",
      }
    );

    expect(recipients.emailRecipient).toBeNull();
  });
});
