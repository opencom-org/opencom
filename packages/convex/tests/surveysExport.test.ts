import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";
import {
  cleanupTestData,
  createTestSessionToken,
  createTestSurvey,
  createTestVisitor,
  updateTestMemberPermissions,
} from "./helpers/testHelpers";

describe("surveys export (real Convex backend)", () => {
  let client: ConvexClient;
  let workspaceId: Id<"workspaces">;
  let surveyId: Id<"surveys">;
  let userEmail: string;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }

    client = new ConvexClient(convexUrl);
    const auth = await authenticateClientForWorkspace(client);
    workspaceId = auth.workspaceId;
    userEmail = auth.email;

    const survey = await createTestSurvey(client, {
      workspaceId,
      status: "active",
    });
    surveyId = survey.surveyId;

    const visitor = await createTestVisitor(client, { workspaceId });
    const session = await createTestSessionToken(client, {
      visitorId: visitor.visitorId,
      workspaceId,
    });

    await client.mutation(api.surveys.submitResponse, {
      surveyId,
      visitorId: visitor.visitorId,
      sessionToken: session.sessionToken,
      answers: [{ questionId: "q1", value: 9 }],
      isComplete: true,
    });
  });

  beforeEach(async () => {
    await updateTestMemberPermissions(client, {
      workspaceId,
      userEmail,
      permissions: [],
    });
  });

  afterAll(async () => {
    if (workspaceId) {
      try {
        await cleanupTestData(client, { workspaceId });
      } catch (error) {
        console.warn("Cleanup failed:", error);
      }
    }
    await client.close();
  });

  it("exports CSV for authenticated users with data.export", async () => {
    const result = await client.mutation(api.surveys.exportResponsesCsv, { surveyId });

    expect(result.fileName).toContain(`survey-${surveyId}-responses.csv`);
    expect(result.count).toBeGreaterThan(0);
    expect(result.csv).toContain("responseId");
    expect(result.csv).toContain("answer:q1");
    expect(result.csv.split("\n").length).toBeGreaterThan(1);
  });

  it("applies date filtering when exporting responses", async () => {
    const result = await client.mutation(api.surveys.exportResponsesCsv, {
      surveyId,
      startDate: Date.now() + 60_000,
    });

    expect(result.count).toBe(0);
    expect(result.csv).toContain(
      "responseId,visitorId,userId,sessionId,status,startedAt,completedAt,answer:q1"
    );
    expect(result.csv.split("\n")).toHaveLength(1);
  });

  it("rejects export when data.export permission is missing", async () => {
    await updateTestMemberPermissions(client, {
      workspaceId,
      userEmail,
      permissions: ["settings.workspace"],
    });

    await expect(client.mutation(api.surveys.exportResponsesCsv, { surveyId })).rejects.toThrow(
      "Permission denied: data.export"
    );
  });

  it("rejects unauthenticated export calls", async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    const unauthenticatedClient = new ConvexClient(convexUrl);

    try {
      await expect(
        unauthenticatedClient.mutation(api.surveys.exportResponsesCsv, { surveyId })
      ).rejects.toThrow("Not authenticated");
    } finally {
      await unauthenticatedClient.close();
    }
  });
});
