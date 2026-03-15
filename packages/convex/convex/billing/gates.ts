import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  isBillingEnabled,
  UNLIMITED_ENTITLEMENTS,
  PLAN_LIMITS,
  type Entitlements,
  type SubscriptionStatus,
} from "./types";

// ============================================================
// Internal helpers
// ============================================================

/**
 * Fetches the subscription record for a workspace.
 * Returns null if no subscription exists (self-hosted).
 */
async function getSubscription(ctx: QueryCtx, workspaceId: Id<"workspaces">) {
  return await ctx.db
    .query("subscriptions")
    .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
    .unique();
}

/**
 * Fetches usage records for the current billing period.
 * Returns a map of dimension → current value.
 */
async function getCurrentUsage(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  periodStart: number
): Promise<Record<string, number>> {
  const records = await ctx.db
    .query("usageRecords")
    .withIndex("by_workspace_dimension_period", (q) =>
      q
        .eq("workspaceId", workspaceId)
        .eq("dimension", "ai_cost_cents")
        .eq("periodStart", periodStart)
    )
    .collect();

  // Also query emails_sent and seats for the same period
  const emailRecords = await ctx.db
    .query("usageRecords")
    .withIndex("by_workspace_dimension_period", (q) =>
      q.eq("workspaceId", workspaceId).eq("dimension", "emails_sent").eq("periodStart", periodStart)
    )
    .collect();

  const seatRecords = await ctx.db
    .query("usageRecords")
    .withIndex("by_workspace_dimension_period", (q) =>
      q.eq("workspaceId", workspaceId).eq("dimension", "seats").eq("periodStart", periodStart)
    )
    .collect();

  return {
    ai_cost_cents: records[0]?.value ?? 0,
    emails_sent: emailRecords[0]?.value ?? 0,
    seats: seatRecords[0]?.value ?? 0,
  };
}

// ============================================================
// _getWorkspaceSubscription — internal query for action use
// Returns minimal subscription info needed for AI Gateway billing headers.
// ============================================================

export const _getWorkspaceSubscription = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const subscription = await getSubscription(ctx, args.workspaceId);
    if (!subscription) return null;
    return {
      stripeCustomerId: subscription.stripeCustomerId,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      status: subscription.status,
      plan: subscription.plan,
    };
  },
});

// ============================================================
// getEntitlements — internal query for backend use
// ============================================================

export const getEntitlements = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args): Promise<Entitlements> => {
    // Self-hosted: no billing, return unlimited
    if (!isBillingEnabled()) {
      return UNLIMITED_ENTITLEMENTS;
    }

    const subscription = await getSubscription(ctx, args.workspaceId);

    // No subscription record (e.g. self-hosted or pre-billing workspace)
    if (!subscription) {
      return UNLIMITED_ENTITLEMENTS;
    }

    const planLimits = PLAN_LIMITS[subscription.plan];
    const usage = await getCurrentUsage(ctx, args.workspaceId, subscription.currentPeriodStart);

    const status = subscription.status as SubscriptionStatus;
    const isRestricted =
      status === "expired" || status === "canceled" || status === "past_due" || status === "unpaid";

    // Hard cap states from subscription
    const hardCaps = subscription.hardCaps ?? {};

    // AI agent enabled: plan supports it AND (no hard cap OR usage under limit)
    const aiHardCapHit =
      hardCaps.ai === true && usage.ai_cost_cents >= subscription.aiCreditLimitCents;
    const aiAgentEnabled = planLimits.aiAgent && !aiHardCapHit && !isRestricted;

    // Email campaigns/series: plan supports it AND not restricted
    const emailCampaignsEnabled = planLimits.emailCampaigns && !isRestricted;
    const seriesEnabled = planLimits.series && !isRestricted;

    return {
      plan: subscription.plan,
      status,
      features: {
        aiAgent: aiAgentEnabled,
        emailCampaigns: emailCampaignsEnabled,
        series: seriesEnabled,
      },
      limits: {
        seats: {
          used: usage.seats,
          limit: subscription.seatLimit,
          payg: planLimits.seatPayg,
          hardCap: hardCaps.seats === true,
        },
        aiCredits: {
          used: usage.ai_cost_cents,
          limit: subscription.aiCreditLimitCents,
          payg: subscription.plan === "pro",
          hardCap: hardCaps.ai === true,
        },
        emails: {
          used: usage.emails_sent,
          limit: subscription.emailLimit,
          payg: subscription.plan === "pro",
          hardCap: hardCaps.emails === true,
        },
      },
      isRestricted,
    };
  },
});

// ============================================================
// getBillingStatus — public query for React frontend
// Returns only safe, non-sensitive billing information.
// ============================================================

export const getBillingStatus = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const billingEnabled = isBillingEnabled();

    if (!billingEnabled) {
      return {
        billingEnabled: false,
        plan: "unlimited" as const,
        status: "unlimited" as const,
        trialDaysRemaining: null,
        features: {
          aiAgent: true,
          emailCampaigns: true,
          series: true,
        },
        isRestricted: false,
      };
    }

    const subscription = await getSubscription(ctx, args.workspaceId);

    if (!subscription) {
      return {
        billingEnabled: true,
        plan: "unlimited" as const,
        status: "unlimited" as const,
        trialDaysRemaining: null,
        features: {
          aiAgent: true,
          emailCampaigns: true,
          series: true,
        },
        isRestricted: false,
      };
    }

    const planLimits = PLAN_LIMITS[subscription.plan];
    const status = subscription.status as SubscriptionStatus;
    const isRestricted =
      status === "expired" || status === "canceled" || status === "past_due" || status === "unpaid";

    // Calculate trial days remaining (only relevant when trialing)
    let trialDaysRemaining: number | null = null;
    if (status === "trialing" && subscription.trialEndsAt) {
      const msRemaining = subscription.trialEndsAt - Date.now();
      trialDaysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
    }

    const hardCaps = subscription.hardCaps ?? {};
    const usage = await getCurrentUsage(ctx, args.workspaceId, subscription.currentPeriodStart);

    const aiHardCapHit =
      hardCaps.ai === true && usage.ai_cost_cents >= subscription.aiCreditLimitCents;
    const aiAgentEnabled = planLimits.aiAgent && !aiHardCapHit && !isRestricted;

    return {
      billingEnabled: true,
      plan: subscription.plan,
      status,
      trialDaysRemaining,
      features: {
        aiAgent: aiAgentEnabled,
        emailCampaigns: planLimits.emailCampaigns && !isRestricted,
        series: planLimits.series && !isRestricted,
      },
      isRestricted,
    };
  },
});

// ============================================================
// checkEmailHardCap — throws if email hard cap is enabled and limit reached
// ============================================================

/**
 * Checks whether the email hard cap is enabled and the limit has been reached.
 * Throws a descriptive error if email sends should be blocked.
 *
 * NOTE: Only blocks when `hardCaps.emails === true` AND usage >= limit.
 * Without a hard cap, emails continue PAYG without blocking.
 */
export async function checkEmailHardCap(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">
): Promise<void> {
  if (!isBillingEnabled()) {
    return;
  }

  const subscription = await getSubscription(ctx, workspaceId);
  if (!subscription) {
    return;
  }

  // Only enforce hard cap if explicitly enabled
  if (subscription.hardCaps?.emails !== true) {
    return;
  }

  const usage = await getCurrentUsage(ctx, workspaceId, subscription.currentPeriodStart);

  if (usage.emails_sent >= subscription.emailLimit) {
    throw new Error(
      `Your workspace has reached the email limit of ${subscription.emailLimit.toLocaleString()} for this billing period ` +
        "and the email hard cap is enabled. To continue sending emails, disable the hard cap in billing settings (PAYG charges apply)."
    );
  }
}

// ============================================================
// requireActiveSubscription — helper for mutations/actions
// ============================================================

/**
 * Throws a descriptive error if the workspace is in a restricted billing state.
 * Use this in content-modifying mutations to enforce the restricted state.
 *
 * NOTE: Self-hosted and trial workspaces are NOT restricted.
 */
export async function requireActiveSubscription(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">
): Promise<void> {
  if (!isBillingEnabled()) {
    // Self-hosted — always unrestricted
    return;
  }

  const subscription = await getSubscription(ctx, workspaceId);

  if (!subscription) {
    // No subscription record — treat as unlimited (self-hosted or pre-billing)
    return;
  }

  const status = subscription.status as SubscriptionStatus;

  if (status === "expired") {
    throw new Error(
      "Your free trial has ended. Please choose a plan to continue using Opencom. " +
        "Your data is safe and you can export it at any time."
    );
  }

  if (status === "canceled") {
    throw new Error(
      "Your subscription has been canceled. Please reactivate your subscription to continue. " +
        "Your data is safe and you can export it at any time."
    );
  }

  if (status === "past_due") {
    throw new Error(
      "Your subscription payment has failed. Please update your payment method to continue. " +
        "Your data is safe and you can export it at any time."
    );
  }

  if (status === "unpaid") {
    throw new Error(
      "Your subscription is unpaid. Please update your payment method to continue. " +
        "Your data is safe and you can export it at any time."
    );
  }
}
