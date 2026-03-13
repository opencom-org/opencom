import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { authMutation, authQuery } from "./lib/authWrappers";
import { encryptWebhookSecret } from "./lib/automationWebhookSecrets";

const emitEventRef = makeFunctionReference<"mutation">("automationEvents:emitEvent");

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
    const sub = await ctx.db.get(args.subscriptionId);
    if (!sub || sub.workspaceId !== args.workspaceId) {
      throw new Error("Subscription not found");
    }

    // Emit a test event
    await ctx.scheduler.runAfter(0, emitEventRef as any, {
      workspaceId: args.workspaceId,
      eventType: "test.ping",
      resourceType: "webhook",
      resourceId: args.subscriptionId,
      data: { test: true, timestamp: Date.now() },
    });

    return { success: true, message: "Test event queued" };
  },
});
