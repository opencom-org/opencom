import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { encryptWebhookSecret } from "../lib/automationWebhookSecrets";

export const migrate = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;
    const subscriptions = await ctx.db
      .query("automationWebhookSubscriptions")
      .collect();

    const legacySubscriptions = subscriptions.filter(
      (subscription) =>
        !!subscription.signingSecret && !subscription.signingSecretCiphertext
    );
    const batch = legacySubscriptions.slice(0, batchSize);

    for (const subscription of batch) {
      const signingSecretCiphertext = await encryptWebhookSecret(
        subscription.signingSecret!
      );
      await ctx.db.patch(subscription._id, {
        signingSecret: undefined,
        signingSecretCiphertext,
      } as any);
    }

    const remaining = legacySubscriptions.length - batch.length;
    return {
      status: remaining > 0 ? "in_progress" : "complete",
      processed: batch.length,
      remaining,
    };
  },
});

export const verifyMigration = internalMutation({
  args: {},
  handler: async (ctx) => {
    const subscriptions = await ctx.db
      .query("automationWebhookSubscriptions")
      .collect();

    const legacyPlaintextCount = subscriptions.filter(
      (subscription) =>
        !!subscription.signingSecret && !subscription.signingSecretCiphertext
    ).length;

    return {
      totalSubscriptions: subscriptions.length,
      legacyPlaintextCount,
      migrationComplete: legacyPlaintextCount === 0,
    };
  },
});
