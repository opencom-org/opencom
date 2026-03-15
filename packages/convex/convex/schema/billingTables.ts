import { defineTable } from "convex/server";
import { v } from "convex/values";

export const billingTables = {
  subscriptions: defineTable({
    workspaceId: v.id("workspaces"),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    plan: v.union(v.literal("starter"), v.literal("pro")),
    status: v.union(
      v.literal("trialing"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("unpaid"),
      v.literal("expired")
    ),
    trialEndsAt: v.optional(v.number()),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    seatLimit: v.number(),
    aiCreditLimitCents: v.number(),
    emailLimit: v.number(),
    // Per-dimension hard caps set by workspace owner (default: undefined = warnings only, PAYG continues)
    hardCaps: v.optional(
      v.object({
        ai: v.optional(v.boolean()),
        emails: v.optional(v.boolean()),
        seats: v.optional(v.boolean()),
      })
    ),
    currency: v.union(v.literal("usd"), v.literal("gbp")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_workspaceId", ["workspaceId"])
    .index("by_status", ["status"]),

  // Usage records track cumulative usage per workspace per dimension per billing period.
  // Compound index supports per-period lookups efficiently.
  usageRecords: defineTable({
    workspaceId: v.id("workspaces"),
    dimension: v.union(v.literal("ai_cost_cents"), v.literal("emails_sent"), v.literal("seats")),
    periodStart: v.number(),
    periodEnd: v.number(),
    value: v.number(),
    lastUpdatedAt: v.number(),
  }).index("by_workspace_dimension_period", ["workspaceId", "dimension", "periodStart"]),

  // Billing warnings track which thresholds have been notified for deduplication.
  // One record per workspace per dimension per threshold per billing period.
  billingWarnings: defineTable({
    workspaceId: v.id("workspaces"),
    dimension: v.union(v.literal("ai_cost_cents"), v.literal("emails_sent"), v.literal("seats")),
    threshold: v.union(v.literal(80), v.literal(100)),
    periodStart: v.number(),
    usageValue: v.number(),
    limit: v.number(),
    sentAt: v.number(),
  }).index("by_workspace_dimension_threshold_period", [
    "workspaceId",
    "dimension",
    "threshold",
    "periodStart",
  ]),
};
