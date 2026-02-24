import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

const WEBHOOK_ACCESS_ERROR = /Unauthorized|Webhook internal secret is not configured/;

function createMockResendInboundPayload(options: {
  from: string;
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
}) {
  const messageId =
    options.messageId || `<${Date.now()}.${Math.random().toString(36).slice(2)}@example.com>`;

  return {
    type: "email.received",
    created_at: new Date().toISOString(),
    data: {
      from: options.from,
      to: options.to,
      subject: options.subject,
      text: options.text || "",
      html: options.html || "",
      headers: {
        "message-id": messageId,
        ...(options.inReplyTo && { "in-reply-to": options.inReplyTo }),
        ...(options.references && { references: options.references.join(" ") }),
      },
      attachments: [],
    },
  };
}

function createMockResendStatusPayload(options: {
  emailId: string;
  status: "sent" | "delivered" | "bounced" | "complained";
  to: string;
}) {
  return {
    type: `email.${options.status}`,
    created_at: new Date().toISOString(),
    data: {
      email_id: options.emailId,
      to: [options.to],
    },
  };
}

describe("emailChannelE2E", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testForwardingAddress: string;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    const workspace = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    testWorkspaceId = workspace.workspaceId;

    const emailConfig = await client.mutation(api.testing.helpers.createTestEmailConfig, {
      workspaceId: testWorkspaceId,
      enabled: true,
      fromName: "E2E Test Support",
      fromEmail: "noreply@support.opencom.dev",
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

  it("builds a realistic inbound webhook payload", () => {
    const payload = createMockResendInboundPayload({
      from: "customer@example.com",
      to: ["inbox@example.com"],
      subject: "Need help",
      text: "Hello",
      inReplyTo: "<original@example.com>",
      references: ["<root@example.com>", "<original@example.com>"],
    });

    expect(payload.type).toBe("email.received");
    expect(payload.data.headers["message-id"]).toContain("@");
    expect(payload.data.headers["in-reply-to"]).toBe("<original@example.com>");
    expect(payload.data.headers.references).toContain("<root@example.com>");
  });

  it("builds a realistic delivery webhook payload", () => {
    const payload = createMockResendStatusPayload({
      emailId: "re_123",
      status: "delivered",
      to: "customer@example.com",
    });

    expect(payload.type).toBe("email.delivered");
    expect(payload.data.email_id).toBe("re_123");
    expect(payload.data.to).toEqual(["customer@example.com"]);
  });

  it("rejects inbound processing without webhook internal access", async () => {
    const payload = createMockResendInboundPayload({
      from: "customer@example.com",
      to: [testForwardingAddress],
      subject: "Need help",
      text: "Hello",
    });

    await expect(
      client.mutation(api.emailChannel.processInboundEmail, {
        workspaceId: testWorkspaceId,
        from: payload.data.from,
        to: payload.data.to,
        subject: payload.data.subject,
        textBody: payload.data.text,
        messageId: payload.data.headers["message-id"],
      })
    ).rejects.toThrow(WEBHOOK_ACCESS_ERROR);
  });

  it("rejects forwarded processing without webhook internal access", async () => {
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
});

export { createMockResendInboundPayload, createMockResendStatusPayload };
