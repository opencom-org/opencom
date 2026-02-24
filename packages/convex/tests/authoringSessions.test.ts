import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";

describe("authoringSessions", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testTourId: Id<"tours">;
  let testStepId: Id<"tourSteps">;
  let testToken: string;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);
    testWorkspaceId = (await authenticateClientForWorkspace(client)).workspaceId;

    // Create a test tour
    testTourId = await client.mutation(api.testing.helpers.createTestTour, {
      workspaceId: testWorkspaceId,
      name: "Authoring Test Tour",
      description: "A tour for testing authoring mode",
    });

    // Create a test step
    testStepId = await client.mutation(api.tourSteps.create, {
      tourId: testTourId,
      type: "pointer",
      content: "Click the button",
      elementSelector: "#test-button",
    });
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

  it("should create an authoring session", async () => {
    const result = await client.mutation(api.authoringSessions.create, {
      tourId: testTourId,
      targetUrl: "https://example.com/dashboard",
    });

    expect(result.sessionId).toBeDefined();
    expect(result.token).toBeDefined();
    expect(result.token.length).toBe(32);

    testToken = result.token;
  });

  it("should validate a valid session", async () => {
    const result = await client.query(api.authoringSessions.validate, {
      token: testToken,
    });

    expect(result.valid).toBe(true);
    expect(result.session?.tourId).toBe(testTourId);
    expect(result.session?.targetUrl).toBe("https://example.com/dashboard");
    expect(result.tour?.name).toBe("Authoring Test Tour");
    expect(result.steps?.length).toBe(1);
  });

  it("should reject invalid token", async () => {
    const result = await client.query(api.authoringSessions.validate, {
      token: "invalid-token-12345",
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Session not found");
  });

  it("should create session with specific step", async () => {
    const result = await client.mutation(api.authoringSessions.create, {
      tourId: testTourId,
      stepId: testStepId,
      targetUrl: "https://example.com/dashboard",
    });

    const validation = await client.query(api.authoringSessions.validate, {
      token: result.token,
    });

    expect(validation.valid).toBe(true);
    expect(validation.session?.stepId).toBe(testStepId);
  });

  it("should update step selector via authoring session", async () => {
    const newSelector = "#new-element-selector";

    await client.mutation(api.authoringSessions.updateStep, {
      token: testToken,
      stepId: testStepId,
      elementSelector: newSelector,
    });

    const step = await client.query(api.tourSteps.list, { tourId: testTourId });
    const updatedStep = step.find((s: { _id: Id<"tourSteps"> }) => s._id === testStepId);

    expect(updatedStep?.elementSelector).toBe(newSelector);
  });

  it("should set current step in session", async () => {
    await client.mutation(api.authoringSessions.setCurrentStep, {
      token: testToken,
      stepId: testStepId,
    });

    const validation = await client.query(api.authoringSessions.validate, {
      token: testToken,
    });

    expect(validation.session?.stepId).toBe(testStepId);
  });

  it("should reject updateStep for wrong tour", async () => {
    // Create another tour and step
    const otherTourId = await client.mutation(api.testing.helpers.createTestTour, {
      workspaceId: testWorkspaceId,
      name: "Other Tour",
    });

    const otherStepId = await client.mutation(api.tourSteps.create, {
      tourId: otherTourId,
      type: "pointer",
      content: "Other step",
      elementSelector: "#other-step",
    });

    // Try to update the other step using our session token
    await expect(
      client.mutation(api.authoringSessions.updateStep, {
        token: testToken,
        stepId: otherStepId,
        elementSelector: "#hacked",
      })
    ).rejects.toThrow("Step does not belong to this tour");
  });

  it("should end an authoring session", async () => {
    const result = await client.mutation(api.authoringSessions.end, {
      token: testToken,
    });

    expect(result.success).toBe(true);

    // Verify session is gone
    const validation = await client.query(api.authoringSessions.validate, {
      token: testToken,
    });

    expect(validation.valid).toBe(false);
    expect(validation.reason).toBe("Session not found");
  });
});
