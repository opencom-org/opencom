import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

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
