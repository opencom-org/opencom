import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";

const ONE_BY_ONE_PNG_BYTES = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6,
  0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 248, 15, 4, 0, 9, 251, 3,
  253, 160, 133, 37, 209, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);

const TEXT_FILE_BYTES = new TextEncoder().encode("support diagnostics");

type VisitorUploadContext = {
  workspaceId: Id<"workspaces">;
  visitorId: Id<"visitors">;
  sessionToken: string;
};

type AgentUploadContext = {
  workspaceId: Id<"workspaces">;
};

async function uploadSupportAttachment(
  client: ConvexClient,
  context: VisitorUploadContext | AgentUploadContext,
  fileName: string,
  mimeType: string,
  bytes: Uint8Array
): Promise<{
  attachmentId: Id<"supportAttachments">;
  storageId: Id<"_storage">;
  fileName: string;
  mimeType: string;
  size: number;
}> {
  const uploadUrl = await client.mutation(api.supportAttachments.generateUploadUrl, context);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": mimeType },
    body: bytes,
  });
  expect(response.ok).toBe(true);

  const payload = (await response.json()) as { storageId?: Id<"_storage"> };
  if (!payload.storageId) {
    throw new Error("Storage upload response did not include storageId");
  }

  const finalized = await client.mutation(api.supportAttachments.finalizeUpload, {
    ...context,
    storageId: payload.storageId,
    fileName,
  });

  return {
    ...finalized,
    storageId: payload.storageId,
  };
}

describe("support attachments", () => {
  let agentClient: ConvexClient;
  let visitorClient: ConvexClient;
  let otherVisitorClient: ConvexClient;
  let workspaceId: Id<"workspaces">;
  let userId: Id<"users">;
  let visitorId: Id<"visitors">;
  let visitorSessionToken: string;
  let visitorConversationId: Id<"conversations">;
  let otherVisitorId: Id<"visitors">;
  let otherVisitorSessionToken: string;
  let otherConversationId: Id<"conversations">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }

    agentClient = new ConvexClient(convexUrl);
    visitorClient = new ConvexClient(convexUrl);
    otherVisitorClient = new ConvexClient(convexUrl);

    const authContext = await authenticateClientForWorkspace(agentClient);
    workspaceId = authContext.workspaceId;
    userId = authContext.userId;

    const visitor = await agentClient.mutation(api.testing_helpers.createTestVisitor, {
      workspaceId,
      email: "support-visitor@test.com",
      name: "Support Visitor",
    });
    visitorId = visitor.visitorId;
    const visitorSession = await agentClient.mutation(api.testing_helpers.createTestSessionToken, {
      visitorId,
      workspaceId,
    });
    visitorSessionToken = visitorSession.sessionToken;
    const visitorConversation = await agentClient.mutation(
      api.testing_helpers.createTestConversation,
      {
        workspaceId,
        visitorId,
      }
    );
    visitorConversationId = visitorConversation.conversationId;

    const otherVisitor = await agentClient.mutation(api.testing_helpers.createTestVisitor, {
      workspaceId,
      email: "other-support-visitor@test.com",
      name: "Other Visitor",
    });
    otherVisitorId = otherVisitor.visitorId;
    const otherVisitorSession = await agentClient.mutation(
      api.testing_helpers.createTestSessionToken,
      {
        visitorId: otherVisitorId,
        workspaceId,
      }
    );
    otherVisitorSessionToken = otherVisitorSession.sessionToken;
    const otherConversation = await agentClient.mutation(
      api.testing_helpers.createTestConversation,
      {
        workspaceId,
        visitorId: otherVisitorId,
      }
    );
    otherConversationId = otherConversation.conversationId;
  });

  afterAll(async () => {
    if (workspaceId && agentClient) {
      try {
        await agentClient.mutation(api.testing_helpers.cleanupTestData, {
          workspaceId,
        });
      } catch (error) {
        console.warn("Cleanup failed:", error);
      }
    }
    await Promise.allSettled([
      agentClient?.close?.() ?? Promise.resolve(),
      visitorClient?.close?.() ?? Promise.resolve(),
      otherVisitorClient?.close?.() ?? Promise.resolve(),
    ]);
  });

  it("rejects uploads whose extension is not allowlisted and removes the uploaded storage object", async () => {
    const uploadUrl = await agentClient.mutation(api.supportAttachments.generateUploadUrl, {
      workspaceId,
    });
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: TEXT_FILE_BYTES,
    });
    expect(response.ok).toBe(true);
    const payload = (await response.json()) as { storageId?: Id<"_storage"> };
    expect(payload.storageId).toBeDefined();

    const result = await agentClient.mutation(api.supportAttachments.finalizeUpload, {
      workspaceId,
      storageId: payload.storageId!,
      fileName: "unsupported.bin",
    });
    expect(result).toMatchObject({
      status: "rejected",
    });
    if (result.status !== "rejected") {
      throw new Error("Expected rejected upload result");
    }
    expect(result.message).toMatch(/Unsupported file type/);

    const stillExists = await agentClient.mutation(api.testing_helpers.hasTestStoredFile, {
      storageId: payload.storageId!,
    });
    expect(stillExists).toBe(false);
  });

  it("binds visitor uploads to chat messages and returns attachment descriptors", async () => {
    const attachment = await uploadSupportAttachment(
      visitorClient,
      {
        workspaceId,
        visitorId,
        sessionToken: visitorSessionToken,
      },
      "chat-attachment.png",
      "image/png",
      ONE_BY_ONE_PNG_BYTES
    );

    await visitorClient.mutation(api.messages.send, {
      conversationId: visitorConversationId,
      senderId: visitorId,
      senderType: "visitor",
      content: "",
      attachmentIds: [attachment.attachmentId],
      visitorId,
      sessionToken: visitorSessionToken,
    });

    const messages = await visitorClient.query(api.messages.list, {
      conversationId: visitorConversationId,
      visitorId,
      sessionToken: visitorSessionToken,
    });
    const attachedMessage = messages.find((message) => (message.attachments?.length ?? 0) === 1);

    expect(attachedMessage).toBeDefined();
    expect(attachedMessage?.attachments).toHaveLength(1);
    expect(attachedMessage?.attachments?.[0]?.fileName).toBe("chat-attachment.png");
    expect(attachedMessage?.attachments?.[0]?.url).toBeTruthy();
  });

  it("rejects staged attachments uploaded by another visitor", async () => {
    const attachment = await uploadSupportAttachment(
      visitorClient,
      {
        workspaceId,
        visitorId,
        sessionToken: visitorSessionToken,
      },
      "private-log.txt",
      "text/plain",
      TEXT_FILE_BYTES
    );

    await expect(
      otherVisitorClient.mutation(api.messages.send, {
        conversationId: otherConversationId,
        senderId: otherVisitorId,
        senderType: "visitor",
        content: "Trying to reuse another visitor attachment",
        attachmentIds: [attachment.attachmentId],
        visitorId: otherVisitorId,
        sessionToken: otherVisitorSessionToken,
      })
    ).rejects.toThrow(/Not authorized/);
  });

  it("binds attachments to ticket submissions and agent replies", async () => {
    const ticketAttachment = await uploadSupportAttachment(
      visitorClient,
      {
        workspaceId,
        visitorId,
        sessionToken: visitorSessionToken,
      },
      "ticket-context.png",
      "image/png",
      ONE_BY_ONE_PNG_BYTES
    );

    const ticketId = await visitorClient.mutation(api.tickets.create, {
      workspaceId,
      visitorId,
      sessionToken: visitorSessionToken,
      subject: "Attachment-enabled ticket",
      description: "",
      attachmentIds: [ticketAttachment.attachmentId],
    });

    const commentAttachment = await uploadSupportAttachment(
      agentClient,
      { workspaceId },
      "reply-note.txt",
      "text/plain",
      TEXT_FILE_BYTES
    );

    const commentId = await agentClient.mutation(api.tickets.addComment, {
      ticketId,
      content: "Attached a text note with the fix.",
      attachmentIds: [commentAttachment.attachmentId],
      isInternal: false,
      authorId: userId,
      authorType: "agent",
    });

    const ticketResult = await agentClient.query(api.tickets.getForAdminView, {
      id: ticketId,
    });

    expect(ticketResult.status).toBe("ok");
    expect(ticketResult.ticket?.attachments).toHaveLength(1);
    expect(ticketResult.ticket?.attachments?.[0]?.fileName).toBe("ticket-context.png");

    const replyComment = ticketResult.ticket?.comments?.find((comment) => comment._id === commentId);
    expect(replyComment?.attachments).toHaveLength(1);
    expect(replyComment?.attachments?.[0]?.fileName).toBe("reply-note.txt");
  });

  it("cleans up expired staged uploads and deletes the underlying stored file", async () => {
    const attachment = await uploadSupportAttachment(
      visitorClient,
      {
        workspaceId,
        visitorId,
        sessionToken: visitorSessionToken,
      },
      "expired-upload.png",
      "image/png",
      ONE_BY_ONE_PNG_BYTES
    );

    await agentClient.mutation(api.testing_helpers.expireTestSupportAttachment, {
      attachmentId: attachment.attachmentId,
    });

    const storedBeforeCleanup = await agentClient.mutation(api.testing_helpers.hasTestStoredFile, {
      storageId: attachment.storageId,
    });
    expect(storedBeforeCleanup).toBe(true);

    await agentClient.mutation(api.testing_helpers.cleanupExpiredSupportAttachments, {
      limit: 10,
    });

    const deletedAttachment = await agentClient.mutation(api.testing_helpers.getTestSupportAttachment, {
      attachmentId: attachment.attachmentId,
    });
    const storedAfterCleanup = await agentClient.mutation(api.testing_helpers.hasTestStoredFile, {
      storageId: attachment.storageId,
    });

    expect(deletedAttachment).toBeNull();
    expect(storedAfterCleanup).toBe(false);
  });
});
