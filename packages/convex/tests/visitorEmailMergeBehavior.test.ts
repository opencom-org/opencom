import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";

describe("visitor email merge behavior", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);
    testWorkspaceId = (await authenticateClientForWorkspace(client)).workspaceId;
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

  it("merges into a deterministic canonical visitor and persists merge traceability", async () => {
    const email = `merge-canonical-${Date.now()}@test.com`;

    const canonicalFirst = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
      email,
      name: "Canonical First",
    });
    const canonicalFirstBefore = await client.mutation(api.testing.helpers.getTestVisitor, {
      id: canonicalFirst.visitorId,
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    const canonicalSecond = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
      email,
      name: "Canonical Second",
    });

    const source = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
      name: "Source Visitor",
    });
    const sourceBefore = await client.mutation(api.testing.helpers.getTestVisitor, {
      id: source.visitorId,
    });
    expect(sourceBefore).not.toBeNull();

    const sourceSession = await client.mutation(api.testing.helpers.createTestSessionToken, {
      visitorId: source.visitorId,
      workspaceId: testWorkspaceId,
    });
    const sourcePushToken = await client.mutation(api.testing.helpers.createTestVisitorPushToken, {
      visitorId: source.visitorId,
      token: `ExponentPushToken[merge-src-${Date.now()}]`,
    });
    const sourceConversation = await client.mutation(api.testing.helpers.createTestConversation, {
      workspaceId: testWorkspaceId,
      visitorId: source.visitorId,
    });

    const merged = await client.mutation(api.visitors.identify, {
      visitorId: source.visitorId,
      email,
      name: "Merged Visitor Name",
    });

    expect(merged?._id).toBe(canonicalFirst.visitorId);
    expect(merged?._id).not.toBe(canonicalSecond.visitorId);

    const canonicalAfter = await client.mutation(api.testing.helpers.getTestVisitor, {
      id: canonicalFirst.visitorId,
    });
    expect(canonicalAfter).not.toBeNull();
    expect(canonicalAfter?.name).toBe("Merged Visitor Name");
    expect(canonicalAfter?.readableId).toBe(canonicalFirstBefore?.readableId);

    const deletedSource = await client.mutation(api.testing.helpers.getTestVisitor, {
      id: source.visitorId,
    });
    expect(deletedSource).toBeNull();

    const reassignedConversation = await client.mutation(api.testing.helpers.getTestConversation, {
      id: sourceConversation.conversationId,
    });
    expect(reassignedConversation?.visitorId).toBe(canonicalFirst.visitorId);

    const sessionValidation = await client.query(api.widgetSessions.validateSessionToken, {
      workspaceId: testWorkspaceId,
      sessionToken: sourceSession.sessionToken,
    });
    expect(sessionValidation).toMatchObject({
      valid: true,
      visitorId: canonicalFirst.visitorId,
    });

    const replyRecipients = (await client.mutation(
      api.testing.helpers.getTestVisitorRecipientsForSupportReply,
      {
        conversationId: sourceConversation.conversationId,
        channel: "chat",
      }
    )) as { emailRecipient: string | null; pushTokens: string[] };
    expect(replyRecipients.pushTokens).toContain(sourcePushToken.token);

    const mergeHistory = await client.query(api.visitors.getMergeHistory, {
      workspaceId: testWorkspaceId,
      visitorId: canonicalFirst.visitorId,
      limit: 20,
    });

    expect(mergeHistory.status).toBe("ok");
    if (mergeHistory.status === "ok") {
      const entry = mergeHistory.entries.find((item) => item.sourceVisitorId === source.visitorId);
      expect(entry).toBeDefined();
      expect(entry?.targetVisitorId).toBe(canonicalFirst.visitorId);
      expect(entry?.reason).toBe("email_match");
      expect(entry?.workspaceId).toBe(testWorkspaceId);
      expect(entry?.sourceVisitorReadableId).toBe(sourceBefore?.readableId ?? null);
      expect(entry?.targetVisitorReadableId).toBe(canonicalFirstBefore?.readableId ?? null);
      expect(entry?.mergedAt).toBeGreaterThan(0);
      expect(entry?.reassignedConversations).toBeGreaterThanOrEqual(1);
      expect(entry?.reassignedSessions).toBeGreaterThanOrEqual(1);
      expect(entry?.migratedPushTokens).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps merged conversations visible via canonical identity for the source session", async () => {
    const email = `merge-continuity-${Date.now()}@test.com`;

    const canonical = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
      email,
      name: "Canonical",
    });
    const source = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
      name: "Source",
    });

    const canonicalConversation = await client.mutation(
      api.testing.helpers.createTestConversation,
      {
        workspaceId: testWorkspaceId,
        visitorId: canonical.visitorId,
      }
    );
    const sourceConversation = await client.mutation(api.testing.helpers.createTestConversation, {
      workspaceId: testWorkspaceId,
      visitorId: source.visitorId,
    });

    const sourceSession = await client.mutation(api.testing.helpers.createTestSessionToken, {
      visitorId: source.visitorId,
      workspaceId: testWorkspaceId,
    });

    const merged = await client.mutation(api.visitors.identify, {
      visitorId: source.visitorId,
      email,
    });
    expect(merged?._id).toBe(canonical.visitorId);

    const conversations = await client.query(api.conversations.listByVisitor, {
      workspaceId: testWorkspaceId,
      sessionToken: sourceSession.sessionToken,
    });

    const conversationIds = new Set(conversations.map((conversation) => conversation._id));
    expect(conversationIds.has(canonicalConversation.conversationId)).toBe(true);
    expect(conversationIds.has(sourceConversation.conversationId)).toBe(true);
  });
});
