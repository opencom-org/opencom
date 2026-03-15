import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { isBillingEnabled } from "./types";

// ============================================================
// Warning thresholds
// ============================================================

const WARNING_THRESHOLD_80 = 0.8;
const WARNING_THRESHOLD_100 = 1.0;

export type WarningThreshold = 80 | 100;
export type WarningDimension = "ai_cost_cents" | "emails_sent" | "seats";

// ============================================================
// checkAndEmitUsageWarnings
// ============================================================

/**
 * Checks usage against 80% and 100% thresholds after an increment.
 * Emits notification events to workspace owners for newly crossed thresholds.
 *
 * Deduplication: checks if a warning for this dimension/threshold/period
 * has already been sent before emitting a new one.
 *
 * Call this from incrementUsage after incrementing the counter.
 * Non-fatal: errors are silently swallowed to prevent disruption.
 */
export async function checkAndEmitUsageWarnings(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  dimension: WarningDimension,
  newValue: number,
  periodStart: number
): Promise<void> {
  if (!isBillingEnabled()) {
    return;
  }

  try {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_workspaceId", (q) => q.eq("workspaceId", workspaceId))
      .unique();

    if (!subscription) {
      return;
    }

    // Determine the limit for this dimension
    let limit: number;
    if (dimension === "ai_cost_cents") {
      limit = subscription.aiCreditLimitCents;
    } else if (dimension === "emails_sent") {
      limit = subscription.emailLimit;
    } else {
      limit = subscription.seatLimit;
    }

    // No warnings for zero limits (e.g., starter has 0 AI credits — already blocked)
    if (limit <= 0) {
      return;
    }

    const ratio = newValue / limit;

    // Determine which threshold was newly crossed
    let crossedThreshold: WarningThreshold | null = null;
    if (ratio >= WARNING_THRESHOLD_100) {
      crossedThreshold = 100;
    } else if (ratio >= WARNING_THRESHOLD_80) {
      crossedThreshold = 80;
    }

    if (!crossedThreshold) {
      return;
    }

    // Check deduplication: has this warning already been sent for this period?
    const existing = await ctx.db
      .query("billingWarnings")
      .withIndex("by_workspace_dimension_threshold_period", (q) =>
        q
          .eq("workspaceId", workspaceId)
          .eq("dimension", dimension)
          .eq("threshold", crossedThreshold)
          .eq("periodStart", periodStart)
      )
      .unique();

    if (existing) {
      // Already warned for this threshold in this period
      return;
    }

    // Record the warning and emit a notification
    await ctx.db.insert("billingWarnings", {
      workspaceId,
      dimension,
      threshold: crossedThreshold,
      periodStart,
      usageValue: newValue,
      limit,
      sentAt: Date.now(),
    });

    // NOTE: Notification delivery to workspace owner is done via in-app notification
    // system. In V1 this is a record-only approach (stored in billingWarnings table).
    // The billing settings UI displays active warnings by querying this table.
    // Future: send email notifications to workspace owner via Resend.
  } catch (err) {
    // Non-fatal: warning failures must never block usage tracking
    console.warn("Billing usage warning check failed:", err);
  }
}

// ============================================================
// getActiveWarnings — returns current period warnings for display
// ============================================================

/**
 * Returns active billing warnings for a workspace in the current period.
 * Used by the billing settings UI to show warning indicators.
 */
export async function getActiveWarnings(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  periodStart: number
): Promise<
  Array<{
    dimension: WarningDimension;
    threshold: WarningThreshold;
    usageValue: number;
    limit: number;
    sentAt: number;
  }>
> {
  const warnings = await ctx.db
    .query("billingWarnings")
    .withIndex("by_workspace_dimension_threshold_period", (q) => q.eq("workspaceId", workspaceId))
    .filter((q) => q.eq(q.field("periodStart"), periodStart))
    .collect();

  return warnings.map((w) => ({
    dimension: w.dimension as WarningDimension,
    threshold: w.threshold as WarningThreshold,
    usageValue: w.usageValue,
    limit: w.limit,
    sentAt: w.sentAt,
  }));
}
