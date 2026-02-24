import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("audienceRules", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testVisitorId: Id<"visitors">;
  let testSessionToken: string;
  let testTourId: Id<"tours">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    const workspace = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    testWorkspaceId = workspace.workspaceId;

    const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
      email: "test@example.com",
      name: "Test User",
      customAttributes: {
        plan: "pro",
        tier: "premium",
      },
    });
    testVisitorId = visitor.visitorId;

    const session = await client.mutation(api.testing.helpers.createTestSessionToken, {
      visitorId: testVisitorId,
      workspaceId: testWorkspaceId,
    });
    testSessionToken = session.sessionToken;
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

  describe("tour with system property rules", () => {
    it("should match tour when email is set", async () => {
      testTourId = await client.mutation(api.testing.helpers.createTestTour, {
        workspaceId: testWorkspaceId,
        name: "Email Required Tour",
        audienceRules: {
          type: "group",
          operator: "and",
          conditions: [
            {
              type: "condition",
              property: { source: "system", key: "email" },
              operator: "is_set",
            },
          ],
        },
      });

      await client.mutation(api.testing.helpers.activateTestTour, { id: testTourId });

      const availableTours = await client.query(api.tourProgress.getAvailableTours, {
        visitorId: testVisitorId,
        workspaceId: testWorkspaceId,
        sessionToken: testSessionToken,
      });

      expect(availableTours.some((t) => t.tour._id === testTourId)).toBe(true);

      await client.mutation(api.testing.helpers.removeTestTour, { id: testTourId });
    });

    it("should not match tour when email equals different value", async () => {
      testTourId = await client.mutation(api.testing.helpers.createTestTour, {
        workspaceId: testWorkspaceId,
        name: "Specific Email Tour",
        audienceRules: {
          type: "group",
          operator: "and",
          conditions: [
            {
              type: "condition",
              property: { source: "system", key: "email" },
              operator: "equals",
              value: "other@example.com",
            },
          ],
        },
      });

      await client.mutation(api.testing.helpers.activateTestTour, { id: testTourId });

      const availableTours = await client.query(api.tourProgress.getAvailableTours, {
        visitorId: testVisitorId,
        workspaceId: testWorkspaceId,
        sessionToken: testSessionToken,
      });

      expect(availableTours.some((t) => t.tour._id === testTourId)).toBe(false);

      await client.mutation(api.testing.helpers.removeTestTour, { id: testTourId });
    });

    it("should match tour when email contains domain", async () => {
      testTourId = await client.mutation(api.testing.helpers.createTestTour, {
        workspaceId: testWorkspaceId,
        name: "Domain Match Tour",
        audienceRules: {
          type: "group",
          operator: "and",
          conditions: [
            {
              type: "condition",
              property: { source: "system", key: "email" },
              operator: "contains",
              value: "example.com",
            },
          ],
        },
      });

      await client.mutation(api.testing.helpers.activateTestTour, { id: testTourId });

      const availableTours = await client.query(api.tourProgress.getAvailableTours, {
        visitorId: testVisitorId,
        workspaceId: testWorkspaceId,
        sessionToken: testSessionToken,
      });

      expect(availableTours.some((t) => t.tour._id === testTourId)).toBe(true);

      await client.mutation(api.testing.helpers.removeTestTour, { id: testTourId });
    });
  });

  describe("tour with custom attribute rules", () => {
    it("should match tour when custom attribute equals value", async () => {
      testTourId = await client.mutation(api.testing.helpers.createTestTour, {
        workspaceId: testWorkspaceId,
        name: "Pro Plan Tour",
        audienceRules: {
          type: "group",
          operator: "and",
          conditions: [
            {
              type: "condition",
              property: { source: "custom", key: "plan" },
              operator: "equals",
              value: "pro",
            },
          ],
        },
      });

      await client.mutation(api.testing.helpers.activateTestTour, { id: testTourId });

      const availableTours = await client.query(api.tourProgress.getAvailableTours, {
        visitorId: testVisitorId,
        workspaceId: testWorkspaceId,
        sessionToken: testSessionToken,
      });

      expect(availableTours.some((t) => t.tour._id === testTourId)).toBe(true);

      await client.mutation(api.testing.helpers.removeTestTour, { id: testTourId });
    });

    it("should not match tour when custom attribute not set", async () => {
      testTourId = await client.mutation(api.testing.helpers.createTestTour, {
        workspaceId: testWorkspaceId,
        name: "Enterprise Tour",
        audienceRules: {
          type: "group",
          operator: "and",
          conditions: [
            {
              type: "condition",
              property: { source: "custom", key: "enterprise" },
              operator: "is_set",
            },
          ],
        },
      });

      await client.mutation(api.testing.helpers.activateTestTour, { id: testTourId });

      const availableTours = await client.query(api.tourProgress.getAvailableTours, {
        visitorId: testVisitorId,
        workspaceId: testWorkspaceId,
        sessionToken: testSessionToken,
      });

      expect(availableTours.some((t) => t.tour._id === testTourId)).toBe(false);

      await client.mutation(api.testing.helpers.removeTestTour, { id: testTourId });
    });
  });

  describe("tour with OR conditions", () => {
    it("should match tour when any condition is true", async () => {
      testTourId = await client.mutation(api.testing.helpers.createTestTour, {
        workspaceId: testWorkspaceId,
        name: "OR Conditions Tour",
        audienceRules: {
          type: "group",
          operator: "or",
          conditions: [
            {
              type: "condition",
              property: { source: "custom", key: "nonexistent" },
              operator: "is_set",
            },
            {
              type: "condition",
              property: { source: "system", key: "email" },
              operator: "is_set",
            },
          ],
        },
      });

      await client.mutation(api.testing.helpers.activateTestTour, { id: testTourId });

      const availableTours = await client.query(api.tourProgress.getAvailableTours, {
        visitorId: testVisitorId,
        workspaceId: testWorkspaceId,
        sessionToken: testSessionToken,
      });

      expect(availableTours.some((t) => t.tour._id === testTourId)).toBe(true);

      await client.mutation(api.testing.helpers.removeTestTour, { id: testTourId });
    });
  });

  describe("tour with nested groups", () => {
    it("should match tour with nested AND/OR groups", async () => {
      testTourId = await client.mutation(api.testing.helpers.createTestTour, {
        workspaceId: testWorkspaceId,
        name: "Nested Groups Tour",
        audienceRules: {
          type: "group",
          operator: "and",
          conditions: [
            {
              type: "condition",
              property: { source: "system", key: "email" },
              operator: "is_set",
            },
            {
              type: "group",
              operator: "or",
              conditions: [
                {
                  type: "condition",
                  property: { source: "custom", key: "plan" },
                  operator: "equals",
                  value: "pro",
                },
                {
                  type: "condition",
                  property: { source: "custom", key: "plan" },
                  operator: "equals",
                  value: "enterprise",
                },
              ],
            },
          ],
        },
      });

      await client.mutation(api.testing.helpers.activateTestTour, { id: testTourId });

      const availableTours = await client.query(api.tourProgress.getAvailableTours, {
        visitorId: testVisitorId,
        workspaceId: testWorkspaceId,
        sessionToken: testSessionToken,
      });

      expect(availableTours.some((t) => t.tour._id === testTourId)).toBe(true);

      await client.mutation(api.testing.helpers.removeTestTour, { id: testTourId });
    });
  });

  describe("tour with no audience rules", () => {
    it("should match tour when no audienceRules defined", async () => {
      testTourId = await client.mutation(api.testing.helpers.createTestTour, {
        workspaceId: testWorkspaceId,
        name: "No Rules Tour",
      });

      await client.mutation(api.testing.helpers.activateTestTour, { id: testTourId });

      const availableTours = await client.query(api.tourProgress.getAvailableTours, {
        visitorId: testVisitorId,
        workspaceId: testWorkspaceId,
        sessionToken: testSessionToken,
      });

      expect(availableTours.some((t) => t.tour._id === testTourId)).toBe(true);

      await client.mutation(api.testing.helpers.removeTestTour, { id: testTourId });
    });
  });
});
