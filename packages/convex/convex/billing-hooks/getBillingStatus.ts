/**
 * getBillingStatus — billing hook (self-hosted no-op stub)
 *
 * Public Convex query called by the React frontend to determine billing state.
 * The private overlay replaces this file with a real implementation that reads
 * the workspace's subscription record and returns plan/status/feature flags.
 *
 * Self-hosted: always returns billingEnabled: false with plan "unlimited" and all
 * features enabled.
 */
import { query } from "../_generated/server";
import { v } from "convex/values";

export const getBillingStatus = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (_ctx, _args) => {
    return {
      billingEnabled: false,
      plan: "unlimited" as const,
      status: "unlimited" as const,
      trialDaysRemaining: null as number | null,
      features: {
        aiAgent: true,
        emailCampaigns: true,
        series: true,
      },
      isRestricted: false,
    };
  },
});
