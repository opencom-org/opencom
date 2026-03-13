import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const checkIdempotencyKey = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("automationIdempotencyKeys")
      .withIndex("by_workspace_key", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("key", args.key)
      )
      .first();

    if (!existing) {
      return null;
    }

    if (existing.expiresAt < Date.now()) {
      return null; // Expired
    }

    return {
      resourceType: existing.resourceType,
      resourceId: existing.resourceId,
      responseSnapshot: existing.responseSnapshot,
    };
  },
});

export const storeIdempotencyKey = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    key: v.string(),
    credentialId: v.id("automationCredentials"),
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    responseSnapshot: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("automationIdempotencyKeys", {
      workspaceId: args.workspaceId,
      key: args.key,
      credentialId: args.credentialId,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      responseSnapshot: args.responseSnapshot,
      expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
    });
  },
});

export const cleanupExpiredIdempotencyKeys = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;
    const now = Date.now();

    const expired = await ctx.db
      .query("automationIdempotencyKeys")
      .withIndex("by_expires", (q) => q.lt("expiresAt", now))
      .take(batchSize);

    for (const key of expired) {
      await ctx.db.delete(key._id);
    }

    return { deleted: expired.length };
  },
});
