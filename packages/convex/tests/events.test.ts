import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("events", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testVisitorId: Id<"visitors">;
  let testSessionToken: string;

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

  describe("track", () => {
    it("should track an event", async () => {
      const eventId = await client.mutation(api.events.track, {
        workspaceId: testWorkspaceId,
        visitorId: testVisitorId,
        name: "button_clicked",
        properties: { buttonId: "signup" },
        url: "https://example.com/signup",
      });

      expect(eventId).toBeDefined();
    });

    it("should track multiple events", async () => {
      await client.mutation(api.events.track, {
        workspaceId: testWorkspaceId,
        visitorId: testVisitorId,
        name: "page_viewed",
        url: "https://example.com/dashboard",
      });

      await client.mutation(api.events.track, {
        workspaceId: testWorkspaceId,
        visitorId: testVisitorId,
        name: "page_viewed",
        url: "https://example.com/settings",
      });

      const events = await client.query(api.events.list, {
        visitorId: testVisitorId,
        sessionToken: testSessionToken,
        workspaceId: testWorkspaceId,
      });

      expect(events.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("list", () => {
    it("should list events for a visitor", async () => {
      const events = await client.query(api.events.list, {
        visitorId: testVisitorId,
        sessionToken: testSessionToken,
        workspaceId: testWorkspaceId,
      });

      expect(events).toBeDefined();
      expect(Array.isArray(events)).toBe(true);
    });

    it("should respect limit parameter", async () => {
      const events = await client.query(api.events.list, {
        visitorId: testVisitorId,
        limit: 1,
        sessionToken: testSessionToken,
        workspaceId: testWorkspaceId,
      });

      expect(events.length).toBeLessThanOrEqual(1);
    });
  });

  describe("count", () => {
    it("should count events by name", async () => {
      const count = await client.query(api.events.count, {
        visitorId: testVisitorId,
        name: "page_viewed",
        sessionToken: testSessionToken,
        workspaceId: testWorkspaceId,
      });

      expect(count).toBeGreaterThanOrEqual(2);
    });

    it("should return 0 for non-existent event", async () => {
      const count = await client.query(api.events.count, {
        visitorId: testVisitorId,
        name: "nonexistent_event",
        sessionToken: testSessionToken,
        workspaceId: testWorkspaceId,
      });

      expect(count).toBe(0);
    });
  });

  describe("getDistinctNames", () => {
    it("should return empty names for unauthenticated callers", async () => {
      const names = await client.query(api.events.getDistinctNames, {
        workspaceId: testWorkspaceId,
      });

      expect(names).toEqual([]);
    });
  });

  describe("event-based tour targeting", () => {
    it("should match tour when event count meets criteria", async () => {
      const tourId = await client.mutation(api.testing.helpers.createTestTour, {
        workspaceId: testWorkspaceId,
        name: "Engaged User Tour",
        audienceRules: {
          type: "group",
          operator: "and",
          conditions: [
            {
              type: "condition",
              property: {
                source: "event",
                key: "event",
                eventFilter: {
                  name: "page_viewed",
                  countOperator: "at_least",
                  count: 2,
                },
              },
              operator: "is_set",
            },
          ],
        },
      });

      await client.mutation(api.testing.helpers.activateTestTour, { id: tourId });

      const availableTours = await client.query(api.tourProgress.getAvailableTours, {
        visitorId: testVisitorId,
        workspaceId: testWorkspaceId,
        sessionToken: testSessionToken,
      });

      expect(availableTours.some((t) => t.tour._id === tourId)).toBe(true);

      await client.mutation(api.testing.helpers.removeTestTour, { id: tourId });
    });

    it("should not match tour when event count does not meet criteria", async () => {
      const tourId = await client.mutation(api.testing.helpers.createTestTour, {
        workspaceId: testWorkspaceId,
        name: "Power User Tour",
        audienceRules: {
          type: "group",
          operator: "and",
          conditions: [
            {
              type: "condition",
              property: {
                source: "event",
                key: "event",
                eventFilter: {
                  name: "page_viewed",
                  countOperator: "at_least",
                  count: 100,
                },
              },
              operator: "is_set",
            },
          ],
        },
      });

      await client.mutation(api.testing.helpers.activateTestTour, { id: tourId });

      const availableTours = await client.query(api.tourProgress.getAvailableTours, {
        visitorId: testVisitorId,
        workspaceId: testWorkspaceId,
        sessionToken: testSessionToken,
      });

      expect(availableTours.some((t) => t.tour._id === tourId)).toBe(false);

      await client.mutation(api.testing.helpers.removeTestTour, { id: tourId });
    });
  });

  describe("trackAutoEvent", () => {
    it("should track page_view auto event", async () => {
      const eventId = await client.mutation(api.events.trackAutoEvent, {
        workspaceId: testWorkspaceId,
        visitorId: testVisitorId,
        eventType: "page_view",
        url: "https://example.com/home",
        sessionId: "session-123",
        properties: { referrer: "https://google.com" },
      });

      expect(eventId).toBeDefined();

      const events = await client.query(api.events.list, {
        visitorId: testVisitorId,
        sessionToken: testSessionToken,
        workspaceId: testWorkspaceId,
      });

      const pageViewEvent = events.find((e) => e._id === eventId);
      expect(pageViewEvent).toBeDefined();
      expect(pageViewEvent?.name).toBe("page_view");
      expect(pageViewEvent?.eventType).toBe("page_view");
      expect(pageViewEvent?.url).toBe("https://example.com/home");
    });

    it("should track screen_view auto event", async () => {
      const eventId = await client.mutation(api.events.trackAutoEvent, {
        workspaceId: testWorkspaceId,
        visitorId: testVisitorId,
        eventType: "screen_view",
        properties: { screenName: "Dashboard" },
      });

      expect(eventId).toBeDefined();

      const events = await client.query(api.events.list, {
        visitorId: testVisitorId,
        sessionToken: testSessionToken,
        workspaceId: testWorkspaceId,
      });

      const screenViewEvent = events.find((e) => e._id === eventId);
      expect(screenViewEvent).toBeDefined();
      expect(screenViewEvent?.name).toBe("screen_view");
      expect(screenViewEvent?.eventType).toBe("screen_view");
    });

    it("should track session_start auto event", async () => {
      const eventId = await client.mutation(api.events.trackAutoEvent, {
        workspaceId: testWorkspaceId,
        visitorId: testVisitorId,
        eventType: "session_start",
        sessionId: "new-session-456",
      });

      expect(eventId).toBeDefined();

      const events = await client.query(api.events.list, {
        visitorId: testVisitorId,
        sessionToken: testSessionToken,
        workspaceId: testWorkspaceId,
      });

      const sessionStartEvent = events.find((e) => e._id === eventId);
      expect(sessionStartEvent).toBeDefined();
      expect(sessionStartEvent?.name).toBe("session_start");
      expect(sessionStartEvent?.eventType).toBe("session_start");
    });

    it("should track session_end auto event", async () => {
      const eventId = await client.mutation(api.events.trackAutoEvent, {
        workspaceId: testWorkspaceId,
        visitorId: testVisitorId,
        eventType: "session_end",
        sessionId: "ending-session-789",
      });

      expect(eventId).toBeDefined();

      const events = await client.query(api.events.list, {
        visitorId: testVisitorId,
        sessionToken: testSessionToken,
        workspaceId: testWorkspaceId,
      });

      const sessionEndEvent = events.find((e) => e._id === eventId);
      expect(sessionEndEvent).toBeDefined();
      expect(sessionEndEvent?.name).toBe("session_end");
      expect(sessionEndEvent?.eventType).toBe("session_end");
    });

    it("should keep getDistinctNames protected for unauthenticated callers", async () => {
      const names = await client.query(api.events.getDistinctNames, {
        workspaceId: testWorkspaceId,
      });

      expect(names).toEqual([]);
    });
  });

  describe("trackAutoEvent rate limiting", () => {
    let rateLimitVisitorId: Id<"visitors">;

    beforeAll(async () => {
      const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
        workspaceId: testWorkspaceId,
        email: "ratelimit@example.com",
      });
      rateLimitVisitorId = visitor.visitorId;
    });

    it("should allow events under rate limit", async () => {
      const eventId = await client.mutation(api.events.trackAutoEvent, {
        workspaceId: testWorkspaceId,
        visitorId: rateLimitVisitorId,
        eventType: "page_view",
        url: "https://example.com/page1",
      });

      expect(eventId).toBeDefined();
    });

    it("should return null when rate limit exceeded", async () => {
      // Track 100 events to hit the rate limit
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          client.mutation(api.events.trackAutoEvent, {
            workspaceId: testWorkspaceId,
            visitorId: rateLimitVisitorId,
            eventType: "page_view",
            url: `https://example.com/page${i}`,
          })
        );
      }
      await Promise.all(promises);

      // The 101st event should be rate limited
      const rateLimitedEventId = await client.mutation(api.events.trackAutoEvent, {
        workspaceId: testWorkspaceId,
        visitorId: rateLimitVisitorId,
        eventType: "page_view",
        url: "https://example.com/rate-limited",
      });

      expect(rateLimitedEventId).toBeNull();
    });
  });

  describe("cleanupOldAutoEvents", () => {
    it("should reject cleanup for unauthenticated callers", async () => {
      await expect(
        client.mutation(api.events.cleanupOldAutoEvents, {
          workspaceId: testWorkspaceId,
          ttlDays: 30,
        })
      ).rejects.toThrow(/Not authenticated/);
    });
  });
});
