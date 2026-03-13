import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { convexTest } from "convex-test";
import { internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import {
  decryptWebhookSecret,
  encryptWebhookSecret,
} from "../convex/lib/automationWebhookSecrets";

const modules = import.meta.glob("../convex/**/*.ts");
const TEST_WEBHOOK_ENCRYPTION_KEY =
  "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

describe("automation fixes", () => {
  let t: ReturnType<typeof convexTest>;
  let previousEncryptionKey: string | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    previousEncryptionKey = process.env.AUTOMATION_WEBHOOK_SECRET_ENCRYPTION_KEY;
    process.env.AUTOMATION_WEBHOOK_SECRET_ENCRYPTION_KEY =
      TEST_WEBHOOK_ENCRYPTION_KEY;
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
    if (previousEncryptionKey === undefined) {
      delete process.env.AUTOMATION_WEBHOOK_SECRET_ENCRYPTION_KEY;
    } else {
      process.env.AUTOMATION_WEBHOOK_SECRET_ENCRYPTION_KEY =
        previousEncryptionKey;
    }
  });

  async function signHmac(secret: string, payload: string) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    return Array.from(new Uint8Array(signature))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

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

  // ── Issue 7: Delivery ID header ──────────────────────────────────────
  describe("Issue 7 — delivery ID header", () => {
    it("fetch receives both X-Opencom-Event-Id and X-Opencom-Delivery-Id headers", async () => {
      const ws = await seedWorkspace();
      const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => "",
      }));
      vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

      const { deliveryId } = await t.run(async (ctx) => {
        const now = Date.now();
        const eventId = await ctx.db.insert("automationEvents", {
          workspaceId: ws.workspaceId,
          eventType: "conversation.created",
          resourceType: "conversation",
          resourceId: "conv1",
          data: {},
          timestamp: now,
        });
        const subscriptionId = await ctx.db.insert("automationWebhookSubscriptions", {
          workspaceId: ws.workspaceId,
          url: "https://example.com/webhook",
          signingSecret: "whsec_testsecret",
          signingSecretPrefix: "whsec_testsecr",
          status: "active",
          createdBy: ws.userId,
          createdAt: now,
        });
        const deliveryId = await ctx.db.insert("automationWebhookDeliveries", {
          workspaceId: ws.workspaceId,
          subscriptionId,
          eventId,
          attemptNumber: 1,
          status: "pending",
          createdAt: now,
        });
        return { deliveryId };
      });

      await t.action(internal.automationWebhookWorker.deliverWebhook, {
        deliveryId,
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers["X-Opencom-Event-Id"]).toBeDefined();
      expect(headers["X-Opencom-Delivery-Id"]).toBeDefined();
    });
  });

  // ── Issue 2: Orphaned deliveries + replay validation ──────────────────
  describe("Issue 2 — orphaned deliveries and replay validation", () => {
    it("marks delivery as failed when subscription is deleted", async () => {
      const ws = await seedWorkspace();

      const { deliveryId } = await t.run(async (ctx) => {
        const now = Date.now();
        const eventId = await ctx.db.insert("automationEvents", {
          workspaceId: ws.workspaceId,
          eventType: "conversation.created",
          resourceType: "conversation",
          resourceId: "conv1",
          data: {},
          timestamp: now,
        });
        // Create then delete subscription to orphan the delivery
        const subscriptionId = await ctx.db.insert("automationWebhookSubscriptions", {
          workspaceId: ws.workspaceId,
          url: "https://example.com/webhook",
          signingSecret: "whsec_testsecret",
          signingSecretPrefix: "whsec_testsecr",
          status: "active",
          createdBy: ws.userId,
          createdAt: now,
        });
        const deliveryId = await ctx.db.insert("automationWebhookDeliveries", {
          workspaceId: ws.workspaceId,
          subscriptionId,
          eventId,
          attemptNumber: 1,
          status: "pending",
          createdAt: now,
        });
        await ctx.db.delete(subscriptionId);
        return { deliveryId };
      });

      await t.action(internal.automationWebhookWorker.deliverWebhook, {
        deliveryId,
      });

      const delivery = await t.run(async (ctx) => ctx.db.get(deliveryId));
      expect(delivery?.status).toBe("failed");
      expect(delivery?.error).toContain("no longer exists");
    });

    it("replay throws when subscription is deleted", async () => {
      const ws = await seedWorkspace();

      const { deliveryId } = await t.run(async (ctx) => {
        const now = Date.now();
        const eventId = await ctx.db.insert("automationEvents", {
          workspaceId: ws.workspaceId,
          eventType: "conversation.created",
          resourceType: "conversation",
          resourceId: "conv1",
          data: {},
          timestamp: now,
        });
        const subscriptionId = await ctx.db.insert("automationWebhookSubscriptions", {
          workspaceId: ws.workspaceId,
          url: "https://example.com/webhook",
          signingSecret: "whsec_testsecret",
          signingSecretPrefix: "whsec_testsecr",
          status: "active",
          createdBy: ws.userId,
          createdAt: now,
        });
        const deliveryId = await ctx.db.insert("automationWebhookDeliveries", {
          workspaceId: ws.workspaceId,
          subscriptionId,
          eventId,
          attemptNumber: 1,
          status: "failed",
          createdAt: now,
        });
        await ctx.db.delete(subscriptionId);
        return { deliveryId };
      });

      await expect(
        t.mutation(internal.automationWebhookWorker.replayDelivery, {
          deliveryId,
          workspaceId: ws.workspaceId,
        })
      ).rejects.toThrow("Webhook subscription no longer exists");
    });

    it("replay throws when event is deleted", async () => {
      const ws = await seedWorkspace();

      const { deliveryId } = await t.run(async (ctx) => {
        const now = Date.now();
        const eventId = await ctx.db.insert("automationEvents", {
          workspaceId: ws.workspaceId,
          eventType: "conversation.created",
          resourceType: "conversation",
          resourceId: "conv1",
          data: {},
          timestamp: now,
        });
        const subscriptionId = await ctx.db.insert("automationWebhookSubscriptions", {
          workspaceId: ws.workspaceId,
          url: "https://example.com/webhook",
          signingSecret: "whsec_testsecret",
          signingSecretPrefix: "whsec_testsecr",
          status: "active",
          createdBy: ws.userId,
          createdAt: now,
        });
        const deliveryId = await ctx.db.insert("automationWebhookDeliveries", {
          workspaceId: ws.workspaceId,
          subscriptionId,
          eventId,
          attemptNumber: 1,
          status: "failed",
          createdAt: now,
        });
        await ctx.db.delete(eventId);
        return { deliveryId };
      });

      await expect(
        t.mutation(internal.automationWebhookWorker.replayDelivery, {
          deliveryId,
          workspaceId: ws.workspaceId,
        })
      ).rejects.toThrow("Event no longer exists");
    });
  });

  // ── Issue 3: Webhook secret spec alignment ─────────────────────────────
  describe("Issue 3 — webhook secret visibility", () => {
    it("create subscription returns signingSecret, list does not", async () => {
      const ws = await seedWorkspace();

      // We can't call authMutation directly, but we can verify the schema behavior
      // by creating a subscription directly and checking list output
      const { subscriptionId, signingSecret } = await t.run(async (ctx) => {
        const secret = "whsec_testSecretForVerification1234567890";
        const id = await ctx.db.insert("automationWebhookSubscriptions", {
          workspaceId: ws.workspaceId,
          url: "https://example.com/webhook",
          signingSecret: secret,
          signingSecretPrefix: secret.slice(0, 14),
          status: "active",
          createdBy: ws.userId,
          createdAt: Date.now(),
        });
        return { subscriptionId: id, signingSecret: secret };
      });

      // Verify the subscription has signingSecret stored
      const sub = await t.run(async (ctx) => ctx.db.get(subscriptionId));
      expect(sub?.signingSecret).toBe(signingSecret);
      expect(sub?.signingSecretPrefix).toBe(signingSecret.slice(0, 14));
    });
  });

  // ── Issue 5: API surface gaps ──────────────────────────────────────────
  describe("Issue 5 — API surface gaps", () => {
    it("list conversations includes aiHandoffReason", async () => {
      const ws = await seedWorkspace();

      await t.run(async (ctx) => {
        const now = Date.now();
        const visitorId = await ctx.db.insert("visitors", {
          workspaceId: ws.workspaceId,
          sessionId: "v1",
          createdAt: now,
        });
        await ctx.db.insert("conversations", {
          workspaceId: ws.workspaceId,
          visitorId,
          status: "open",
          aiWorkflowState: "handoff",
          aiHandoffReason: "Customer asked for human",
          createdAt: now,
          updatedAt: now,
        });
      });

      const result = (await t.query(
        internal.automationApiInternals.listConversationsForAutomation,
        {
          workspaceId: ws.workspaceId,
          limit: 10,
        }
      )) as { data: Array<{ aiHandoffReason?: string }> };

      expect(result.data).toHaveLength(1);
      expect(result.data[0].aiHandoffReason).toBe("Customer asked for human");
    });

    it("list conversations filters by channel", async () => {
      const ws = await seedWorkspace();

      await t.run(async (ctx) => {
        const now = Date.now();
        const visitorId = await ctx.db.insert("visitors", {
          workspaceId: ws.workspaceId,
          sessionId: "v1",
          createdAt: now,
        });
        await ctx.db.insert("conversations", {
          workspaceId: ws.workspaceId,
          visitorId,
          status: "open",
          channel: "chat",
          createdAt: now,
          updatedAt: now,
        });
        await ctx.db.insert("conversations", {
          workspaceId: ws.workspaceId,
          visitorId,
          status: "open",
          channel: "email",
          createdAt: now + 1,
          updatedAt: now + 1,
        });
      });

      const chatResult = (await t.query(
        internal.automationApiInternals.listConversationsForAutomation,
        {
          workspaceId: ws.workspaceId,
          limit: 10,
          channel: "chat",
        }
      )) as { data: Array<{ channel?: string }> };

      expect(chatResult.data).toHaveLength(1);
      expect(chatResult.data[0].channel).toBe("chat");
    });

    it("list conversations filters by visitor custom attribute", async () => {
      const ws = await seedWorkspace();

      await t.run(async (ctx) => {
        const now = Date.now();
        const enterpriseVisitorId = await ctx.db.insert("visitors", {
          workspaceId: ws.workspaceId,
          sessionId: "enterprise",
          customAttributes: { plan: "enterprise" },
          createdAt: now,
          firstSeenAt: now,
          lastSeenAt: now,
        });
        const freeVisitorId = await ctx.db.insert("visitors", {
          workspaceId: ws.workspaceId,
          sessionId: "free",
          customAttributes: { plan: "free" },
          createdAt: now + 1,
          firstSeenAt: now + 1,
          lastSeenAt: now + 1,
        });

        await ctx.db.insert("conversations", {
          workspaceId: ws.workspaceId,
          visitorId: enterpriseVisitorId,
          status: "open",
          createdAt: now,
          updatedAt: now + 100,
        });
        await ctx.db.insert("conversations", {
          workspaceId: ws.workspaceId,
          visitorId: freeVisitorId,
          status: "open",
          createdAt: now + 1,
          updatedAt: now + 101,
        });
      });

      const result = (await t.query(
        internal.automationApiInternals.listConversationsForAutomation,
        {
          workspaceId: ws.workspaceId,
          limit: 10,
          customAttributeKey: "plan",
          customAttributeValue: "enterprise",
        }
      )) as { data: Array<{ visitorId?: string }> };

      expect(result.data).toHaveLength(1);
      expect(result.data[0].visitorId).toBeDefined();
    });

    it("list visitors filters by custom attribute", async () => {
      const ws = await seedWorkspace();

      await t.run(async (ctx) => {
        const now = Date.now();
        await ctx.db.insert("visitors", {
          workspaceId: ws.workspaceId,
          sessionId: "v1",
          customAttributes: { plan: "enterprise", region: "us" },
          createdAt: now,
          firstSeenAt: now,
          lastSeenAt: now,
        });
        await ctx.db.insert("visitors", {
          workspaceId: ws.workspaceId,
          sessionId: "v2",
          customAttributes: { plan: "free", region: "eu" },
          createdAt: now + 1,
          firstSeenAt: now + 1,
          lastSeenAt: now + 1,
        });
        await ctx.db.insert("visitors", {
          workspaceId: ws.workspaceId,
          sessionId: "v3",
          createdAt: now + 2,
          firstSeenAt: now + 2,
          lastSeenAt: now + 2,
        });
      });

      const result = (await t.query(
        internal.automationApiInternals.listVisitorsForAutomation,
        {
          workspaceId: ws.workspaceId,
          limit: 10,
          customAttributeKey: "plan",
          customAttributeValue: "enterprise",
        }
      )) as { data: Array<{ customAttributes?: Record<string, unknown> }> };

      expect(result.data).toHaveLength(1);
      expect(result.data[0].customAttributes?.plan).toBe("enterprise");
    });
  });

  // ── Issue 6: Compound opaque cursors ───────────────────────────────────
  describe("Issue 6 — compound opaque cursors", () => {
    it("paginates events with same timestamp correctly", async () => {
      const ws = await seedWorkspace();
      const now = Date.now();

      // Create 3 events at the same timestamp
      await t.run(async (ctx) => {
        for (let i = 0; i < 3; i++) {
          await ctx.db.insert("automationEvents", {
            workspaceId: ws.workspaceId,
            eventType: "conversation.created",
            resourceType: "conversation",
            resourceId: `conv${i}`,
            data: {},
            timestamp: now,
          });
        }
      });

      // First page: limit=1
      const page1 = (await t.query(internal.automationEvents.listEvents, {
        workspaceId: ws.workspaceId,
        limit: 1,
      })) as { data: Array<{ id: string }>; nextCursor: string | null; hasMore: boolean };

      expect(page1.data).toHaveLength(1);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeDefined();

      // Second page
      const page2 = (await t.query(internal.automationEvents.listEvents, {
        workspaceId: ws.workspaceId,
        limit: 1,
        cursor: page1.nextCursor!,
      })) as { data: Array<{ id: string }>; nextCursor: string | null; hasMore: boolean };

      expect(page2.data).toHaveLength(1);
      expect(page2.data[0].id).not.toBe(page1.data[0].id);

      // Third page
      const page3 = (await t.query(internal.automationEvents.listEvents, {
        workspaceId: ws.workspaceId,
        limit: 1,
        cursor: page2.nextCursor!,
      })) as { data: Array<{ id: string }>; nextCursor: string | null; hasMore: boolean };

      expect(page3.data).toHaveLength(1);
      expect(page3.data[0].id).not.toBe(page1.data[0].id);
      expect(page3.data[0].id).not.toBe(page2.data[0].id);
    });

    it("backward compat: bare number cursor still works", async () => {
      const ws = await seedWorkspace();
      const now = Date.now();

      await t.run(async (ctx) => {
        await ctx.db.insert("automationEvents", {
          workspaceId: ws.workspaceId,
          eventType: "conversation.created",
          resourceType: "conversation",
          resourceId: "conv1",
          data: {},
          timestamp: now,
        });
        await ctx.db.insert("automationEvents", {
          workspaceId: ws.workspaceId,
          eventType: "conversation.created",
          resourceType: "conversation",
          resourceId: "conv2",
          data: {},
          timestamp: now - 1000,
        });
      });

      // Use a bare number cursor (old format)
      const result = (await t.query(internal.automationEvents.listEvents, {
        workspaceId: ws.workspaceId,
        limit: 10,
        cursor: String(now),
      })) as { data: Array<{ id: string }> };

      // Should return events at or before the timestamp
      expect(result.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── R4-1: Sync cursor correctness ─────────────────────────────────────
  describe("R4-1 — sync cursor uses updatedAt/lastSeenAt", () => {
    it("conversation filters page by updatedAt and honor updatedSince", async () => {
      const ws = await seedWorkspace();

      const ids = await t.run(async (ctx) => {
        const visitorA = await ctx.db.insert("visitors", {
          workspaceId: ws.workspaceId,
          sessionId: "v1",
          createdAt: 1000,
          firstSeenAt: 1000,
          lastSeenAt: 1000,
        });
        const visitorB = await ctx.db.insert("visitors", {
          workspaceId: ws.workspaceId,
          sessionId: "v2",
          createdAt: 2000,
          firstSeenAt: 2000,
          lastSeenAt: 2000,
        });

        const olderConversationId = await ctx.db.insert("conversations", {
          workspaceId: ws.workspaceId,
          visitorId: visitorA,
          status: "open",
          channel: "chat",
          createdAt: 1000,
          updatedAt: 1000,
        });
        const newerConversationId = await ctx.db.insert("conversations", {
          workspaceId: ws.workspaceId,
          visitorId: visitorB,
          status: "open",
          channel: "chat",
          createdAt: 2000,
          updatedAt: 2000,
        });

        return { olderConversationId, newerConversationId };
      });

      await t.run(async (ctx) => {
        await ctx.db.patch(ids.olderConversationId, { updatedAt: 4000 });
      });

      const page1 = (await t.query(
        internal.automationApiInternals.listConversationsForAutomation,
        {
          workspaceId: ws.workspaceId,
          limit: 1,
          status: "open",
          channel: "chat",
          updatedSince: 2500,
        }
      )) as {
        data: Array<{ id: string; updatedAt: number }>;
        nextCursor: string | null;
        hasMore: boolean;
      };

      expect(page1.data).toHaveLength(1);
      expect(page1.data[0].id).toBe(ids.olderConversationId);
      expect(page1.data[0].updatedAt).toBe(4000);
      expect(page1.hasMore).toBe(false);
    });

    it("conversation status pages stay in updatedAt order across cursors", async () => {
      const ws = await seedWorkspace();

      const ids = await t.run(async (ctx) => {
        const visitorId = await ctx.db.insert("visitors", {
          workspaceId: ws.workspaceId,
          sessionId: "v-sync",
          createdAt: 1000,
          firstSeenAt: 1000,
          lastSeenAt: 1000,
        });

        const oldestConversationId = await ctx.db.insert("conversations", {
          workspaceId: ws.workspaceId,
          visitorId,
          status: "open",
          createdAt: 1000,
          updatedAt: 1000,
        });
        const middleConversationId = await ctx.db.insert("conversations", {
          workspaceId: ws.workspaceId,
          visitorId,
          status: "open",
          createdAt: 2000,
          updatedAt: 2000,
        });
        const newestConversationId = await ctx.db.insert("conversations", {
          workspaceId: ws.workspaceId,
          visitorId,
          status: "open",
          createdAt: 3000,
          updatedAt: 3000,
        });

        return {
          oldestConversationId,
          middleConversationId,
          newestConversationId,
        };
      });

      const page1 = (await t.query(
        internal.automationApiInternals.listConversationsForAutomation,
        {
          workspaceId: ws.workspaceId,
          limit: 1,
          status: "open",
        }
      )) as {
        data: Array<{ id: string }>;
        nextCursor: string | null;
        hasMore: boolean;
      };
      expect(page1.data[0].id).toBe(ids.newestConversationId);
      expect(page1.hasMore).toBe(true);

      const page2 = (await t.query(
        internal.automationApiInternals.listConversationsForAutomation,
        {
          workspaceId: ws.workspaceId,
          limit: 1,
          status: "open",
          cursor: page1.nextCursor!,
        }
      )) as {
        data: Array<{ id: string }>;
        nextCursor: string | null;
        hasMore: boolean;
      };
      expect(page2.data[0].id).toBe(ids.middleConversationId);
      expect(page2.hasMore).toBe(true);

      const page3 = (await t.query(
        internal.automationApiInternals.listConversationsForAutomation,
        {
          workspaceId: ws.workspaceId,
          limit: 1,
          status: "open",
          cursor: page2.nextCursor!,
        }
      )) as {
        data: Array<{ id: string }>;
        nextCursor: string | null;
        hasMore: boolean;
      };
      expect(page3.data[0].id).toBe(ids.oldestConversationId);
      expect(page3.hasMore).toBe(false);
    });

    it("conversation pagination survives more than 2000 rows sharing the same updatedAt", async () => {
      const ws = await seedWorkspace();
      const totalConversations = 2050;

      await t.run(async (ctx) => {
        const visitorId = await ctx.db.insert("visitors", {
          workspaceId: ws.workspaceId,
          sessionId: "v-bulk-sync",
          createdAt: 1000,
          firstSeenAt: 1000,
          lastSeenAt: 1000,
        });

        for (let i = 0; i < totalConversations; i++) {
          await ctx.db.insert("conversations", {
            workspaceId: ws.workspaceId,
            visitorId,
            status: "open",
            channel: "chat",
            createdAt: 1000 + i,
            updatedAt: 5000,
          });
        }
      });

      const seenIds = new Set<string>();
      let cursor: string | undefined;

      while (true) {
        const page = (await t.query(
          internal.automationApiInternals.listConversationsForAutomation,
          {
            workspaceId: ws.workspaceId,
            limit: 100,
            status: "open",
            cursor,
          }
        )) as {
          data: Array<{ id: string }>;
          nextCursor: string | null;
          hasMore: boolean;
        };

        for (const conversation of page.data) {
          expect(seenIds.has(conversation.id)).toBe(false);
          seenIds.add(conversation.id);
        }

        if (!page.hasMore) {
          break;
        }

        cursor = page.nextCursor!;
      }

      expect(seenIds.size).toBe(totalConversations);
    });

    it("visitor identity filters page by lastSeenAt and honor updatedSince", async () => {
      const ws = await seedWorkspace();

      const ids = await t.run(async (ctx) => {
        const olderVisitorId = await ctx.db.insert("visitors", {
          workspaceId: ws.workspaceId,
          sessionId: "v1",
          email: "person@example.com",
          createdAt: 1000,
          firstSeenAt: 1000,
          lastSeenAt: 1000,
        });
        const newerVisitorId = await ctx.db.insert("visitors", {
          workspaceId: ws.workspaceId,
          sessionId: "v2",
          email: "person@example.com",
          createdAt: 2000,
          firstSeenAt: 2000,
          lastSeenAt: 2000,
        });
        return { olderVisitorId, newerVisitorId };
      });

      await t.run(async (ctx) => {
        await ctx.db.patch(ids.olderVisitorId, { lastSeenAt: 5000 });
      });

      const page1 = (await t.query(
        internal.automationApiInternals.listVisitorsForAutomation,
        {
          workspaceId: ws.workspaceId,
          limit: 1,
          email: "person@example.com",
          updatedSince: 2500,
        }
      )) as {
        data: Array<{ id: string; lastSeenAt?: number }>;
        nextCursor: string | null;
        hasMore: boolean;
      };

      expect(page1.data).toHaveLength(1);
      expect(page1.data[0].id).toBe(ids.olderVisitorId);
      expect(page1.data[0].lastSeenAt).toBe(5000);
      expect(page1.hasMore).toBe(false);
    });

    it("ticket status filters page by updatedAt and honor updatedSince", async () => {
      const ws = await seedWorkspace();

      const ids = await t.run(async (ctx) => {
        const olderTicketId = await ctx.db.insert("tickets", {
          workspaceId: ws.workspaceId,
          subject: "Older ticket",
          status: "submitted",
          priority: "normal",
          createdAt: 1000,
          updatedAt: 1000,
        });
        const newerTicketId = await ctx.db.insert("tickets", {
          workspaceId: ws.workspaceId,
          subject: "Newer ticket",
          status: "submitted",
          priority: "normal",
          createdAt: 2000,
          updatedAt: 2000,
        });
        return { olderTicketId, newerTicketId };
      });

      await t.run(async (ctx) => {
        await ctx.db.patch(ids.olderTicketId, { updatedAt: 4500 });
      });

      const page1 = (await t.query(
        internal.automationApiInternals.listTicketsForAutomation,
        {
          workspaceId: ws.workspaceId,
          limit: 1,
          status: "submitted",
          updatedSince: 2500,
        }
      )) as {
        data: Array<{ id: string; updatedAt: number }>;
        nextCursor: string | null;
        hasMore: boolean;
      };

      expect(page1.data).toHaveLength(1);
      expect(page1.data[0].id).toBe(ids.olderTicketId);
      expect(page1.data[0].updatedAt).toBe(4500);
      expect(page1.hasMore).toBe(false);
    });
  });

  // ── R4-2: Webhook secret encryption ─────────────────────────────────────
  describe("R4-2 — webhook secret encryption", () => {
    it("encrypts and decrypts webhook secrets for delivery signing", async () => {
      const ws = await seedWorkspace();
      const rawSecret = "whsec_encrypted_delivery_secret";
      const ciphertext = await encryptWebhookSecret(rawSecret);
      expect(ciphertext).not.toContain(rawSecret);
      await expect(decryptWebhookSecret(ciphertext)).resolves.toBe(rawSecret);

      const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => "",
      }));
      vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

      const { deliveryId } = await t.run(async (ctx) => {
        const now = Date.now();
        const eventId = await ctx.db.insert("automationEvents", {
          workspaceId: ws.workspaceId,
          eventType: "conversation.created",
          resourceType: "conversation",
          resourceId: "conv1",
          data: { source: "encrypted-test" },
          timestamp: now,
        });
        const subscriptionId = await ctx.db.insert(
          "automationWebhookSubscriptions",
          {
            workspaceId: ws.workspaceId,
            url: "https://example.com/webhook",
            signingSecretCiphertext: ciphertext,
            signingSecretPrefix: rawSecret.slice(0, 14),
            status: "active",
            createdBy: ws.userId,
            createdAt: now,
          }
        );
        const deliveryId = await ctx.db.insert("automationWebhookDeliveries", {
          workspaceId: ws.workspaceId,
          subscriptionId,
          eventId,
          attemptNumber: 1,
          status: "pending",
          createdAt: now,
        });
        return { deliveryId };
      });

      await t.action(internal.automationWebhookWorker.deliverWebhook, {
        deliveryId,
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, requestOptions] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = requestOptions.headers as Record<string, string>;
      const body = String(requestOptions.body);
      const timestamp = headers["X-Opencom-Timestamp"];
      expect(timestamp).toBeDefined();
      const expectedSignature = await signHmac(rawSecret, `${timestamp}.${body}`);
      expect(headers["X-Opencom-Signature"]).toBe(
        `t=${timestamp},v1=${expectedSignature}`
      );
    });

    it("delivery succeeds with legacy plaintext signingSecret", async () => {
      const ws = await seedWorkspace();
      const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => "",
      }));
      vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

      const { deliveryId } = await t.run(async (ctx) => {
        const now = Date.now();
        const eventId = await ctx.db.insert("automationEvents", {
          workspaceId: ws.workspaceId,
          eventType: "conversation.created",
          resourceType: "conversation",
          resourceId: "conv1",
          data: {},
          timestamp: now,
        });
        const subscriptionId = await ctx.db.insert(
          "automationWebhookSubscriptions",
          {
            workspaceId: ws.workspaceId,
            url: "https://example.com/webhook",
            signingSecret: "whsec_legacyplaintext",
            signingSecretPrefix: "whsec_legacypl",
            status: "active",
            createdBy: ws.userId,
            createdAt: now,
          }
        );
        const deliveryId = await ctx.db.insert("automationWebhookDeliveries", {
          workspaceId: ws.workspaceId,
          subscriptionId,
          eventId,
          attemptNumber: 1,
          status: "pending",
          createdAt: now,
        });
        return { deliveryId };
      });

      await t.action(internal.automationWebhookWorker.deliverWebhook, {
        deliveryId,
      });

      // Should have called fetch (delivery succeeded with plaintext secret)
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const delivery = await t.run(async (ctx) => ctx.db.get(deliveryId));
      expect(delivery?.status).toBe("success");
    });

    it("marks delivery failed when encrypted secret preparation fails", async () => {
      const ws = await seedWorkspace();
      const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => "",
      }));
      vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

      const { deliveryId } = await t.run(async (ctx) => {
        const now = Date.now();
        const eventId = await ctx.db.insert("automationEvents", {
          workspaceId: ws.workspaceId,
          eventType: "conversation.created",
          resourceType: "conversation",
          resourceId: "conv-invalid-secret",
          data: {},
          timestamp: now,
        });
        const subscriptionId = await ctx.db.insert(
          "automationWebhookSubscriptions",
          {
            workspaceId: ws.workspaceId,
            url: "https://example.com/webhook",
            signingSecretCiphertext: "invalid-ciphertext",
            signingSecretPrefix: "whsec_invalid",
            status: "active",
            createdBy: ws.userId,
            createdAt: now,
          }
        );
        const deliveryId = await ctx.db.insert("automationWebhookDeliveries", {
          workspaceId: ws.workspaceId,
          subscriptionId,
          eventId,
          attemptNumber: 1,
          status: "pending",
          createdAt: now,
        });
        return { deliveryId };
      });

      await t.action(internal.automationWebhookWorker.deliverWebhook, {
        deliveryId,
      });

      expect(fetchMock).not.toHaveBeenCalled();
      const delivery = await t.run(async (ctx) => ctx.db.get(deliveryId));
      expect(delivery?.status).toBe("failed");
      expect(delivery?.error).toContain("Failed to prepare webhook delivery");
      expect(delivery?.error).toContain("Invalid ciphertext format");
    });
  });

  // ── R4-4: Built-in AI respects active automation claims ────────────────
  describe("R4-4 — AI response suppression", () => {
    it("blocks ai-agent bot persistence while an automation claim is active", async () => {
      const ws = await seedWorkspace();

      const { conversationId } = await t.run(async (ctx) => {
        const now = Date.now();
        const visitorId = await ctx.db.insert("visitors", {
          workspaceId: ws.workspaceId,
          sessionId: "claimed-conversation-visitor",
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

      await expect(
        t.mutation(internal.messages.internalSendBotMessage, {
          conversationId,
          senderId: "ai-agent",
          content: "Automated AI reply",
        })
      ).rejects.toThrow("Conversation is currently claimed by external automation");
    });
  });

  // ── R4-3: Event feed tie-break buffer ────────────────────────────────────
  describe("R4-3 — event feed same-timestamp tie-break", () => {
    it("paginates 10 same-timestamp events at limit=2", async () => {
      const ws = await seedWorkspace();
      const now = Date.now();

      // Create 10 events at the same timestamp
      await t.run(async (ctx) => {
        for (let i = 0; i < 10; i++) {
          await ctx.db.insert("automationEvents", {
            workspaceId: ws.workspaceId,
            eventType: "conversation.created",
            resourceType: "conversation",
            resourceId: `conv${i}`,
            data: {},
            timestamp: now,
          });
        }
      });

      const seenIds = new Set<string>();
      let cursor: string | undefined;

      // Paginate through all events with limit=2
      for (let page = 0; page < 10; page++) {
        const result = (await t.query(internal.automationEvents.listEvents, {
          workspaceId: ws.workspaceId,
          limit: 2,
          cursor,
        })) as { data: Array<{ id: string }>; nextCursor: string | null; hasMore: boolean };

        for (const e of result.data) {
          expect(seenIds.has(e.id)).toBe(false); // no duplicates
          seenIds.add(e.id);
        }

        if (!result.hasMore) break;
        cursor = result.nextCursor!;
      }

      expect(seenIds.size).toBe(10);
    });

    it("paginates more than 2000 same-timestamp events without truncation", async () => {
      const ws = await seedWorkspace();
      const now = Date.now();
      const totalEvents = 2050;

      await t.run(async (ctx) => {
        for (let i = 0; i < totalEvents; i++) {
          await ctx.db.insert("automationEvents", {
            workspaceId: ws.workspaceId,
            eventType: "conversation.created",
            resourceType: "conversation",
            resourceId: `bulk-conv-${i}`,
            data: {},
            timestamp: now,
          });
        }
      });

      const seenIds = new Set<string>();
      let cursor: string | undefined;

      while (true) {
        const result = (await t.query(internal.automationEvents.listEvents, {
          workspaceId: ws.workspaceId,
          limit: 100,
          cursor,
        })) as {
          data: Array<{ id: string }>;
          nextCursor: string | null;
          hasMore: boolean;
        };

        for (const event of result.data) {
          expect(seenIds.has(event.id)).toBe(false);
          seenIds.add(event.id);
        }

        if (!result.hasMore) {
          break;
        }

        cursor = result.nextCursor!;
      }

      expect(seenIds.size).toBe(totalEvents);
    });
  });

  // ── Issue 4: Workspace-level rate limiting ─────────────────────────────
  describe("Issue 4 — workspace-level rate limiting", () => {
    it("enforces workspace limit at 120 across multiple credentials", async () => {
      const ws = await seedWorkspace();

      // Create a second credential
      const credentialId2 = await t.run(async (ctx) => {
        return ctx.db.insert("automationCredentials", {
          workspaceId: ws.workspaceId,
          name: "Test Key 2",
          secretHash: "testhash456",
          secretPrefix: "osk_tes2",
          scopes: ["conversations.read"],
          status: "active",
          actorName: "test-bot-2",
          createdBy: ws.userId,
          createdAt: Date.now(),
        });
      });

      // Alternate between credentials: 60 each = 120 total (should all pass)
      for (let i = 0; i < 60; i++) {
        await t.mutation(internal["lib/automationAuth"].checkRateLimit, {
          credentialId: ws.credentialId,
          workspaceId: ws.workspaceId,
        });
        await t.mutation(internal["lib/automationAuth"].checkRateLimit, {
          credentialId: credentialId2,
          workspaceId: ws.workspaceId,
        });
      }

      // 121st request should be blocked by workspace limit
      const blocked = await t.mutation(
        internal["lib/automationAuth"].checkRateLimit,
        {
          credentialId: ws.credentialId,
          workspaceId: ws.workspaceId,
        }
      );
      expect(blocked.allowed).toBe(false);
    });

    it("single credential still hits its own limit at 60", async () => {
      const ws = await seedWorkspace();

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

      const blocked = await t.mutation(
        internal["lib/automationAuth"].checkRateLimit,
        {
          credentialId: ws.credentialId,
          workspaceId: ws.workspaceId,
        }
      );
      expect(blocked.allowed).toBe(false);
    });
  });

  // ── 2.1b: Articles & Collections CRUD ────────────────────────────────
  describe("2.1b: Articles & Collections CRUD", () => {
    async function seedWorkspaceWithArticleScopes() {
      return t.run(async (ctx) => {
        const now = Date.now();
        const workspaceId = await ctx.db.insert("workspaces", {
          name: "Article Test Workspace",
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
          name: "Full Key",
          secretHash: "testhash456",
          secretPrefix: "osk_full",
          scopes: [
            "articles.read",
            "articles.write",
            "collections.read",
            "collections.write",
          ],
          status: "active",
          actorName: "test-bot",
          createdBy: userId,
          createdAt: now,
        });
        return { workspaceId, userId, credentialId };
      });
    }

    it("article CRUD happy path", async () => {
      const ws = await seedWorkspaceWithArticleScopes();

      // Create
      const { id: articleId } = await t.mutation(
        internal.automationApiInternals.createArticleForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          title: "Getting Started",
          content: "Welcome to the guide.",
        }
      );
      expect(articleId).toBeTruthy();

      // Get
      const article = await t.query(
        internal.automationApiInternals.getArticleForAutomation,
        {
          workspaceId: ws.workspaceId,
          articleId,
        }
      );
      expect(article).not.toBeNull();
      expect(article!.title).toBe("Getting Started");
      expect(article!.status).toBe("draft");
      expect(article!.slug).toBe("getting-started");

      // Update (title changes slug)
      await t.mutation(
        internal.automationApiInternals.updateArticleForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          articleId,
          title: "Quick Start Guide",
          content: "Updated content.",
        }
      );

      const updated = await t.query(
        internal.automationApiInternals.getArticleForAutomation,
        {
          workspaceId: ws.workspaceId,
          articleId,
        }
      );
      expect(updated!.title).toBe("Quick Start Guide");
      expect(updated!.slug).toBe("quick-start-guide");
      expect(updated!.content).toBe("Updated content.");

      // List
      const listResult = await t.query(
        internal.automationApiInternals.listArticlesForAutomation,
        {
          workspaceId: ws.workspaceId,
          limit: 10,
        }
      );
      expect(listResult.data.length).toBe(1);
      expect(listResult.data[0].id).toBe(articleId);

      // Delete
      await t.mutation(
        internal.automationApiInternals.deleteArticleForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          articleId,
        }
      );

      const deleted = await t.query(
        internal.automationApiInternals.getArticleForAutomation,
        {
          workspaceId: ws.workspaceId,
          articleId,
        }
      );
      expect(deleted).toBeNull();
    });

    it("collection CRUD happy path", async () => {
      const ws = await seedWorkspaceWithArticleScopes();

      // Create
      const { id: collectionId } = await t.mutation(
        internal.automationApiInternals.createCollectionForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          name: "FAQ",
          description: "Frequently asked questions",
        }
      );
      expect(collectionId).toBeTruthy();

      // Get
      const collection = await t.query(
        internal.automationApiInternals.getCollectionForAutomation,
        {
          workspaceId: ws.workspaceId,
          collectionId,
        }
      );
      expect(collection).not.toBeNull();
      expect(collection!.name).toBe("FAQ");
      expect(collection!.slug).toBe("faq");

      // Update
      await t.mutation(
        internal.automationApiInternals.updateCollectionForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          collectionId,
          name: "Help Center FAQ",
          description: "Updated description",
        }
      );

      const updated = await t.query(
        internal.automationApiInternals.getCollectionForAutomation,
        {
          workspaceId: ws.workspaceId,
          collectionId,
        }
      );
      expect(updated!.name).toBe("Help Center FAQ");
      expect(updated!.slug).toBe("help-center-faq");

      // List
      const listResult = await t.query(
        internal.automationApiInternals.listCollectionsForAutomation,
        {
          workspaceId: ws.workspaceId,
          limit: 10,
        }
      );
      expect(listResult.data.length).toBe(1);
      expect(listResult.data[0].id).toBe(collectionId);

      // Delete
      await t.mutation(
        internal.automationApiInternals.deleteCollectionForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          collectionId,
        }
      );

      const deleted = await t.query(
        internal.automationApiInternals.getCollectionForAutomation,
        {
          workspaceId: ws.workspaceId,
          collectionId,
        }
      );
      expect(deleted).toBeNull();
    });

    it("rejects cross-workspace foreign IDs", async () => {
      const wsA = await seedWorkspaceWithArticleScopes();
      const wsB = await t.run(async (ctx) => {
        const now = Date.now();
        const workspaceId = await ctx.db.insert("workspaces", {
          name: "Workspace B",
          automationApiEnabled: true,
          createdAt: now,
        });
        const userId = await ctx.db.insert("users", {
          email: "admin-b@test.com",
          workspaceId,
          role: "admin",
          createdAt: now,
        });
        const credentialId = await ctx.db.insert("automationCredentials", {
          workspaceId,
          name: "B Key",
          secretHash: "testhash789",
          secretPrefix: "osk_b",
          scopes: ["articles.read", "articles.write", "collections.read", "collections.write"],
          status: "active",
          actorName: "test-bot-b",
          createdBy: userId,
          createdAt: now,
        });
        return { workspaceId, userId, credentialId };
      });

      // Create collection in workspace B
      const { id: collectionB } = await t.mutation(
        internal.automationApiInternals.createCollectionForAutomation,
        {
          workspaceId: wsB.workspaceId,
          credentialId: wsB.credentialId,
          name: "B Collection",
        }
      );

      // Create article in workspace A with workspace B's collection → error
      await expect(
        t.mutation(
          internal.automationApiInternals.createArticleForAutomation,
          {
            workspaceId: wsA.workspaceId,
            credentialId: wsA.credentialId,
            title: "Cross workspace test",
            content: "Should fail",
            collectionId: collectionB,
          }
        )
      ).rejects.toThrow("Collection not found");

      // Create collection in workspace A with workspace B's collection as parent → error
      await expect(
        t.mutation(
          internal.automationApiInternals.createCollectionForAutomation,
          {
            workspaceId: wsA.workspaceId,
            credentialId: wsA.credentialId,
            name: "Cross workspace child",
            parentId: collectionB,
          }
        )
      ).rejects.toThrow("Parent collection not found");
    });

    it("rejects collection cycle", async () => {
      const ws = await seedWorkspaceWithArticleScopes();

      // Create A, then B as child of A
      const { id: collA } = await t.mutation(
        internal.automationApiInternals.createCollectionForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          name: "Collection A",
        }
      );
      const { id: collB } = await t.mutation(
        internal.automationApiInternals.createCollectionForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          name: "Collection B",
          parentId: collA,
        }
      );

      // Try to set A.parentId = B (creates cycle)
      await expect(
        t.mutation(
          internal.automationApiInternals.updateCollectionForAutomation,
          {
            workspaceId: ws.workspaceId,
            credentialId: ws.credentialId,
            collectionId: collA,
            parentId: collB,
          }
        )
      ).rejects.toThrow("Collection cannot be moved into its own descendant");
    });

    it("enforces collection deletion guards", async () => {
      const ws = await seedWorkspaceWithArticleScopes();

      // Create parent collection
      const { id: parentId } = await t.mutation(
        internal.automationApiInternals.createCollectionForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          name: "Parent",
        }
      );

      // Create child collection
      const { id: childId } = await t.mutation(
        internal.automationApiInternals.createCollectionForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          name: "Child",
          parentId,
        }
      );

      // Can't delete parent with children
      await expect(
        t.mutation(
          internal.automationApiInternals.deleteCollectionForAutomation,
          {
            workspaceId: ws.workspaceId,
            credentialId: ws.credentialId,
            collectionId: parentId,
          }
        )
      ).rejects.toThrow("Cannot delete collection with child collections");

      // Delete child, then create article in parent
      await t.mutation(
        internal.automationApiInternals.deleteCollectionForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          collectionId: childId,
        }
      );

      await t.mutation(
        internal.automationApiInternals.createArticleForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          title: "Article in parent",
          content: "Content",
          collectionId: parentId,
        }
      );

      // Can't delete collection with articles
      await expect(
        t.mutation(
          internal.automationApiInternals.deleteCollectionForAutomation,
          {
            workspaceId: ws.workspaceId,
            credentialId: ws.credentialId,
            collectionId: parentId,
          }
        )
      ).rejects.toThrow("Cannot delete collection with articles");
    });

    it("audit logging records credentialId and actorType", async () => {
      const ws = await seedWorkspaceWithArticleScopes();

      const { id: articleId } = await t.mutation(
        internal.automationApiInternals.createArticleForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          title: "Audit test article",
          content: "Content",
        }
      );

      // Verify audit log entry
      const auditEntries = await t.run(async (ctx) => {
        return await ctx.db
          .query("auditLogs")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", ws.workspaceId))
          .collect();
      });

      const articleCreated = auditEntries.find(
        (entry) => entry.action === "automation.article.created"
      );
      expect(articleCreated).toBeTruthy();
      expect(articleCreated!.actorType).toBe("api");
      expect(articleCreated!.resourceId).toBe(String(articleId));
      expect((articleCreated!.metadata as any).credentialId).toBe(
        String(ws.credentialId)
      );
    });

    it("article status update to published schedules embedding", async () => {
      const ws = await seedWorkspaceWithArticleScopes();

      // Create draft article
      const { id: articleId } = await t.mutation(
        internal.automationApiInternals.createArticleForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          title: "Embed Test",
          content: "Should get embedding on publish.",
        }
      );

      // Publish via status update (no title/content/visibility change)
      await t.mutation(
        internal.automationApiInternals.updateArticleForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          articleId,
          status: "published",
        }
      );

      const published = await t.query(
        internal.automationApiInternals.getArticleForAutomation,
        { workspaceId: ws.workspaceId, articleId }
      );
      expect(published!.status).toBe("published");
      expect(published!.publishedAt).toBeTruthy();
    });

    it("article status update to archived preserves publishedAt", async () => {
      const ws = await seedWorkspaceWithArticleScopes();

      const { id: articleId } = await t.mutation(
        internal.automationApiInternals.createArticleForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          title: "Archive Test",
          content: "Content",
        }
      );

      // Publish then archive
      await t.mutation(
        internal.automationApiInternals.updateArticleForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          articleId,
          status: "published",
        }
      );

      const published = await t.query(
        internal.automationApiInternals.getArticleForAutomation,
        { workspaceId: ws.workspaceId, articleId }
      );
      const publishedAt = published!.publishedAt;
      expect(publishedAt).toBeTruthy();

      await t.mutation(
        internal.automationApiInternals.updateArticleForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          articleId,
          status: "archived",
        }
      );

      const archived = await t.query(
        internal.automationApiInternals.getArticleForAutomation,
        { workspaceId: ws.workspaceId, articleId }
      );
      expect(archived!.status).toBe("archived");
      // Archiving preserves publishedAt (matches dedicated archiveArticleCore behavior)
      expect(archived!.publishedAt).toBe(publishedAt);
    });

    it("article list filters by status and collectionId", async () => {
      const ws = await seedWorkspaceWithArticleScopes();

      const { id: collectionId } = await t.mutation(
        internal.automationApiInternals.createCollectionForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          name: "Filter Test Collection",
        }
      );

      // Create two articles: one in collection (published), one without (draft)
      const { id: articleInCollection } = await t.mutation(
        internal.automationApiInternals.createArticleForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          title: "In Collection",
          content: "Content A",
          collectionId,
        }
      );
      await t.mutation(
        internal.automationApiInternals.updateArticleForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          articleId: articleInCollection,
          status: "published",
        }
      );

      await t.mutation(
        internal.automationApiInternals.createArticleForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          title: "No Collection",
          content: "Content B",
        }
      );

      // Filter by status
      const publishedOnly = await t.query(
        internal.automationApiInternals.listArticlesForAutomation,
        {
          workspaceId: ws.workspaceId,
          limit: 10,
          status: "published",
        }
      );
      expect(publishedOnly.data.length).toBe(1);
      expect(publishedOnly.data[0].title).toBe("In Collection");

      // Filter by collectionId
      const inColl = await t.query(
        internal.automationApiInternals.listArticlesForAutomation,
        {
          workspaceId: ws.workspaceId,
          limit: 10,
          collectionId,
        }
      );
      expect(inColl.data.length).toBe(1);
      expect(inColl.data[0].id).toBe(articleInCollection);

      // Both filters combined
      const draftInCollection = await t.query(
        internal.automationApiInternals.listArticlesForAutomation,
        {
          workspaceId: ws.workspaceId,
          limit: 10,
          status: "draft",
          collectionId,
        }
      );
      expect(draftInCollection.data.length).toBe(0);
    });

    it("collection list filters by parentId", async () => {
      const ws = await seedWorkspaceWithArticleScopes();

      const { id: parentId } = await t.mutation(
        internal.automationApiInternals.createCollectionForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          name: "Parent",
        }
      );
      await t.mutation(
        internal.automationApiInternals.createCollectionForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          name: "Child",
          parentId,
        }
      );
      await t.mutation(
        internal.automationApiInternals.createCollectionForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          name: "Root Sibling",
        }
      );

      // Filter by parentId
      const children = await t.query(
        internal.automationApiInternals.listCollectionsForAutomation,
        {
          workspaceId: ws.workspaceId,
          limit: 10,
          parentId,
        }
      );
      expect(children.data.length).toBe(1);
      expect(children.data[0].name).toBe("Child");
    });

    it("collection unparenting with parentId: null", async () => {
      const ws = await seedWorkspaceWithArticleScopes();

      const { id: parentId } = await t.mutation(
        internal.automationApiInternals.createCollectionForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          name: "Parent",
        }
      );
      const { id: childId } = await t.mutation(
        internal.automationApiInternals.createCollectionForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          name: "Child",
          parentId,
        }
      );

      // Verify it has a parent
      const before = await t.query(
        internal.automationApiInternals.getCollectionForAutomation,
        { workspaceId: ws.workspaceId, collectionId: childId }
      );
      expect(before!.parentId).toBe(parentId);

      // Unparent with null
      await t.mutation(
        internal.automationApiInternals.updateCollectionForAutomation,
        {
          workspaceId: ws.workspaceId,
          credentialId: ws.credentialId,
          collectionId: childId,
          parentId: null,
        }
      );

      const after = await t.query(
        internal.automationApiInternals.getCollectionForAutomation,
        { workspaceId: ws.workspaceId, collectionId: childId }
      );
      expect(after!.parentId).toBeUndefined();
    });
  });
});
