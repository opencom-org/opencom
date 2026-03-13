import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { authMutation, authQuery } from "./lib/authWrappers";

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

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const createSubscription = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    url: v.string(),
    eventTypes: v.optional(v.array(v.string())),
  },
  permission: "settings.integrations",
  handler: async (ctx, args) => {
    const signingSecret = generateSigningSecret();
    const signingSecretHash = await sha256Hex(signingSecret);
    const signingSecretPrefix = signingSecret.slice(0, 14); // "whsec_" + 8 chars

    const now = Date.now();
    const id = await ctx.db.insert("automationWebhookSubscriptions", {
      workspaceId: args.workspaceId,
      url: args.url,
      signingSecretHash,
      signingSecretPrefix,
      eventTypes: args.eventTypes,
      status: "active",
      createdBy: ctx.user._id,
      createdAt: now,
    });

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
