import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { authMutation, authQuery } from "./lib/authWrappers";
import { encryptWebhookSecret } from "./lib/automationWebhookSecrets";

const deliverWebhookRef = makeFunctionReference<
  "action",
  { deliveryId: Id<"automationWebhookDeliveries"> },
  unknown
>("automationWebhookWorker:deliverWebhook");
const replayDeliveryInternalRef = makeFunctionReference<"mutation">(
  "automationWebhookWorker:replayDelivery"
);

type SchedulerArgs = Record<string, unknown>;
type ShallowRunAfter = (
  delayMs: number,
  ref: unknown,
  args: SchedulerArgs
) => Promise<unknown>;

function scheduleAfter(
  scheduler: Pick<MutationCtx["scheduler"], "runAfter">,
  delayMs: number,
  ref: unknown,
  args: SchedulerArgs
) {
  const runAfter = scheduler.runAfter as unknown as ShallowRunAfter;
  return runAfter(delayMs, ref, args);
}

async function queueTestSubscriptionDelivery(
  ctx: Pick<MutationCtx, "db" | "scheduler">,
  args: {
    workspaceId: Id<"workspaces">;
    subscriptionId: Id<"automationWebhookSubscriptions">;
  }
) {
  const sub = await ctx.db.get(args.subscriptionId);
  if (!sub || sub.workspaceId !== args.workspaceId) {
    throw new Error("Subscription not found");
  }

  const now = Date.now();
  const eventId = await ctx.db.insert("automationEvents", {
    workspaceId: args.workspaceId,
    eventType: "test.ping",
    resourceType: "webhook",
    resourceId: String(args.subscriptionId),
    data: {
      test: true,
      subscriptionId: args.subscriptionId,
      timestamp: now,
    },
    timestamp: now,
  });

  const deliveryId = await ctx.db.insert("automationWebhookDeliveries", {
    workspaceId: args.workspaceId,
    subscriptionId: args.subscriptionId,
    eventId,
    attemptNumber: 1,
    status: "pending",
    createdAt: now,
  });

  await scheduleAfter(ctx.scheduler, 0, deliverWebhookRef, {
    deliveryId,
  });

  return { eventId, deliveryId };
}

function generateSigningSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const length = 48;
  let result = "whsec_";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

export const createSubscription = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    url: v.string(),
    eventTypes: v.optional(v.array(v.string())),
    resourceTypes: v.optional(v.array(v.string())),
    channels: v.optional(v.array(v.string())),
    aiWorkflowStates: v.optional(v.array(v.string())),
  },
  permission: "settings.integrations",
  handler: async (ctx, args) => {
    if (!args.url.startsWith("https://")) {
      throw new Error("Webhook URL must use HTTPS");
    }

    const signingSecret = generateSigningSecret();
    const signingSecretPrefix = signingSecret.slice(0, 14); // "whsec_" + 8 chars

    let signingSecretCiphertext: string;
    try {
      signingSecretCiphertext = await encryptWebhookSecret(signingSecret);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown encryption failure";
      throw new Error(`Webhook secret encryption is not configured: ${message}`);
    }

    const now = Date.now();
    const id = await ctx.db.insert("automationWebhookSubscriptions", {
      workspaceId: args.workspaceId,
      url: args.url,
      signingSecretCiphertext,
      signingSecretPrefix,
      eventTypes: args.eventTypes,
      resourceTypes: args.resourceTypes,
      channels: args.channels,
      aiWorkflowStates: args.aiWorkflowStates,
      status: "active",
      createdBy: ctx.user._id,
      createdAt: now,
    });

    // Return the plaintext secret once — it's the only time the caller sees it.
    return { subscriptionId: id, signingSecret };
  },
});

export const listSubscriptions = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  permission: "settings.integrations",
  handler: async (ctx, args) => {
    const subscriptions = await ctx.db
      .query("automationWebhookSubscriptions")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    return subscriptions.map((s) => ({
      _id: s._id,
      url: s.url,
      signingSecretPrefix: s.signingSecretPrefix,
      eventTypes: s.eventTypes,
      resourceTypes: s.resourceTypes,
      channels: s.channels,
      aiWorkflowStates: s.aiWorkflowStates,
      status: s.status,
      createdAt: s.createdAt,
    }));
  },
});

export const updateSubscription = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    subscriptionId: v.id("automationWebhookSubscriptions"),
    url: v.optional(v.string()),
    eventTypes: v.optional(v.array(v.string())),
    resourceTypes: v.optional(v.array(v.string())),
    channels: v.optional(v.array(v.string())),
    aiWorkflowStates: v.optional(v.array(v.string())),
    status: v.optional(
      v.union(v.literal("active"), v.literal("paused"), v.literal("disabled"))
    ),
  },
  permission: "settings.integrations",
  handler: async (ctx, args) => {
    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub || sub.workspaceId !== args.workspaceId) {
      throw new Error("Subscription not found");
    }

    if (args.url !== undefined && !args.url.startsWith("https://")) {
      throw new Error("Webhook URL must use HTTPS");
    }

    const updates: Record<string, unknown> = {};
    if (args.url !== undefined) updates.url = args.url;
    if (args.eventTypes !== undefined) updates.eventTypes = args.eventTypes;
    if (args.resourceTypes !== undefined) updates.resourceTypes = args.resourceTypes;
    if (args.channels !== undefined) updates.channels = args.channels;
    if (args.aiWorkflowStates !== undefined) updates.aiWorkflowStates = args.aiWorkflowStates;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.subscriptionId, updates);
    return { success: true };
  },
});

export const deleteSubscription = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    subscriptionId: v.id("automationWebhookSubscriptions"),
  },
  permission: "settings.integrations",
  handler: async (ctx, args) => {
    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub || sub.workspaceId !== args.workspaceId) {
      throw new Error("Subscription not found");
    }

    await ctx.db.delete(args.subscriptionId);
    return { success: true };
  },
});

export const testSubscription = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    subscriptionId: v.id("automationWebhookSubscriptions"),
  },
  permission: "settings.integrations",
  handler: async (ctx, args) => {
    await queueTestSubscriptionDelivery(ctx, args);
    return { success: true, message: "Test event queued" };
  },
});

export const queueTestSubscriptionDeliveryInternal = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    subscriptionId: v.id("automationWebhookSubscriptions"),
  },
  handler: async (ctx, args) => queueTestSubscriptionDelivery(ctx, args),
});

export const listDeliveries = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    subscriptionId: v.optional(v.id("automationWebhookSubscriptions")),
    status: v.optional(
      v.union(v.literal("pending"), v.literal("success"), v.literal("failed"), v.literal("retrying"))
    ),
    limit: v.optional(v.number()),
  },
  permission: "settings.integrations",
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const hasFilters = args.subscriptionId !== undefined || args.status !== undefined;

    // When no filters, take exactly what we need. When filtering, scan a
    // bounded window (10x limit) so we never pull the entire table into memory.
    const scanCap = hasFilters ? limit * 10 : limit;

    const scanned = await ctx.db
      .query("automationWebhookDeliveries")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(scanCap);

    const filtered = hasFilters
      ? scanned
          .filter((d) => {
            if (args.subscriptionId && d.subscriptionId !== args.subscriptionId) return false;
            if (args.status && d.status !== args.status) return false;
            return true;
          })
          .slice(0, limit)
      : scanned;

    return filtered.map((d) => ({
      _id: d._id,
      subscriptionId: d.subscriptionId,
      eventId: d.eventId,
      attemptNumber: d.attemptNumber,
      status: d.status,
      httpStatus: d.httpStatus,
      error: d.error,
      createdAt: d.createdAt,
    }));
  },
});

export const replayDelivery = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    deliveryId: v.id("automationWebhookDeliveries"),
  },
  permission: "settings.integrations",
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery || delivery.workspaceId !== args.workspaceId) {
      throw new Error("Delivery not found");
    }

    if (delivery.status === "success") {
      throw new Error("Cannot replay a successful delivery");
    }
    if (delivery.status === "pending") {
      throw new Error("Cannot replay a pending delivery");
    }

    await scheduleAfter(ctx.scheduler, 0, replayDeliveryInternalRef, {
      deliveryId: args.deliveryId,
      workspaceId: args.workspaceId,
    });

    return { success: true };
  },
});
