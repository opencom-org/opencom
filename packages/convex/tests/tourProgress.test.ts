import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";

describe("tourProgress", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testTourId: Id<"tours">;
  let testVisitorId: Id<"visitors">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);
    testWorkspaceId = (await authenticateClientForWorkspace(client)).workspaceId;

    const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
      email: "tour-visitor@test.com",
      name: "Tour Test Visitor",
    });
    testVisitorId = visitor.visitorId;

    testTourId = await client.mutation(api.testing.helpers.createTestTour, {
      workspaceId: testWorkspaceId,
      name: "Progress Test Tour",
    });

    // Add some steps
    await client.mutation(api.tourSteps.create, {
      tourId: testTourId,
      type: "pointer",
      content: "Step 1",
      elementSelector: "#step1",
    });

    await client.mutation(api.tourSteps.create, {
      tourId: testTourId,
      type: "post",
      content: "Step 2",
    });

    // Activate the tour
    await client.mutation(api.testing.helpers.activateTestTour, { id: testTourId });
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

  it("should start a tour", async () => {
    const progressId = await client.mutation(api.tourProgress.start, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
      tourId: testTourId,
    });

    expect(progressId).toBeDefined();
  });

  it("should get active tours for visitor", async () => {
    const active = await client.query(api.tourProgress.getActive, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
    });

    expect(active).toBeDefined();
    expect(active.length).toBeGreaterThan(0);
    expect(active[0].tour._id).toBe(testTourId);
    expect(active[0].currentStep).toBe(0);
  });

  it("should advance to next step", async () => {
    await client.mutation(api.tourProgress.advance, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
      tourId: testTourId,
    });

    const active = await client.query(api.tourProgress.getActive, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
    });

    expect(active[0].currentStep).toBe(1);
  });

  it("should complete tour on final advance", async () => {
    await client.mutation(api.tourProgress.advance, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
      tourId: testTourId,
    });

    const active = await client.query(api.tourProgress.getActive, {
      workspaceId: testWorkspaceId,
      visitorId: testVisitorId,
    });

    // Tour should no longer be active after completion
    expect(active.some((t: { tour: { _id: Id<"tours"> } }) => t.tour._id === testTourId)).toBe(
      false
    );
  });

  it("should snooze a tour", async () => {
    // Create a new visitor for snooze test
    const visitor2 = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
      email: "snooze-visitor@test.com",
      name: "Snooze Test Visitor",
    });

    await client.mutation(api.tourProgress.start, {
      workspaceId: testWorkspaceId,
      visitorId: visitor2.visitorId,
      tourId: testTourId,
    });

    await client.mutation(api.tourProgress.snooze, {
      workspaceId: testWorkspaceId,
      visitorId: visitor2.visitorId,
      tourId: testTourId,
    });

    const active = await client.query(api.tourProgress.getActive, {
      workspaceId: testWorkspaceId,
      visitorId: visitor2.visitorId,
    });

    // Snoozed tour should not be in active list (until snooze expires)
    expect(active.some((t: { tour: { _id: Id<"tours"> } }) => t.tour._id === testTourId)).toBe(
      false
    );
  });

  it("should dismiss a tour", async () => {
    // Create a new visitor for dismiss test
    const visitor3 = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
      email: "dismiss-visitor@test.com",
      name: "Dismiss Test Visitor",
    });

    await client.mutation(api.tourProgress.start, {
      workspaceId: testWorkspaceId,
      visitorId: visitor3.visitorId,
      tourId: testTourId,
    });

    await client.mutation(api.tourProgress.dismiss, {
      workspaceId: testWorkspaceId,
      visitorId: visitor3.visitorId,
      tourId: testTourId,
    });

    const active = await client.query(api.tourProgress.getActive, {
      workspaceId: testWorkspaceId,
      visitorId: visitor3.visitorId,
    });

    // Dismissed tour should not be in active list
    expect(active.some((t: { tour: { _id: Id<"tours"> } }) => t.tour._id === testTourId)).toBe(
      false
    );
  });

  it("should restart a tour", async () => {
    // Create a new visitor for restart test
    const visitor4 = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
      email: "restart-visitor@test.com",
      name: "Restart Test Visitor",
    });

    await client.mutation(api.tourProgress.start, {
      workspaceId: testWorkspaceId,
      visitorId: visitor4.visitorId,
      tourId: testTourId,
    });

    await client.mutation(api.tourProgress.advance, {
      workspaceId: testWorkspaceId,
      visitorId: visitor4.visitorId,
      tourId: testTourId,
    });

    await client.mutation(api.tourProgress.restart, {
      workspaceId: testWorkspaceId,
      visitorId: visitor4.visitorId,
      tourId: testTourId,
    });

    const active = await client.query(api.tourProgress.getActive, {
      workspaceId: testWorkspaceId,
      visitorId: visitor4.visitorId,
    });

    expect(active[0].currentStep).toBe(0);
  });

  it("persists route checkpoints and resumes multi-page progress", async () => {
    const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
      email: "checkpoint-visitor@test.com",
      name: "Checkpoint Visitor",
    });

    const checkpointTourId = await client.mutation(api.testing.helpers.createTestTour, {
      workspaceId: testWorkspaceId,
      name: "Checkpoint Tour",
      displayMode: "first_time_only",
      priority: 0,
    });

    await client.mutation(api.tourSteps.create, {
      tourId: checkpointTourId,
      type: "post",
      content: "Step 1",
      routePath: "/widget-demo?fixture=tour-step-1",
      advanceOn: "click",
    });
    await client.mutation(api.tourSteps.create, {
      tourId: checkpointTourId,
      type: "pointer",
      content: "Step 2",
      elementSelector: "[data-testid='tour-target-2']",
      routePath: "/widget-demo?fixture=tour-step-2",
      advanceOn: "elementClick",
    });
    await client.mutation(api.testing.helpers.activateTestTour, { id: checkpointTourId });

    await client.mutation(api.tourProgress.start, {
      workspaceId: testWorkspaceId,
      visitorId: visitor.visitorId,
      tourId: checkpointTourId,
      currentUrl: "http://localhost:3000/widget-demo?fixture=tour-step-1",
    });

    const firstAdvance = await client.mutation(api.tourProgress.advance, {
      workspaceId: testWorkspaceId,
      visitorId: visitor.visitorId,
      tourId: checkpointTourId,
      mode: "click",
      currentUrl: "http://localhost:3000/widget-demo?fixture=tour-step-1",
    });
    expect(firstAdvance.advanced).toBe(true);
    expect(firstAdvance.nextStep).toBe(1);

    const activeAfterAdvance = await client.query(api.tourProgress.getActive, {
      workspaceId: testWorkspaceId,
      visitorId: visitor.visitorId,
    });
    const resumed = activeAfterAdvance.find((item) => item.tour._id === checkpointTourId);
    expect(resumed).toBeDefined();
    expect(resumed?.currentStep).toBe(1);
    expect(resumed?.checkpointRoute).toBe("/widget-demo?fixture=tour-step-2");

    // Starting again should not reset in-progress state.
    await client.mutation(api.tourProgress.start, {
      workspaceId: testWorkspaceId,
      visitorId: visitor.visitorId,
      tourId: checkpointTourId,
      currentUrl: "http://localhost:3000/widget-demo?fixture=tour-step-1",
    });

    const available = await client.query(api.tourProgress.getAvailableTours, {
      workspaceId: testWorkspaceId,
      visitorId: visitor.visitorId,
      currentUrl: "http://localhost:3000/widget-demo?fixture=tour-step-1",
    });
    const checkpointTour = available.find((item) => item.tour._id === checkpointTourId);
    expect(checkpointTour?.progress?.status).toBe("in_progress");
    expect(checkpointTour?.progress?.currentStep).toBe(1);
  });

  it("enforces advancement mode preconditions and records diagnostics", async () => {
    const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
      email: "mode-visitor@test.com",
      name: "Mode Visitor",
    });

    const modeTourId = await client.mutation(api.testing.helpers.createTestTour, {
      workspaceId: testWorkspaceId,
      name: "Mode Guard Tour",
    });

    await client.mutation(api.tourSteps.create, {
      tourId: modeTourId,
      type: "pointer",
      content: "Click the target",
      elementSelector: "[data-testid='tour-target-1']",
      advanceOn: "elementClick",
      routePath: "/widget-demo",
    });
    await client.mutation(api.testing.helpers.activateTestTour, { id: modeTourId });

    await client.mutation(api.tourProgress.start, {
      workspaceId: testWorkspaceId,
      visitorId: visitor.visitorId,
      tourId: modeTourId,
      currentUrl: "http://localhost:3000/widget-demo",
    });

    const blocked = await client.mutation(api.tourProgress.advance, {
      workspaceId: testWorkspaceId,
      visitorId: visitor.visitorId,
      tourId: modeTourId,
      mode: "click",
      currentUrl: "http://localhost:3000/widget-demo",
    });
    expect(blocked.advanced).toBe(false);
    expect(blocked.blockedReason).toBe("mode_mismatch");

    const diagnostics = await client.query(api.tourProgress.listDiagnostics, {
      workspaceId: testWorkspaceId,
      visitorId: visitor.visitorId,
      tourId: modeTourId,
      limit: 5,
    });
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0]?.reason).toBe("mode_mismatch");
  });

  it("records diagnostics when skipping invalid selector steps", async () => {
    const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
      email: "skip-visitor@test.com",
      name: "Skip Visitor",
    });

    const skipTourId = await client.mutation(api.testing.helpers.createTestTour, {
      workspaceId: testWorkspaceId,
      name: "Skip Tour",
    });

    await client.mutation(api.tourSteps.create, {
      tourId: skipTourId,
      type: "pointer",
      content: "Missing target",
      elementSelector: "[data-testid='tour-target-missing']",
      routePath: "/widget-demo",
      advanceOn: "click",
    });
    await client.mutation(api.tourSteps.create, {
      tourId: skipTourId,
      type: "post",
      content: "Recovery step",
      advanceOn: "click",
    });
    await client.mutation(api.testing.helpers.activateTestTour, { id: skipTourId });

    await client.mutation(api.tourProgress.start, {
      workspaceId: testWorkspaceId,
      visitorId: visitor.visitorId,
      tourId: skipTourId,
      currentUrl: "http://localhost:3000/widget-demo",
    });

    const skipped = await client.mutation(api.tourProgress.skipStep, {
      workspaceId: testWorkspaceId,
      visitorId: visitor.visitorId,
      tourId: skipTourId,
      reason: "selector_missing",
      currentUrl: "http://localhost:3000/widget-demo",
      selector: "[data-testid='tour-target-missing']",
    });
    expect(skipped.skipped).toBe(true);
    expect(skipped.nextStep).toBe(1);

    const diagnostics = await client.query(api.tourProgress.listDiagnostics, {
      workspaceId: testWorkspaceId,
      visitorId: visitor.visitorId,
      tourId: skipTourId,
      limit: 5,
    });
    expect(diagnostics[0]?.reason).toBe("selector_missing");
    expect(diagnostics[0]?.mode).toBe("system");
  });

  describe("displayMode filtering", () => {
    let firstTimeOnlyTourId: Id<"tours">;
    let untilDismissedTourId: Id<"tours">;
    let displayModeVisitorId: Id<"visitors">;

    beforeAll(async () => {
      // Create visitor for displayMode tests
      const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
        workspaceId: testWorkspaceId,
        email: "displaymode-visitor@test.com",
        name: "DisplayMode Test Visitor",
      });
      displayModeVisitorId = visitor.visitorId;

      // Create first_time_only tour
      firstTimeOnlyTourId = await client.mutation(api.testing.helpers.createTestTour, {
        workspaceId: testWorkspaceId,
        name: "First Time Only Tour",
        displayMode: "first_time_only",
        priority: 1,
      });
      await client.mutation(api.tourSteps.create, {
        tourId: firstTimeOnlyTourId,
        type: "post",
        content: "First time step",
      });
      await client.mutation(api.testing.helpers.activateTestTour, { id: firstTimeOnlyTourId });

      // Create until_dismissed tour
      untilDismissedTourId = await client.mutation(api.testing.helpers.createTestTour, {
        workspaceId: testWorkspaceId,
        name: "Until Dismissed Tour",
        displayMode: "until_dismissed",
        priority: 2,
      });
      await client.mutation(api.tourSteps.create, {
        tourId: untilDismissedTourId,
        type: "post",
        content: "Until dismissed step",
      });
      await client.mutation(api.testing.helpers.activateTestTour, { id: untilDismissedTourId });
    });

    it("should exclude first_time_only tours after any progress exists", async () => {
      // Start and complete the first_time_only tour
      await client.mutation(api.tourProgress.start, {
        workspaceId: testWorkspaceId,
        visitorId: displayModeVisitorId,
        tourId: firstTimeOnlyTourId,
      });
      await client.mutation(api.tourProgress.complete, {
        workspaceId: testWorkspaceId,
        visitorId: displayModeVisitorId,
        tourId: firstTimeOnlyTourId,
      });

      // Get available tours - first_time_only should be excluded
      const available = await client.query(api.tourProgress.getAvailableTours, {
        visitorId: displayModeVisitorId,
        workspaceId: testWorkspaceId,
      });

      const hasFirstTimeOnly = available.some(
        (t: { tour: { _id: Id<"tours"> } }) => t.tour._id === firstTimeOnlyTourId
      );
      expect(hasFirstTimeOnly).toBe(false);
    });

    it("should include until_dismissed tours after completion", async () => {
      // Start and complete the until_dismissed tour
      await client.mutation(api.tourProgress.start, {
        workspaceId: testWorkspaceId,
        visitorId: displayModeVisitorId,
        tourId: untilDismissedTourId,
      });
      await client.mutation(api.tourProgress.complete, {
        workspaceId: testWorkspaceId,
        visitorId: displayModeVisitorId,
        tourId: untilDismissedTourId,
      });

      // Get available tours - until_dismissed should still be available
      const available = await client.query(api.tourProgress.getAvailableTours, {
        visitorId: displayModeVisitorId,
        workspaceId: testWorkspaceId,
      });

      const hasUntilDismissed = available.some(
        (t: { tour: { _id: Id<"tours"> } }) => t.tour._id === untilDismissedTourId
      );
      expect(hasUntilDismissed).toBe(true);
    });

    it("should exclude until_dismissed tours after permanent dismissal", async () => {
      // Permanently dismiss the until_dismissed tour
      await client.mutation(api.tourProgress.dismissPermanently, {
        workspaceId: testWorkspaceId,
        visitorId: displayModeVisitorId,
        tourId: untilDismissedTourId,
      });

      // Get available tours - until_dismissed should now be excluded
      const available = await client.query(api.tourProgress.getAvailableTours, {
        visitorId: displayModeVisitorId,
        workspaceId: testWorkspaceId,
      });

      const hasUntilDismissed = available.some(
        (t: { tour: { _id: Id<"tours"> } }) => t.tour._id === untilDismissedTourId
      );
      expect(hasUntilDismissed).toBe(false);
    });

    it("should return tours sorted by priority", async () => {
      // Create a new visitor to test priority ordering
      const priorityVisitor = await client.mutation(api.testing.helpers.createTestVisitor, {
        workspaceId: testWorkspaceId,
        email: "priority-visitor@test.com",
        name: "Priority Test Visitor",
      });

      // Create tours with different priorities
      const lowPriorityTourId = await client.mutation(api.testing.helpers.createTestTour, {
        workspaceId: testWorkspaceId,
        name: "Low Priority Tour",
        priority: 10,
      });
      await client.mutation(api.tourSteps.create, {
        tourId: lowPriorityTourId,
        type: "post",
        content: "Low priority step",
      });
      await client.mutation(api.testing.helpers.activateTestTour, { id: lowPriorityTourId });

      const highPriorityTourId = await client.mutation(api.testing.helpers.createTestTour, {
        workspaceId: testWorkspaceId,
        name: "High Priority Tour",
        priority: 0,
      });
      await client.mutation(api.tourSteps.create, {
        tourId: highPriorityTourId,
        type: "post",
        content: "High priority step",
      });
      await client.mutation(api.testing.helpers.activateTestTour, { id: highPriorityTourId });

      // Get available tours
      const available = await client.query(api.tourProgress.getAvailableTours, {
        visitorId: priorityVisitor.visitorId,
        workspaceId: testWorkspaceId,
      });

      // Find indices of our test tours
      const highPriorityIndex = available.findIndex(
        (t: { tour: { _id: Id<"tours"> } }) => t.tour._id === highPriorityTourId
      );
      const lowPriorityIndex = available.findIndex(
        (t: { tour: { _id: Id<"tours"> } }) => t.tour._id === lowPriorityTourId
      );

      // High priority (lower number) should come first
      expect(highPriorityIndex).toBeLessThan(lowPriorityIndex);
    });
  });
});
