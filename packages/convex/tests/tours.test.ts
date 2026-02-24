import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("tours", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testTourId: Id<"tours">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    const workspace = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    testWorkspaceId = workspace.workspaceId;
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

  it("should create a tour", async () => {
    testTourId = await client.mutation(api.testing.helpers.createTestTour, {
      workspaceId: testWorkspaceId,
      name: "Welcome Tour",
      description: "A tour to welcome new users",
    });

    expect(testTourId).toBeDefined();
  });

  it("should get a tour by id", async () => {
    const tour = await client.mutation(api.testing.helpers.getTestTour, { id: testTourId });

    expect(tour).toBeDefined();
    expect(tour?.name).toBe("Welcome Tour");
    expect(tour?.status).toBe("draft");
  });

  it("should list tours for workspace", async () => {
    const tours = await client.mutation(api.testing.helpers.listTestTours, {
      workspaceId: testWorkspaceId,
    });

    expect(tours).toBeDefined();
    expect(tours.length).toBeGreaterThan(0);
    expect(tours.some((t: { _id: Id<"tours"> }) => t._id === testTourId)).toBe(true);
  });

  it("should update a tour", async () => {
    await client.mutation(api.testing.helpers.updateTestTour, {
      id: testTourId,
      name: "Updated Welcome Tour",
      showConfetti: true,
      allowSnooze: false,
    });

    const tour = await client.mutation(api.testing.helpers.getTestTour, { id: testTourId });

    expect(tour?.name).toBe("Updated Welcome Tour");
    expect(tour?.showConfetti).toBe(true);
    expect(tour?.allowSnooze).toBe(false);
  });

  it("should activate a tour", async () => {
    await client.mutation(api.testing.helpers.activateTestTour, { id: testTourId });

    const tour = await client.mutation(api.testing.helpers.getTestTour, { id: testTourId });

    expect(tour?.status).toBe("active");
  });

  it("should deactivate a tour", async () => {
    await client.mutation(api.testing.helpers.deactivateTestTour, { id: testTourId });

    const tour = await client.mutation(api.testing.helpers.getTestTour, { id: testTourId });

    expect(tour?.status).toBe("draft");
  });

  it("should duplicate a tour", async () => {
    const duplicatedId = await client.mutation(api.testing.helpers.duplicateTestTour, {
      id: testTourId,
    });

    expect(duplicatedId).toBeDefined();
    expect(duplicatedId).not.toBe(testTourId);

    const duplicated = await client.mutation(api.testing.helpers.getTestTour, { id: duplicatedId });

    expect(duplicated?.name).toBe("Updated Welcome Tour (Copy)");
    expect(duplicated?.status).toBe("draft");
  });

  it("should filter tours by status", async () => {
    await client.mutation(api.testing.helpers.activateTestTour, { id: testTourId });

    const allTours = await client.mutation(api.testing.helpers.listTestTours, {
      workspaceId: testWorkspaceId,
    });

    const activeTours = allTours.filter((t: { status: string }) => t.status === "active");
    expect(activeTours.some((t: { _id: Id<"tours"> }) => t._id === testTourId)).toBe(true);

    const draftTours = allTours.filter((t: { status: string }) => t.status === "draft");
    expect(draftTours.some((t: { _id: Id<"tours"> }) => t._id === testTourId)).toBe(false);
  });

  it("should delete a tour", async () => {
    const result = await client.mutation(api.testing.helpers.removeTestTour, { id: testTourId });

    expect(result.success).toBe(true);

    const tour = await client.mutation(api.testing.helpers.getTestTour, { id: testTourId });

    expect(tour).toBeNull();
  });
});
