import { internalMutation } from "../_generated/server";
import { isBillingEnabled } from "./types";

/**
 * Trial expiry check — transitions expired trialing subscriptions to "expired" status.
 *
 * This runs on a schedule (see crons.ts) to enforce the 7-day free trial limit.
 * Workspaces in "expired" status enter the restricted state: read-only, no content mutations.
 *
 * Self-hosted deployments: billing is disabled, no subscriptions exist, this is a no-op.
 */
export const expireTrials = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (!isBillingEnabled()) {
      // Self-hosted: no billing, nothing to expire
      return { expired: 0 };
    }

    const now = Date.now();

    // Find all subscriptions that are still trialing but have passed their trial end date
    const expiredTrials = await ctx.db
      .query("subscriptions")
      .withIndex("by_status", (q) => q.eq("status", "trialing"))
      .collect();

    let expiredCount = 0;

    for (const subscription of expiredTrials) {
      // Skip if trial end date is not set or hasn't passed yet
      if (!subscription.trialEndsAt || subscription.trialEndsAt > now) {
        continue;
      }

      await ctx.db.patch(subscription._id, {
        status: "expired",
        updatedAt: now,
      });

      expiredCount++;
    }

    return { expired: expiredCount };
  },
});
