import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";

function buildValidScreens() {
  return [
    {
      id: "screen-1",
      title: "Welcome",
      body: "Let us get started",
      buttons: [{ text: "Next", action: "next" as const }],
    },
    {
      id: "screen-2",
      title: "Finish",
      body: "You're ready",
      buttons: [{ text: "Done", action: "dismiss" as const }],
    },
  ];
}

describe("carousels", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testVisitorId: Id<"visitors">;
  let testCarouselId: Id<"carousels">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);
    testWorkspaceId = (await authenticateClientForWorkspace(client)).workspaceId;

    const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
      workspaceId: testWorkspaceId,
    });
    testVisitorId = visitor.visitorId;
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

  describe("validation contracts", () => {
    it("rejects malformed CTA URL payloads", async () => {
      await expect(
        client.mutation(api.carousels.create, {
          workspaceId: testWorkspaceId,
          name: "Invalid CTA Carousel",
          screens: [
            {
              id: "screen-invalid-1",
              title: "Invalid",
              body: "Bad button",
              buttons: [{ text: "Visit", action: "url", url: "not-a-url" }],
            },
          ],
        })
      ).rejects.toThrow(/valid http\(s\) URL/i);
    });

    it("rejects screens without title/body", async () => {
      await expect(
        client.mutation(api.carousels.create, {
          workspaceId: testWorkspaceId,
          name: "Missing Content Carousel",
          screens: [
            {
              id: "screen-invalid-2",
              title: "",
              body: "",
            },
          ],
        })
      ).rejects.toThrow(/must include a title or body/i);
    });
  });

  describe("CRUD operations", () => {
    it("should create a carousel", async () => {
      testCarouselId = await client.mutation(api.carousels.create, {
        workspaceId: testWorkspaceId,
        name: "Onboarding Carousel",
        screens: buildValidScreens(),
        priority: 10,
      });

      expect(testCarouselId).toBeDefined();
    });

    it("should get a carousel by id", async () => {
      const carousel = await client.query(api.carousels.get, { id: testCarouselId });

      expect(carousel).toBeDefined();
      expect(carousel?.name).toBe("Onboarding Carousel");
      expect(carousel?.screens.length).toBe(2);
      expect(carousel?.status).toBe("draft");
    });

    it("should list carousels for workspace", async () => {
      const carousels = await client.query(api.carousels.list, {
        workspaceId: testWorkspaceId,
      });

      expect(carousels).toBeDefined();
      expect(carousels.length).toBeGreaterThan(0);
    });

    it("should update a carousel", async () => {
      await client.mutation(api.carousels.update, {
        id: testCarouselId,
        name: "Updated Onboarding",
        screens: [
          {
            id: "screen-1",
            title: "Hello!",
            body: "Welcome to our app.",
          },
        ],
      });

      const carousel = await client.query(api.carousels.get, { id: testCarouselId });

      expect(carousel?.name).toBe("Updated Onboarding");
      expect(carousel?.screens.length).toBe(1);
    });

    it("should activate a carousel", async () => {
      await client.mutation(api.carousels.activate, { id: testCarouselId });

      const carousel = await client.query(api.carousels.get, { id: testCarouselId });

      expect(carousel?.status).toBe("active");
    });

    it("should pause a carousel", async () => {
      await client.mutation(api.carousels.pause, { id: testCarouselId });

      const carousel = await client.query(api.carousels.get, { id: testCarouselId });

      expect(carousel?.status).toBe("paused");
    });
  });

  describe("lifecycle operations", () => {
    it("enforces explicit status transition rules", async () => {
      const lifecycleId = await client.mutation(api.carousels.create, {
        workspaceId: testWorkspaceId,
        name: "Lifecycle Guard Carousel",
        screens: buildValidScreens(),
      });

      await expect(client.mutation(api.carousels.pause, { id: lifecycleId })).rejects.toThrow(
        /cannot transition carousel from draft to paused/i
      );

      await client.mutation(api.carousels.activate, { id: lifecycleId });
      await expect(client.mutation(api.carousels.activate, { id: lifecycleId })).rejects.toThrow(
        /already active/i
      );

      await client.mutation(api.carousels.pause, { id: lifecycleId });
      const pausedCarousel = await client.query(api.carousels.get, { id: lifecycleId });
      expect(pausedCarousel?.status).toBe("paused");
    });
  });

  describe("eligibility", () => {
    it("should return eligible carousels for visitor", async () => {
      // Activate the carousel first
      await client.mutation(api.carousels.activate, { id: testCarouselId });

      const eligible = await client.query(api.carousels.getEligible, {
        workspaceId: testWorkspaceId,
        visitorId: testVisitorId,
      });

      expect(eligible).toBeDefined();
      expect(Array.isArray(eligible)).toBe(true);
      expect(eligible.some((c: { _id: Id<"carousels"> }) => c._id === testCarouselId)).toBe(true);
    });

    it("should filter by status", async () => {
      const activeCarousels = await client.query(api.carousels.list, {
        workspaceId: testWorkspaceId,
        status: "active",
      });

      expect(activeCarousels.every((c: { status: string }) => c.status === "active")).toBe(true);
    });

    it("rejects impression tracking for paused carousels", async () => {
      const pausedId = await client.mutation(api.carousels.create, {
        workspaceId: testWorkspaceId,
        name: "Paused Eligibility Carousel",
        screens: buildValidScreens(),
      });

      await client.mutation(api.carousels.activate, { id: pausedId });
      await client.mutation(api.carousels.pause, { id: pausedId });

      await expect(
        client.mutation(api.carousels.trackImpression, {
          carouselId: pausedId,
          visitorId: testVisitorId,
          action: "shown",
          screenIndex: 0,
        })
      ).rejects.toThrow(/not active/i);
    });
  });

  describe("impression tracking", () => {
    it("should track carousel shown", async () => {
      const impressionId = await client.mutation(api.carousels.trackImpression, {
        carouselId: testCarouselId,
        visitorId: testVisitorId,
        action: "shown",
        screenIndex: 0,
      });

      expect(impressionId).toBeDefined();
    });

    it("deduplicates terminal completion events for idempotency", async () => {
      const impressionId = await client.mutation(api.carousels.trackImpression, {
        carouselId: testCarouselId,
        visitorId: testVisitorId,
        action: "completed",
        screenIndex: 1,
      });

      const retryId = await client.mutation(api.carousels.trackImpression, {
        carouselId: testCarouselId,
        visitorId: testVisitorId,
        action: "completed",
        screenIndex: 1,
      });

      expect(retryId).toBe(impressionId);
      expect(impressionId).toBeDefined();
    });

    it("does not double-count terminal events when dismiss is retried after completion", async () => {
      const terminalId = await client.mutation(api.carousels.trackImpression, {
        carouselId: testCarouselId,
        visitorId: testVisitorId,
        action: "dismissed",
        screenIndex: 1,
      });

      const stats = await client.query(api.carousels.getStats, {
        id: testCarouselId,
      });

      expect(terminalId).toBeDefined();
      expect(stats.completed).toBe(1);
      expect(stats.dismissed).toBe(0);
    });

    it("should get carousel stats", async () => {
      const stats = await client.query(api.carousels.getStats, {
        id: testCarouselId,
      });

      expect(stats).toBeDefined();
      expect(stats.shown).toBeGreaterThanOrEqual(1);
      expect(stats.completed).toBeGreaterThanOrEqual(1);
      expect(typeof stats.completionRate).toBe("number");
    });

    it("keeps analytics stable across shown retries and completion replay", async () => {
      const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
        workspaceId: testWorkspaceId,
        email: "carousel-retry-visitor@test.com",
        name: "Carousel Retry Visitor",
      });

      await client.mutation(api.carousels.trackImpression, {
        carouselId: testCarouselId,
        visitorId: visitor.visitorId,
        action: "shown",
        screenIndex: 0,
      });
      await client.mutation(api.carousels.trackImpression, {
        carouselId: testCarouselId,
        visitorId: visitor.visitorId,
        action: "shown",
        screenIndex: 0,
      });

      const completedFirst = await client.mutation(api.carousels.trackImpression, {
        carouselId: testCarouselId,
        visitorId: visitor.visitorId,
        action: "completed",
        screenIndex: 1,
      });
      const completedRetry = await client.mutation(api.carousels.trackImpression, {
        carouselId: testCarouselId,
        visitorId: visitor.visitorId,
        action: "completed",
        screenIndex: 1,
      });

      expect(completedRetry).toBe(completedFirst);

      const stats = await client.query(api.carousels.getStats, {
        id: testCarouselId,
      });

      expect(stats.shown).toBeGreaterThanOrEqual(2);
      expect(stats.completed).toBeGreaterThanOrEqual(2);
      expect(stats.dismissed).toBe(0);
    });

    it("should not show completed carousel as eligible", async () => {
      const eligible = await client.query(api.carousels.getEligible, {
        workspaceId: testWorkspaceId,
        visitorId: testVisitorId,
      });

      // After completion, carousel should not be eligible
      expect(eligible.some((c: { _id: Id<"carousels"> }) => c._id === testCarouselId)).toBe(false);
    });
  });

  describe("duplication", () => {
    it("should duplicate a carousel", async () => {
      const duplicateId = await client.mutation(api.carousels.duplicate, {
        id: testCarouselId,
      });

      const duplicate = await client.query(api.carousels.get, { id: duplicateId });

      expect(duplicate?.name).toContain("(Copy)");
      expect(duplicate?.status).toBe("draft");
    });
  });

  describe("cleanup", () => {
    it("should delete a carousel", async () => {
      await client.mutation(api.carousels.remove, { id: testCarouselId });

      const carousel = await client.query(api.carousels.get, { id: testCarouselId });

      expect(carousel).toBeNull();
    });
  });
});
