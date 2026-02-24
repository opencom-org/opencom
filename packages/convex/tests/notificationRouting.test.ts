import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");

describe("notification routing", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    vi.useFakeTimers();
    t = convexTest(schema, modules);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [{ status: "ok", id: "ticket-default" }],
        }),
      })) as unknown as typeof fetch
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("normalizes events, resolves recipients, and records suppression reasons", async () => {
    const seeded = await t.run(async (ctx) => {
      const now = Date.now();
      const workspaceId = await ctx.db.insert("workspaces", {
        name: "Routing Workspace",
        createdAt: now,
      });

      const activeUserId = await ctx.db.insert("users", {
        email: "active@opencom.dev",
        workspaceId,
        role: "agent",
        createdAt: now,
      });
      const mutedUserId = await ctx.db.insert("users", {
        email: "muted@opencom.dev",
        workspaceId,
        role: "agent",
        createdAt: now,
      });
      const noTokenUserId = await ctx.db.insert("users", {
        email: "notoken@opencom.dev",
        workspaceId,
        role: "agent",
        createdAt: now,
      });

      await ctx.db.insert("pushTokens", {
        userId: activeUserId,
        token: "ExponentPushToken[active-agent]",
        platform: "ios",
        notificationsEnabled: true,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("pushTokens", {
        userId: mutedUserId,
        token: "ExponentPushToken[muted-agent]",
        platform: "ios",
        notificationsEnabled: true,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("notificationPreferences", {
        userId: mutedUserId,
        workspaceId,
        muted: false,
        events: {
          newVisitorMessage: {
            push: false,
          },
        },
        createdAt: now,
        updatedAt: now,
      });

      const visitorId = await ctx.db.insert("visitors", {
        workspaceId,
        sessionId: "visitor-session",
        createdAt: now,
      });
      const conversationId = await ctx.db.insert("conversations", {
        workspaceId,
        visitorId,
        status: "open",
        createdAt: now,
        updatedAt: now,
      });

      return {
        workspaceId,
        activeUserId,
        mutedUserId,
        noTokenUserId,
        visitorId,
        conversationId,
      };
    });

    const routed = await t.mutation(internal.notifications.routeEvent, {
      eventType: "chat_message",
      domain: "chat",
      audience: "agent",
      workspaceId: seeded.workspaceId,
      actorType: "visitor",
      actorVisitorId: seeded.visitorId,
      conversationId: seeded.conversationId,
      title: "New message from visitor",
      body: "Hello from a visitor",
      eventKey: "chat_message:test-routing",
      recipientUserIds: [seeded.activeUserId, seeded.mutedUserId, seeded.noTokenUserId],
    });

    expect(routed.scheduled).toBe(1);
    expect(routed.suppressed).toBe(2);
    await t.finishAllScheduledFunctions(() => {
      vi.runAllTimers();
    });

    await t.run(async (ctx) => {
      const events = await ctx.db
        .query("notificationEvents")
        .withIndex("by_event_key", (q) => q.eq("eventKey", "chat_message:test-routing"))
        .collect();
      expect(events).toHaveLength(1);

      const dedupeRows = await ctx.db
        .query("notificationDedupeKeys")
        .withIndex("by_event", (q) => q.eq("eventId", events[0]._id))
        .collect();
      expect(dedupeRows).toHaveLength(1);
      expect(dedupeRows[0].userId).toBe(seeded.activeUserId);

      const deliveries = await ctx.db
        .query("notificationDeliveries")
        .withIndex("by_event", (q) => q.eq("eventId", events[0]._id))
        .collect();
      const suppressionReasons = new Set(
        deliveries
          .filter((delivery) => delivery.status === "suppressed")
          .map((delivery) => delivery.reason)
      );

      expect(suppressionReasons.has("preference_muted")).toBe(true);
      expect(suppressionReasons.has("missing_push_token")).toBe(true);
    });
  });

  it("suppresses duplicate sends for the same event-recipient-channel key", async () => {
    const seeded = await t.run(async (ctx) => {
      const now = Date.now();
      const workspaceId = await ctx.db.insert("workspaces", {
        name: "Dedupe Workspace",
        createdAt: now,
      });
      const userId = await ctx.db.insert("users", {
        email: "dedupe@opencom.dev",
        workspaceId,
        role: "agent",
        createdAt: now,
      });
      await ctx.db.insert("pushTokens", {
        userId,
        token: "ExponentPushToken[dedupe-agent]",
        platform: "ios",
        notificationsEnabled: true,
        createdAt: now,
        updatedAt: now,
      });

      return { workspaceId, userId };
    });

    const first = await t.mutation(internal.notifications.routeEvent, {
      eventType: "assignment",
      domain: "chat",
      audience: "agent",
      workspaceId: seeded.workspaceId,
      actorType: "system",
      title: "Assigned",
      body: "You have a new assignment",
      eventKey: "assignment:dedupe",
      recipientUserIds: [seeded.userId],
    });
    expect(first.scheduled).toBe(1);
    expect(first.suppressed).toBe(0);

    const second = await t.mutation(internal.notifications.routeEvent, {
      eventType: "assignment",
      domain: "chat",
      audience: "agent",
      workspaceId: seeded.workspaceId,
      actorType: "system",
      title: "Assigned",
      body: "You have a new assignment",
      eventKey: "assignment:dedupe",
      recipientUserIds: [seeded.userId],
    });
    expect(second.scheduled).toBe(0);
    expect(second.suppressed).toBe(1);
    await t.finishAllScheduledFunctions(() => {
      vi.runAllTimers();
    });

    await t.run(async (ctx) => {
      const duplicateSuppression = await ctx.db
        .query("notificationDeliveries")
        .withIndex("by_dedupe_key", (q) =>
          q.eq("dedupeKey", `assignment:dedupe:agent:${seeded.userId}:push`)
        )
        .collect();

      expect(
        duplicateSuppression.some(
          (delivery) =>
            delivery.status === "suppressed" &&
            delivery.reason === "duplicate_event_recipient_channel"
        )
      ).toBe(true);
    });
  });

  it("removes invalid agent and visitor tokens after transport errors", async () => {
    const seeded = await t.run(async (ctx) => {
      const now = Date.now();
      const workspaceId = await ctx.db.insert("workspaces", {
        name: "Token Hygiene Workspace",
        createdAt: now,
      });
      const userId = await ctx.db.insert("users", {
        email: "token-owner@opencom.dev",
        workspaceId,
        role: "agent",
        createdAt: now,
      });
      const visitorId = await ctx.db.insert("visitors", {
        workspaceId,
        sessionId: "token-hygiene-session",
        createdAt: now,
      });

      await ctx.db.insert("pushTokens", {
        userId,
        token: "ExponentPushToken[agent-invalid]",
        platform: "ios",
        notificationsEnabled: true,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("visitorPushTokens", {
        visitorId,
        workspaceId,
        token: "ExponentPushToken[visitor-invalid]",
        platform: "ios",
        notificationsEnabled: true,
        createdAt: now,
        updatedAt: now,
      });

      return { workspaceId };
    });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          {
            status: "error",
            message: "The device is not registered",
            details: { error: "DeviceNotRegistered" },
          },
          {
            status: "error",
            message: "The device is not registered",
            details: { error: "DeviceNotRegistered" },
          },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await t.action(internal.push.sendPush, {
      tokens: ["ExponentPushToken[agent-invalid]", "ExponentPushToken[visitor-invalid]"],
      title: "Test",
      body: "Body",
    });

    expect(result.success).toBe(true);
    expect(result.failed).toBe(2);

    await t.run(async (ctx) => {
      const agentToken = await ctx.db
        .query("pushTokens")
        .withIndex("by_token", (q) => q.eq("token", "ExponentPushToken[agent-invalid]"))
        .first();
      const visitorToken = await ctx.db
        .query("visitorPushTokens")
        .withIndex("by_token", (q) => q.eq("token", "ExponentPushToken[visitor-invalid]"))
        .first();

      expect(agentToken).toBeNull();
      expect(visitorToken).toBeNull();
    });

    // Ensure fixture workspace remains referenced so setup is not optimized away in TS.
    expect(seeded.workspaceId).toBeTruthy();
  });
});
