import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";

describe("tourSteps", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testTourId: Id<"tours">;
  let testStepId1: Id<"tourSteps">;
  let testStepId2: Id<"tourSteps">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);
    testWorkspaceId = (await authenticateClientForWorkspace(client)).workspaceId;

    testTourId = await client.mutation(api.testing.helpers.createTestTour, {
      workspaceId: testWorkspaceId,
      name: "Test Tour for Steps",
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

  it("should create a pointer step", async () => {
    testStepId1 = await client.mutation(api.tourSteps.create, {
      tourId: testTourId,
      type: "pointer",
      content: "Click this button to get started",
      elementSelector: "#start-button",
      position: "below",
      size: "small",
    });

    expect(testStepId1).toBeDefined();
  });

  it("should create a post step", async () => {
    testStepId2 = await client.mutation(api.tourSteps.create, {
      tourId: testTourId,
      type: "post",
      title: "Welcome!",
      content: "Welcome to our application",
    });

    expect(testStepId2).toBeDefined();
  });

  it("should list steps in order", async () => {
    const steps = await client.query(api.tourSteps.list, { tourId: testTourId });

    expect(steps).toBeDefined();
    expect(steps.length).toBe(2);
    expect(steps[0]._id).toBe(testStepId1);
    expect(steps[0].order).toBe(0);
    expect(steps[1]._id).toBe(testStepId2);
    expect(steps[1].order).toBe(1);
  });

  it("should update a step", async () => {
    await client.mutation(api.tourSteps.update, {
      id: testStepId1,
      content: "Updated content",
      advanceOn: "elementClick",
    });

    const steps = await client.query(api.tourSteps.list, { tourId: testTourId });
    const updatedStep = steps.find((s: { _id: Id<"tourSteps"> }) => s._id === testStepId1);

    expect(updatedStep?.content).toBe("Updated content");
    expect(updatedStep?.advanceOn).toBe("elementClick");
  });

  it("should reorder steps", async () => {
    await client.mutation(api.tourSteps.reorder, {
      tourId: testTourId,
      stepIds: [testStepId2, testStepId1],
    });

    const steps = await client.query(api.tourSteps.list, { tourId: testTourId });

    expect(steps[0]._id).toBe(testStepId2);
    expect(steps[0].order).toBe(0);
    expect(steps[1]._id).toBe(testStepId1);
    expect(steps[1].order).toBe(1);
  });

  it("should delete a step and reorder remaining", async () => {
    const result = await client.mutation(api.tourSteps.remove, { id: testStepId2 });

    expect(result.success).toBe(true);

    const steps = await client.query(api.tourSteps.list, { tourId: testTourId });

    expect(steps.length).toBe(1);
    expect(steps[0]._id).toBe(testStepId1);
    expect(steps[0].order).toBe(0);
  });
});
