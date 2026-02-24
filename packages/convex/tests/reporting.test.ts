import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import {
  cleanupTestData,
  createTestConversation,
  createTestSessionToken,
  createTestVisitor,
  createTestWorkspace,
  upsertTestAutomationSettings,
} from "./helpers/testHelpers";

describe("reporting authorization", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testVisitorId: Id<"visitors">;
  let testConversationId: Id<"conversations">;
  let sessionToken: string;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    const workspace = await createTestWorkspace(client);
    testWorkspaceId = workspace.workspaceId;

    const visitor = await createTestVisitor(client, {
      workspaceId: testWorkspaceId,
    });
    testVisitorId = visitor.visitorId;

    const session = await createTestSessionToken(client, {
      visitorId: testVisitorId,
      workspaceId: testWorkspaceId,
    });
    sessionToken = session.sessionToken;

    const conversation = await createTestConversation(client, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
    });
    testConversationId = conversation.conversationId;

    await upsertTestAutomationSettings(client, {
      workspaceId: testWorkspaceId,
      askForRatingEnabled: true,
    });
  });

  afterAll(async () => {
    if (testWorkspaceId) {
      try {
        await cleanupTestData(client, { workspaceId: testWorkspaceId });
      } catch (e) {
        console.warn("Cleanup failed:", e);
      }
    }
    await client.close();
  });

  it("report queries require authentication", async () => {
    const now = Date.now();
    await expect(
      client.query(api.reporting.getConversationMetrics, {
        workspaceId: testWorkspaceId,
        startDate: now - 24 * 60 * 60 * 1000,
        endDate: now + 1000,
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.query(api.reporting.getDashboardSummary, {
        workspaceId: testWorkspaceId,
        startDate: now - 24 * 60 * 60 * 1000,
        endDate: now + 1000,
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("snapshot write/read endpoints require authentication", async () => {
    const now = Date.now();
    await expect(
      client.mutation(api.reporting.saveReportSnapshot, {
        workspaceId: testWorkspaceId,
        reportType: "conversations",
        periodStart: now - 24 * 60 * 60 * 1000,
        periodEnd: now,
        granularity: "day",
        metrics: { total: 1 },
      })
    ).rejects.toThrow("Not authenticated");

    await expect(
      client.query(api.reporting.getReportSnapshot, {
        workspaceId: testWorkspaceId,
        reportType: "conversations",
        periodStart: now - 24 * 60 * 60 * 1000,
        periodEnd: now,
      })
    ).rejects.toThrow("Not authenticated");
  });

  it("CSAT submission rejects unauthenticated calls without a valid visitor session", async () => {
    await expect(
      client.mutation(api.reporting.submitCsatResponse, {
        conversationId: testConversationId,
        rating: 5,
      })
    ).rejects.toThrow("Not authorized to submit CSAT response");

    await expect(
      client.mutation(api.reporting.submitCsatResponse, {
        conversationId: testConversationId,
        rating: 5,
        visitorId: testVisitorId,
      })
    ).rejects.toThrow("Not authorized to submit CSAT response");
  });

  it("CSAT eligibility query rejects unauthenticated calls without a valid visitor session", async () => {
    await expect(
      client.query(api.reporting.getCsatEligibility, {
        conversationId: testConversationId,
      })
    ).rejects.toThrow("Not authorized to submit CSAT response");
  });

  it("CSAT submission allows visitor flow with valid session token", async () => {
    const conversation = await createTestConversation(client, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
      status: "closed",
    });

    const csatId = await client.mutation(api.reporting.submitCsatResponse, {
      conversationId: conversation.conversationId,
      rating: 4,
      visitorId: testVisitorId,
      sessionToken,
      feedback: "Helpful support",
    });

    expect(csatId).toBeDefined();
  });

  it("CSAT submission is blocked when Ask for Rating is disabled", async () => {
    await upsertTestAutomationSettings(client, {
      workspaceId: testWorkspaceId,
      askForRatingEnabled: false,
    });

    const conversation = await createTestConversation(client, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
      status: "closed",
    });

    await expect(
      client.mutation(api.reporting.submitCsatResponse, {
        conversationId: conversation.conversationId,
        rating: 5,
        visitorId: testVisitorId,
        sessionToken,
      })
    ).rejects.toThrow("CSAT collection is disabled for this workspace");

    await upsertTestAutomationSettings(client, {
      workspaceId: testWorkspaceId,
      askForRatingEnabled: true,
    });
  });

  it("CSAT submission rejects invalid or reused session contexts", async () => {
    const conversation = await createTestConversation(client, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
      status: "closed",
    });

    await expect(
      client.mutation(api.reporting.submitCsatResponse, {
        conversationId: conversation.conversationId,
        rating: 5,
        visitorId: testVisitorId,
        sessionToken: "wst_test_invalid_token",
      })
    ).rejects.toThrow("Invalid session token");

    const csatId = await client.mutation(api.reporting.submitCsatResponse, {
      conversationId: conversation.conversationId,
      rating: 5,
      visitorId: testVisitorId,
      sessionToken,
    });
    expect(csatId).toBeDefined();

    await expect(
      client.mutation(api.reporting.submitCsatResponse, {
        conversationId: conversation.conversationId,
        rating: 3,
        visitorId: testVisitorId,
        sessionToken,
      })
    ).rejects.toThrow("CSAT response already submitted");
  });

  it("CSAT eligibility reports already-submitted conversations as ineligible", async () => {
    const conversation = await createTestConversation(client, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
      status: "closed",
    });

    const beforeSubmit = await client.query(api.reporting.getCsatEligibility, {
      conversationId: conversation.conversationId,
      visitorId: testVisitorId,
      sessionToken,
    });
    expect(beforeSubmit.eligible).toBe(true);
    expect(beforeSubmit.reason).toBe("eligible");

    await client.mutation(api.reporting.submitCsatResponse, {
      conversationId: conversation.conversationId,
      rating: 4,
      visitorId: testVisitorId,
      sessionToken,
    });

    const afterSubmit = await client.query(api.reporting.getCsatEligibility, {
      conversationId: conversation.conversationId,
      visitorId: testVisitorId,
      sessionToken,
    });
    expect(afterSubmit.eligible).toBe(false);
    expect(afterSubmit.reason).toBe("already_submitted");
    expect(afterSubmit.alreadySubmitted).toBe(true);
  });
});
