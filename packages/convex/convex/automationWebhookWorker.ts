import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";

// Self-references via makeFunctionReference
const deliverWebhookRef = makeFunctionReference<"action">(
  "automationWebhookWorker:deliverWebhook"
);
const getDeliveryDataRef = makeFunctionReference<"query">(
  "automationWebhookWorker:getDeliveryData"
);
const updateDeliveryStatusRef = makeFunctionReference<"mutation">(
  "automationWebhookWorker:updateDeliveryStatus"
);
const scheduleRetryRef = makeFunctionReference<"mutation">(
  "automationWebhookWorker:scheduleRetry"
);

// Retry backoff schedule: 30s, 2m, 10m, 1h, 4h
const RETRY_DELAYS_MS = [
  30 * 1000,
  2 * 60 * 1000,
  10 * 60 * 1000,
  60 * 60 * 1000,
  4 * 60 * 60 * 1000,
];
const MAX_ATTEMPTS = 5;

async function hmacSign(secret: string, payload: string): Promise<string> {
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
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type RunMutation = (ref: unknown, args: Record<string, unknown>) => Promise<unknown>;

export const deliverWebhook = internalAction({
  args: {
    deliveryId: v.id("automationWebhookDeliveries"),
  },
  handler: async (ctx, args) => {
    // Load delivery, subscription, and event data
    const deliveryData = (await ctx.runQuery(getDeliveryDataRef, {
      deliveryId: args.deliveryId,
    })) as {
      delivery: {
        _id: string;
        subscriptionId: string;
        eventId: string;
        attemptNumber: number;
        workspaceId: string;
      };
      subscription: {
        url: string;
        signingSecret: string;
      };
      event: {
        eventType: string;
        resourceType: string;
        resourceId: string;
        data: unknown;
        timestamp: number;
      };
    } | null;

    if (!deliveryData) {
      return;
    }

    const { delivery, subscription, event } = deliveryData;

    const body = JSON.stringify({
      eventType: event.eventType,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      data: event.data,
      timestamp: event.timestamp,
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${body}`;

    const signature = await hmacSign(subscription.signingSecret, signedPayload);

    const runMutation = ctx.runMutation as unknown as RunMutation;

    try {
      const response = await fetch(subscription.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Opencom-Signature": `t=${timestamp},v1=${signature}`,
          "X-Opencom-Event-Id": delivery.eventId,
          "X-Opencom-Timestamp": String(timestamp),
        },
        body,
        signal: AbortSignal.timeout(30000), // 30s timeout
      });

      if (response.ok) {
        await runMutation(updateDeliveryStatusRef, {
          deliveryId: args.deliveryId,
          status: "success",
          httpStatus: response.status,
        });
      } else {
        const errorText = await response.text().catch(() => "");
        await handleDeliveryFailure(
          runMutation,
          args.deliveryId,
          delivery.attemptNumber,
          response.status,
          errorText
        );
      }
    } catch (error) {
      await handleDeliveryFailure(
        runMutation,
        args.deliveryId,
        delivery.attemptNumber,
        undefined,
        String(error)
      );
    }
  },
});

async function handleDeliveryFailure(
  runMutation: RunMutation,
  deliveryId: string,
  attemptNumber: number,
  httpStatus: number | undefined,
  error: string
) {
  if (attemptNumber < MAX_ATTEMPTS) {
    const retryDelay = RETRY_DELAYS_MS[attemptNumber - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
    await runMutation(scheduleRetryRef, {
      deliveryId,
      httpStatus,
      error,
      retryDelayMs: retryDelay,
    });
  } else {
    await runMutation(updateDeliveryStatusRef, {
      deliveryId,
      status: "failed",
      httpStatus,
      error,
    });
  }
}

export const getDeliveryData = internalQuery({
  args: {
    deliveryId: v.id("automationWebhookDeliveries"),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) return null;

    const subscription = await ctx.db.get(delivery.subscriptionId);
    if (!subscription) return null;

    const event = await ctx.db.get(delivery.eventId);
    if (!event) return null;

    return { delivery, subscription, event };
  },
});

export const updateDeliveryStatus = internalMutation({
  args: {
    deliveryId: v.id("automationWebhookDeliveries"),
    status: v.union(v.literal("success"), v.literal("failed")),
    httpStatus: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deliveryId, {
      status: args.status,
      httpStatus: args.httpStatus,
      error: args.error,
    });
  },
});

export const scheduleRetry = internalMutation({
  args: {
    deliveryId: v.id("automationWebhookDeliveries"),
    httpStatus: v.optional(v.number()),
    error: v.optional(v.string()),
    retryDelayMs: v.number(),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) return;

    // Mark current delivery as failed
    await ctx.db.patch(args.deliveryId, {
      status: "failed" as const,
      httpStatus: args.httpStatus,
      error: args.error,
    });

    // Create new delivery row for the retry attempt
    const now = Date.now();
    const newDeliveryId = await ctx.db.insert("automationWebhookDeliveries", {
      workspaceId: delivery.workspaceId,
      subscriptionId: delivery.subscriptionId,
      eventId: delivery.eventId,
      attemptNumber: delivery.attemptNumber + 1,
      status: "pending",
      nextRetryAt: now + args.retryDelayMs,
      createdAt: now,
    });

    await ctx.scheduler.runAfter(
      args.retryDelayMs,
      deliverWebhookRef as any,
      { deliveryId: newDeliveryId }
    );
  },
});

export const replayDelivery = internalMutation({
  args: {
    deliveryId: v.id("automationWebhookDeliveries"),
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) throw new Error("Delivery not found");

    if (delivery.workspaceId !== args.workspaceId) {
      throw new Error("Delivery does not belong to this workspace");
    }

    // Create a new delivery row for the replay
    const now = Date.now();
    const newDeliveryId = await ctx.db.insert("automationWebhookDeliveries", {
      workspaceId: delivery.workspaceId,
      subscriptionId: delivery.subscriptionId,
      eventId: delivery.eventId,
      attemptNumber: 1,
      status: "pending",
      createdAt: now,
    });

    await ctx.scheduler.runAfter(0, deliverWebhookRef as any, {
      deliveryId: newDeliveryId,
    });

    return { success: true, deliveryId: newDeliveryId };
  },
});
