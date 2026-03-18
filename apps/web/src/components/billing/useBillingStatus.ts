"use client";

import type { Id } from "@opencom/convex/dataModel";
import { useWebQuery, webQueryRef } from "@/lib/convex/hooks";

// ============================================================
// Types
// ============================================================

export type BillingPlan = "free" | "starter" | "pro" | "unlimited";

export type BillingStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "expired"
  | "unlimited";

export interface BillingStatusResult {
  billingEnabled: boolean;
  plan: BillingPlan;
  status: BillingStatus;
  trialDaysRemaining: number | null;
  features: {
    aiAgent: boolean;
    emailCampaigns: boolean;
    series: boolean;
  };
  isRestricted: boolean;
}

// ============================================================
// Ref
// ============================================================

const BILLING_STATUS_REF = webQueryRef<{ workspaceId: Id<"workspaces"> }, BillingStatusResult>(
  "billingHooks/getBillingStatus:getBillingStatus"
);

// ============================================================
// Hook
// ============================================================

/**
 * Returns billing status for a workspace.
 * Returns undefined while loading, then the billing status.
 *
 * When billing is disabled (self-hosted), returns billingEnabled: false
 * with unlimited plan and all features enabled.
 */
export function useBillingStatus(
  workspaceId: Id<"workspaces"> | undefined
): BillingStatusResult | undefined {
  return useWebQuery(BILLING_STATUS_REF, workspaceId ? { workspaceId } : "skip");
}
