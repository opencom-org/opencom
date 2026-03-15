import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isBillingEnabled } from "./types";
import { checkAndEmitUsageWarnings } from "./warnings";

// ============================================================
// incrementUsage — atomically increments a usage record
// ============================================================

/**
 * Atomically increments a usage counter for a workspace dimension in the current period.
 * Creates the record if it doesn't exist (lazy initialization).
 *
 * NOTE: This is an internal mutation called from content-modifying mutations.
 * Self-hosted deployments (isBillingEnabled() === false) skip tracking silently.
 */
export const incrementUsage = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    dimension: v.union(v.literal("ai_cost_cents"), v.literal("emails_sent"), v.literal("seats")),
    amount: v.number(),
    periodStart: v.number(),
    periodEnd: v.number(),
  },
  handler: async (ctx, args) => {
    if (!isBillingEnabled()) {
      // Self-hosted: skip usage tracking entirely
      return;
    }

    const existing = await ctx.db
      .query("usageRecords")
      .withIndex("by_workspace_dimension_period", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("dimension", args.dimension)
          .eq("periodStart", args.periodStart)
      )
      .unique();

    let newValue: number;

    if (existing) {
      newValue = existing.value + args.amount;
      await ctx.db.patch(existing._id, {
        value: newValue,
        lastUpdatedAt: Date.now(),
      });
    } else {
      newValue = args.amount;
      await ctx.db.insert("usageRecords", {
        workspaceId: args.workspaceId,
        dimension: args.dimension,
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
        value: newValue,
        lastUpdatedAt: Date.now(),
      });
    }

    // Task 18.2: Check usage thresholds and emit warnings after incrementing
    await checkAndEmitUsageWarnings(
      ctx,
      args.workspaceId,
      args.dimension,
      newValue,
      args.periodStart
    );
  },
});

// ============================================================
// getUsageForPeriod — returns all dimension usage for a period
// ============================================================

/**
 * Returns current period usage across all dimensions for a workspace.
 * Used by gates.ts for entitlement checks and by the billing UI.
 */
export const getUsageForPeriod = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    periodStart: v.number(),
  },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("usageRecords")
      .withIndex("by_workspace_dimension_period", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("dimension", "ai_cost_cents")
          .eq("periodStart", args.periodStart)
      )
      .collect();

    const emailRecords = await ctx.db
      .query("usageRecords")
      .withIndex("by_workspace_dimension_period", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("dimension", "emails_sent")
          .eq("periodStart", args.periodStart)
      )
      .collect();

    const seatRecords = await ctx.db
      .query("usageRecords")
      .withIndex("by_workspace_dimension_period", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("dimension", "seats")
          .eq("periodStart", args.periodStart)
      )
      .collect();

    return {
      ai_cost_cents: records[0]?.value ?? 0,
      emails_sent: emailRecords[0]?.value ?? 0,
      seats: seatRecords[0]?.value ?? 0,
    };
  },
});

// ============================================================
// Helper: get current period start/end from a subscription
// ============================================================

/**
 * Resolves the current period start/end from a workspace's subscription.
 * Returns null if billing is disabled or no subscription exists.
 */
export async function getCurrentPeriodBounds(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">
): Promise<{ periodStart: number; periodEnd: number } | null> {
  if (!isBillingEnabled()) {
    return null;
  }

  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
    .unique();

  if (!subscription) {
    return null;
  }

  return {
    periodStart: subscription.currentPeriodStart,
    periodEnd: subscription.currentPeriodEnd,
  };
}

// ============================================================
// Helper: set absolute seat count (used on member add/remove)
// ============================================================

/**
 * Sets the seats usage record to the current absolute count of workspace members.
 * Used when members are added or removed (all roles count equally).
 */
export async function syncSeatCount(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">
): Promise<void> {
  if (!isBillingEnabled()) {
    return;
  }

  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
    .unique();

  if (!subscription) {
    return;
  }

  // Count all active members regardless of role
  const members = await ctx.db
    .query("workspaceMembers")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .collect();

  const seatCount = members.length;

  const existing = await ctx.db
    .query("usageRecords")
    .withIndex("by_workspace_dimension_period", (q) =>
      q
        .eq("workspaceId", workspaceId)
        .eq("dimension", "seats")
        .eq("periodStart", subscription.currentPeriodStart)
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      value: seatCount,
      lastUpdatedAt: Date.now(),
    });
  } else {
    await ctx.db.insert("usageRecords", {
      workspaceId,
      dimension: "seats",
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      value: seatCount,
      lastUpdatedAt: Date.now(),
    });
  }
}
