import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");

describe("automation fixes", () => {
  let t: ReturnType<typeof convexTest>;

  beforeEach(() => {
    vi.useFakeTimers();
    t = convexTest(schema, modules);
    // Stub fetch for webhook delivery actions
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => "",
      })) as unknown as typeof fetch
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  // Helper to seed a workspace with automation enabled
  async function seedWorkspace() {
    return t.run(async (ctx) => {
      const now = Date.now();
      const workspaceId = await ctx.db.insert("workspaces", {
        name: "Test Workspace",
        automationApiEnabled: true,
        createdAt: now,
      });
      const userId = await ctx.db.insert("users", {
        email: "admin@test.com",
        workspaceId,
        role: "admin",
        createdAt: now,
      });
      const credentialId = await ctx.db.insert("automationCredentials", {
        workspaceId,
        name: "Test Key",
        secretHash: "testhash123",
        secretPrefix: "osk_test",
        scopes: [
          "conversations.read",
          "conversations.write",
          "messages.read",
          "messages.write",
          "webhooks.manage",
          "claims.manage",
          "events.read",
        ],
        status: "active",
        actorName: "test-bot",
        createdBy: userId,
        createdAt: now,
      });
      return { workspaceId, userId, credentialId };
    });
  }

  // ── R1: Cross-workspace replay rejection ────────────────────────────
  describe("R1 — cross-workspace replay rejection", () => {
    it("rejects replay when delivery belongs to a different workspace", async () => {
      const wsA = await seedWorkspace();

      // Create workspace B
      const wsB = await t.run(async (ctx) => {
        const now = Date.now();
        const workspaceId = await ctx.db.insert("workspaces", {
          name: "Workspace B",
          automationApiEnabled: true,
          createdAt: now,
        });
        return { workspaceId };
      });

      // Create an event and delivery in workspace A
      const { deliveryId } = await t.run(async (ctx) => {
        const now = Date.now();
        const eventId = await ctx.db.insert("automationEvents", {
          workspaceId: wsA.workspaceId,
          eventType: "conversation.created",
          resourceType: "conversation",
          resourceId: "conv123",
          data: {},
          timestamp: now,
        });
        const subscriptionId = await ctx.db.insert(
          "automationWebhookSubscriptions",
          {
            workspaceId: wsA.workspaceId,
            url: "https://example.com/webhook",
            signingSecret: "whsec_testsecret",
            signingSecretPrefix: "whsec_testsecr",
            status: "active",
            createdBy: wsA.userId,
            createdAt: now,
          }
        );
        const deliveryId = await ctx.db.insert("automationWebhookDeliveries", {
          workspaceId: wsA.workspaceId,
          subscriptionId,
          eventId,
          attemptNumber: 1,
          status: "failed",
          createdAt: now,
        });
        return { deliveryId };
      });

      // Replay from workspace B should be rejected
      await expect(
        t.mutation(internal.automationWebhookWorker.replayDelivery, {
          deliveryId,
          workspaceId: wsB.workspaceId,
        })
      ).rejects.toThrow("Delivery does not belong to this workspace");

      // Replay from workspace A should succeed
      const result = await t.mutation(
        internal.automationWebhookWorker.replayDelivery,
        {
          deliveryId,
          workspaceId: wsA.workspaceId,
        }
      );
      expect(result.success).toBe(true);
      expect(result.deliveryId).toBeDefined();
    });
  });

  // ── R6: Idempotency ──────────────────────────────────────────────────
  describe("R6 — idempotency", () => {
    it("returns cached result on duplicate idempotency key", async () => {
      const ws = await seedWorkspace();

      // Create a visitor and conversation with active claim
      const { conversationId } = await t.run(async (ctx) => {
        const now = Date.now();
        const visitorId = await ctx.db.insert("visitors", {
          workspaceId: ws.workspaceId,
          sessionId: "visitor-session",
          createdAt: now,
        });
        const conversationId = await ctx.db.insert("conversations", {
          workspaceId: ws.workspaceId,
          visitorId,
          status: "open",
          createdAt: now,
          updatedAt: now,
        });
        // Create active claim
        await ctx.db.insert("automationConversationClaims", {
          workspaceId: ws.workspaceId,
          conversationId,
          credentialId: ws.credentialId,
          status: "active",
          expiresAt: now + 5 * 60 * 1000,
          createdAt: now,
        });
        return { conversationId };
      });

      const idempotencyKey = "idem-key-123";

      // First call
      const result1 = await t.mutation(
        internal.automationApiInternals.sendMessageIdempotent,
        {
          workspaceId: ws.workspaceId,
          conversationId,
          credentialId: ws.credentialId,
          actorName: "test-bot",
          content: "Hello!",
          idempotencyKey,
        }
      );
      expect(result1.cached).toBe(false);
      expect(result1.result.id).toBeDefined();

      // Second call with same key
      const result2 = await t.mutation(
        internal.automationApiInternals.sendMessageIdempotent,
        {
          workspaceId: ws.workspaceId,
          conversationId,
          credentialId: ws.credentialId,
          actorName: "test-bot",
          content: "Hello!",
          idempotencyKey,
        }
      );
      expect(result2.cached).toBe(true);

      // Verify only one message was created
      const messages = await t.run(async (ctx) => {
        return ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversationId)
          )
          .collect();
      });
      expect(messages).toHaveLength(1);

      // Verify one idempotency key row exists
      const keys = await t.run(async (ctx) => {
        return ctx.db
          .query("automationIdempotencyKeys")
          .withIndex("by_workspace_key", (q) =>
            q
              .eq("workspaceId", ws.workspaceId)
              .eq("key", idempotencyKey)
          )
          .collect();
      });
      expect(keys).toHaveLength(1);
    });
  });

  // ── R7: Rate limiting ────────────────────────────────────────────────
  describe("R7 — rate limiting", () => {
    it("blocks requests after 60 calls in a window", async () => {
      const ws = await seedWorkspace();

      // Make 60 calls (all should be allowed)
      for (let i = 0; i < 60; i++) {
        const result = await t.mutation(
          internal["lib/automationAuth"].checkRateLimit,
          {
            credentialId: ws.credentialId,
            workspaceId: ws.workspaceId,
          }
        );
        expect(result.allowed).toBe(true);
      }

      // 61st call should be blocked
      const blocked = await t.mutation(
        internal["lib/automationAuth"].checkRateLimit,
        {
          credentialId: ws.credentialId,
          workspaceId: ws.workspaceId,
        }
      );
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfter).toBeTypeOf("number");
      expect(blocked.retryAfter).toBeGreaterThan(0);
    });
  });

  // ── R7: Delivery attempt history ─────────────────────────────────────
  describe("R7 — delivery attempt history", () => {
    it("creates incrementing attempt numbers on retry", async () => {
      const ws = await seedWorkspace();

      const { deliveryId, subscriptionId, eventId } = await t.run(
        async (ctx) => {
          const now = Date.now();
          const eventId = await ctx.db.insert("automationEvents", {
            workspaceId: ws.workspaceId,
            eventType: "conversation.created",
            resourceType: "conversation",
            resourceId: "conv123",
            data: {},
            timestamp: now,
          });
          const subscriptionId = await ctx.db.insert(
            "automationWebhookSubscriptions",
            {
              workspaceId: ws.workspaceId,
              url: "https://example.com/webhook",
              signingSecret: "whsec_testsecret",
              signingSecretPrefix: "whsec_testsecr",
              status: "active",
              createdBy: ws.userId,
              createdAt: now,
            }
          );
          const deliveryId = await ctx.db.insert(
            "automationWebhookDeliveries",
            {
              workspaceId: ws.workspaceId,
              subscriptionId,
              eventId,
              attemptNumber: 1,
              status: "pending",
              createdAt: now,
            }
          );
          return { deliveryId, subscriptionId, eventId };
        }
      );

      // Simulate 3 retries
      for (let i = 0; i < 3; i++) {
        const currentDeliveries = await t.run(async (ctx) => {
          return ctx.db
            .query("automationWebhookDeliveries")
            .withIndex("by_event", (q) => q.eq("eventId", eventId))
            .collect();
        });
        const latest = currentDeliveries[currentDeliveries.length - 1];
        await t.mutation(internal.automationWebhookWorker.scheduleRetry, {
          deliveryId: latest._id,
          httpStatus: 500,
          error: "Server error",
          retryDelayMs: 30000,
        });
      }

      // Check deliveries
      const allDeliveries = await t.run(async (ctx) => {
        return ctx.db
          .query("automationWebhookDeliveries")
          .withIndex("by_event", (q) => q.eq("eventId", eventId))
          .collect();
      });

      // Original + 3 retries = 4 deliveries
      expect(allDeliveries).toHaveLength(4);
      expect(allDeliveries[0].attemptNumber).toBe(1);
      expect(allDeliveries[1].attemptNumber).toBe(2);
      expect(allDeliveries[2].attemptNumber).toBe(3);
      expect(allDeliveries[3].attemptNumber).toBe(4);

      // Original + retries 1-2 should be "failed"
      expect(allDeliveries[0].status).toBe("failed");
      expect(allDeliveries[1].status).toBe("failed");
      expect(allDeliveries[2].status).toBe("failed");
      // Latest should be "pending" (scheduled for delivery)
      expect(allDeliveries[3].status).toBe("pending");

      // Now replay — should create a new delivery with attemptNumber 1
      const replayResult = await t.mutation(
        internal.automationWebhookWorker.replayDelivery,
        {
          deliveryId: allDeliveries[0]._id,
          workspaceId: ws.workspaceId,
        }
      );
      expect(replayResult.success).toBe(true);

      const afterReplay = await t.run(async (ctx) => {
        return ctx.db
          .query("automationWebhookDeliveries")
          .withIndex("by_event", (q) => q.eq("eventId", eventId))
          .collect();
      });
      expect(afterReplay).toHaveLength(5);
      // The replay delivery should have attemptNumber 1
      const replayDelivery = afterReplay.find(
        (d) => d._id === replayResult.deliveryId
      );
      expect(replayDelivery?.attemptNumber).toBe(1);
    });
  });

  // ── R7: Webhook subscription filters ─────────────────────────────────
  describe("R7 — webhook subscription filters", () => {
    it("only creates deliveries for matching resourceType", async () => {
      const ws = await seedWorkspace();

      // Create subscription filtered to conversations only
      await t.run(async (ctx) => {
        await ctx.db.insert("automationWebhookSubscriptions", {
          workspaceId: ws.workspaceId,
          url: "https://example.com/webhook",
          signingSecret: "whsec_testsecret",
          signingSecretPrefix: "whsec_testsecr",
          resourceTypes: ["conversation"],
          status: "active",
          createdBy: ws.userId,
          createdAt: Date.now(),
        });
      });

      // Emit a ticket event — should NOT create a delivery
      await t.mutation(internal.automationEvents.emitEvent, {
        workspaceId: ws.workspaceId,
        eventType: "ticket.created",
        resourceType: "ticket",
        resourceId: "ticket123",
        data: {},
      });

      const ticketDeliveries = await t.run(async (ctx) => {
        return ctx.db
          .query("automationWebhookDeliveries")
          .withIndex("by_status", (q) => q.eq("status", "pending"))
          .collect();
      });
      expect(
        ticketDeliveries.filter(
          (d) => d.workspaceId === ws.workspaceId
        )
      ).toHaveLength(0);

      // Emit a conversation event — should create a delivery
      await t.mutation(internal.automationEvents.emitEvent, {
        workspaceId: ws.workspaceId,
        eventType: "conversation.created",
        resourceType: "conversation",
        resourceId: "conv123",
        data: {},
      });

      const convDeliveries = await t.run(async (ctx) => {
        return ctx.db
          .query("automationWebhookDeliveries")
          .withIndex("by_status", (q) => q.eq("status", "pending"))
          .collect();
      });
      expect(
        convDeliveries.filter(
          (d) => d.workspaceId === ws.workspaceId
        )
      ).toHaveLength(1);
    });

    it("filters by channel", async () => {
      const ws = await seedWorkspace();

      await t.run(async (ctx) => {
        await ctx.db.insert("automationWebhookSubscriptions", {
          workspaceId: ws.workspaceId,
          url: "https://example.com/webhook",
          signingSecret: "whsec_testsecret",
          signingSecretPrefix: "whsec_testsecr",
          channels: ["chat"],
          status: "active",
          createdBy: ws.userId,
          createdAt: Date.now(),
        });
      });

      // Email event — no delivery
      await t.mutation(internal.automationEvents.emitEvent, {
        workspaceId: ws.workspaceId,
        eventType: "conversation.created",
        resourceType: "conversation",
        resourceId: "conv1",
        data: { channel: "email" },
      });

      const emailDeliveries = await t.run(async (ctx) => {
        return ctx.db.query("automationWebhookDeliveries").collect();
      });
      expect(
        emailDeliveries.filter((d) => d.workspaceId === ws.workspaceId)
      ).toHaveLength(0);

      // Chat event — delivery created
      await t.mutation(internal.automationEvents.emitEvent, {
        workspaceId: ws.workspaceId,
        eventType: "conversation.created",
        resourceType: "conversation",
        resourceId: "conv2",
        data: { channel: "chat" },
      });

      const chatDeliveries = await t.run(async (ctx) => {
        return ctx.db.query("automationWebhookDeliveries").collect();
      });
      expect(
        chatDeliveries.filter((d) => d.workspaceId === ws.workspaceId)
      ).toHaveLength(1);
    });

    it("filters by aiWorkflowState", async () => {
      const ws = await seedWorkspace();

      await t.run(async (ctx) => {
        await ctx.db.insert("automationWebhookSubscriptions", {
          workspaceId: ws.workspaceId,
          url: "https://example.com/webhook",
          signingSecret: "whsec_testsecret",
          signingSecretPrefix: "whsec_testsecr",
          aiWorkflowStates: ["handoff"],
          status: "active",
          createdBy: ws.userId,
          createdAt: Date.now(),
        });
      });

      // ai_handled event — no delivery
      await t.mutation(internal.automationEvents.emitEvent, {
        workspaceId: ws.workspaceId,
        eventType: "conversation.updated",
        resourceType: "conversation",
        resourceId: "conv1",
        data: { aiWorkflowState: "ai_handled" },
      });

      let deliveries = await t.run(async (ctx) => {
        return ctx.db.query("automationWebhookDeliveries").collect();
      });
      expect(
        deliveries.filter((d) => d.workspaceId === ws.workspaceId)
      ).toHaveLength(0);

      // handoff event — delivery created
      await t.mutation(internal.automationEvents.emitEvent, {
        workspaceId: ws.workspaceId,
        eventType: "conversation.updated",
        resourceType: "conversation",
        resourceId: "conv1",
        data: { aiWorkflowState: "handoff" },
      });

      deliveries = await t.run(async (ctx) => {
        return ctx.db.query("automationWebhookDeliveries").collect();
      });
      expect(
        deliveries.filter((d) => d.workspaceId === ws.workspaceId)
      ).toHaveLength(1);
    });
  });

  // ── R7: Release clears assignee, escalate sets handoff ───────────────
  describe("R7 — release and escalate behavior", () => {
    it("release clears assignedAgentId", async () => {
      const ws = await seedWorkspace();

      const { conversationId } = await t.run(async (ctx) => {
        const now = Date.now();
        const visitorId = await ctx.db.insert("visitors", {
          workspaceId: ws.workspaceId,
          sessionId: "v1",
          createdAt: now,
        });
        const conversationId = await ctx.db.insert("conversations", {
          workspaceId: ws.workspaceId,
          visitorId,
          status: "open",
          assignedAgentId: ws.userId,
          createdAt: now,
          updatedAt: now,
        });
        await ctx.db.insert("automationConversationClaims", {
          workspaceId: ws.workspaceId,
          conversationId,
          credentialId: ws.credentialId,
          status: "active",
          expiresAt: now + 5 * 60 * 1000,
          createdAt: now,
        });
        return { conversationId };
      });

      await t.mutation(
        internal.automationConversationClaims.releaseConversation,
        {
          workspaceId: ws.workspaceId,
          conversationId,
          credentialId: ws.credentialId,
        }
      );

      const conv = await t.run(async (ctx) => {
        return ctx.db.get(conversationId);
      });
      expect(conv?.assignedAgentId).toBeUndefined();
    });

    it("escalate sets aiWorkflowState to handoff", async () => {
      const ws = await seedWorkspace();

      const { conversationId } = await t.run(async (ctx) => {
        const now = Date.now();
        const visitorId = await ctx.db.insert("visitors", {
          workspaceId: ws.workspaceId,
          sessionId: "v2",
          createdAt: now,
        });
        const conversationId = await ctx.db.insert("conversations", {
          workspaceId: ws.workspaceId,
          visitorId,
          status: "open",
          createdAt: now,
          updatedAt: now,
        });
        await ctx.db.insert("automationConversationClaims", {
          workspaceId: ws.workspaceId,
          conversationId,
          credentialId: ws.credentialId,
          status: "active",
          expiresAt: now + 5 * 60 * 1000,
          createdAt: now,
        });
        return { conversationId };
      });

      await t.mutation(
        internal.automationConversationClaims.escalateConversation,
        {
          workspaceId: ws.workspaceId,
          conversationId,
          credentialId: ws.credentialId,
        }
      );

      const conv = await t.run(async (ctx) => {
        return ctx.db.get(conversationId);
      });
      expect(conv?.aiWorkflowState).toBe("handoff");
    });
  });
});
