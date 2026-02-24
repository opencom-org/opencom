import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import {
  cleanupTestData,
  createTestSessionToken,
  createTestSurvey,
  createTestVisitor,
  createTestWorkspace,
} from "./helpers/testHelpers";

describe("surveys authorization", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testVisitorId: Id<"visitors">;
  let sessionToken: string;
  let testSurveyId: Id<"surveys">;

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

    const survey = await createTestSurvey(client, {
      workspaceId: testWorkspaceId,
      status: "active",
    });
    testSurveyId = survey.surveyId;
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

  it("admin read endpoints are blocked for unauthenticated callers", async () => {
    const survey = await client.query(api.surveys.get, { id: testSurveyId });
    expect(survey).toBeNull();

    const surveys = await client.query(api.surveys.list, {
      workspaceId: testWorkspaceId,
    });
    expect(surveys).toEqual([]);

    const preview = await client.query(api.surveys.previewAudienceRules, {
      workspaceId: testWorkspaceId,
      audienceRules: undefined,
    });
    expect(preview).toEqual({ total: 0, matching: 0 });

    const responses = await client.query(api.surveys.listResponses, {
      surveyId: testSurveyId,
    });
    expect(responses).toEqual([]);

    await expect(
      client.query(api.surveys.getAnalytics, { surveyId: testSurveyId })
    ).rejects.toThrow("Not authenticated");
  });

  it("visitor response submission requires a valid session token", async () => {
    await expect(
      client.mutation(api.surveys.submitResponse, {
        surveyId: testSurveyId,
        visitorId: testVisitorId,
        answers: [{ questionId: "q1", value: 9 }],
        isComplete: true,
      })
    ).rejects.toThrow("Session token required");

    const responseId = await client.mutation(api.surveys.submitResponse, {
      surveyId: testSurveyId,
      visitorId: testVisitorId,
      sessionToken,
      answers: [{ questionId: "q1", value: 10 }],
      isComplete: true,
    });

    expect(responseId).toBeDefined();
  });

  it("visitor flows reject cross-workspace session tokens", async () => {
    const otherWorkspace = await createTestWorkspace(client);
    const otherVisitor = await createTestVisitor(client, {
      workspaceId: otherWorkspace.workspaceId,
    });
    const otherSession = await createTestSessionToken(client, {
      visitorId: otherVisitor.visitorId,
      workspaceId: otherWorkspace.workspaceId,
    });

    await expect(
      client.mutation(api.surveys.submitResponse, {
        surveyId: testSurveyId,
        visitorId: testVisitorId,
        sessionToken: otherSession.sessionToken,
        answers: [{ questionId: "q1", value: 8 }],
        isComplete: true,
      })
    ).rejects.toThrow("Session token does not match workspace");

    await expect(
      client.mutation(api.surveys.recordImpression, {
        surveyId: testSurveyId,
        visitorId: testVisitorId,
        sessionToken: otherSession.sessionToken,
        action: "shown",
      })
    ).rejects.toThrow("Session token does not match workspace");

    await cleanupTestData(client, {
      workspaceId: otherWorkspace.workspaceId,
    });
  });

  it("recordImpression and getActiveSurveys support valid visitor session path", async () => {
    await expect(
      client.mutation(api.surveys.recordImpression, {
        surveyId: testSurveyId,
        visitorId: testVisitorId,
        action: "shown",
      })
    ).rejects.toThrow("Session token required");

    const impressionId = await client.mutation(api.surveys.recordImpression, {
      surveyId: testSurveyId,
      visitorId: testVisitorId,
      sessionToken,
      action: "shown",
    });
    expect(impressionId).toBeDefined();

    const activeWithToken = await client.query(api.surveys.getActiveSurveys, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
      sessionToken,
    });
    expect(Array.isArray(activeWithToken)).toBe(true);

    const activeWithoutToken = await client.query(api.surveys.getActiveSurveys, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
    });
    expect(activeWithoutToken).toEqual([]);
  });
});
