"use client";

/**
 * Billing action hooks for the web app.
 *
 * These refs call the Convex billing actions (from the overlay in hosted mode,
 * or the stubs which throw "billing not configured" in self-hosted mode).
 *
 * IMPORTANT: Only use these hooks when billingEnabled === true.
 */
import type { Id } from "@opencom/convex/dataModel";
import {
  useWebAction,
  useWebMutation,
  useWebQuery,
  webActionRef,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";

// ============================================================
// Checkout session action
// ============================================================

type CreateCheckoutSessionArgs = {
  workspaceId: Id<"workspaces">;
  plan: "starter" | "pro";
  currency: "usd" | "gbp";
  successUrl: string;
  cancelUrl: string;
};

const CREATE_CHECKOUT_SESSION_REF = webActionRef<CreateCheckoutSessionArgs, { url: string }>(
  "billing/stripe:createCheckoutSession"
);

export function useCreateCheckoutSession() {
  return useWebAction(CREATE_CHECKOUT_SESSION_REF);
}

// ============================================================
// Customer Portal session action
// ============================================================

type CreatePortalSessionArgs = {
  workspaceId: Id<"workspaces">;
  returnUrl: string;
};

const CREATE_PORTAL_SESSION_REF = webActionRef<CreatePortalSessionArgs, { url: string }>(
  "billing/stripe:createPortalSession"
);

export function useCreatePortalSession() {
  return useWebAction(CREATE_PORTAL_SESSION_REF);
}

// ============================================================
// Update hard caps mutation
// ============================================================

type UpdateHardCapsArgs = {
  workspaceId: Id<"workspaces">;
  hardCaps: {
    ai?: boolean;
    emails?: boolean;
    seats?: boolean;
  };
};

const UPDATE_HARD_CAPS_REF = webMutationRef<UpdateHardCapsArgs, null>(
  "billing/settings:updateHardCaps"
);

// ============================================================
// Get full subscription details query
// ============================================================

type GetSubscriptionDetailsArgs = {
  workspaceId: Id<"workspaces">;
};

export type SubscriptionDetails = {
  plan: "starter" | "pro";
  status: string;
  currency: "usd" | "gbp";
  trialEndsAt?: number;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
  seatLimit: number;
  aiCreditLimitCents: number;
  emailLimit: number;
  hardCaps: { ai?: boolean; emails?: boolean; seats?: boolean };
  usage: { ai_cost_cents: number; emails_sent: number; seats: number };
};

const GET_SUBSCRIPTION_DETAILS_REF = webQueryRef<
  GetSubscriptionDetailsArgs,
  SubscriptionDetails | null
>("billing/settings:getSubscriptionDetails");

export function useSubscriptionDetails(workspaceId: Id<"workspaces"> | undefined) {
  return useWebQuery(GET_SUBSCRIPTION_DETAILS_REF, workspaceId ? { workspaceId } : "skip");
}

export function useUpdateHardCaps() {
  return useWebMutation(UPDATE_HARD_CAPS_REF);
}
