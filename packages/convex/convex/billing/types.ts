import type { Id } from "../_generated/dataModel";

// ============================================================
// Plan types
// ============================================================

export type Plan = "starter" | "pro" | "unlimited";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "expired";

export type UsageDimension = "ai_cost_cents" | "emails_sent" | "seats";

// ============================================================
// Plan limit configuration
// ============================================================

export interface PlanLimits {
  seatLimit: number;
  aiCreditLimitCents: number;
  emailLimit: number;
  /** Whether email campaigns and series are allowed */
  emailCampaigns: boolean;
  /** Whether the AI agent feature is available */
  aiAgent: boolean;
  /** Whether series automation is available */
  series: boolean;
  /** Whether PAYG overages are allowed on seat limit (false = hard block) */
  seatPayg: boolean;
}

export const PLAN_LIMITS: Record<"starter" | "pro", PlanLimits> = {
  starter: {
    seatLimit: 3,
    aiCreditLimitCents: 0,
    emailLimit: 10_000,
    emailCampaigns: false,
    aiAgent: false,
    series: false,
    seatPayg: false,
  },
  pro: {
    seatLimit: 10,
    // $20 credit = 2000 cents
    aiCreditLimitCents: 2_000,
    emailLimit: 10_000,
    emailCampaigns: true,
    aiAgent: true,
    series: true,
    // Seats beyond 10 are PAYG, not blocked
    seatPayg: true,
  },
};

// ============================================================
// Entitlements
// ============================================================

export interface UsageLimitState {
  used: number;
  limit: number;
  /** Whether usage beyond limit triggers PAYG (true) or hard block (false) */
  payg: boolean;
  /** Whether a hard cap is currently enabled by the workspace owner */
  hardCap: boolean;
}

export interface Entitlements {
  plan: Plan;
  status: SubscriptionStatus | "unlimited";
  features: {
    aiAgent: boolean;
    emailCampaigns: boolean;
    series: boolean;
  };
  limits: {
    seats: UsageLimitState;
    aiCredits: UsageLimitState;
    emails: UsageLimitState;
  };
  /** Whether the subscription is in a restricted state (expired/canceled/past_due/unpaid) */
  isRestricted: boolean;
}

// ============================================================
// Unlimited defaults (self-hosted or no subscription)
// ============================================================

export const UNLIMITED_ENTITLEMENTS: Entitlements = {
  plan: "unlimited",
  status: "unlimited",
  features: {
    aiAgent: true,
    emailCampaigns: true,
    series: true,
  },
  limits: {
    seats: { used: 0, limit: Infinity, payg: false, hardCap: false },
    aiCredits: { used: 0, limit: Infinity, payg: false, hardCap: false },
    emails: { used: 0, limit: Infinity, payg: false, hardCap: false },
  },
  isRestricted: false,
};

// ============================================================
// Master billing guard
// ============================================================

/**
 * Returns true when this is a hosted deployment with Stripe configured.
 * All billing-related code paths MUST check this first.
 * Self-hosted deployments never have STRIPE_SECRET_KEY set.
 */
export function isBillingEnabled(): boolean {
  return process.env.STRIPE_SECRET_KEY !== undefined;
}

// ============================================================
// Subscription type (mirrors Convex document)
// ============================================================

export interface SubscriptionRecord {
  _id: Id<"subscriptions">;
  workspaceId: Id<"workspaces">;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  plan: "starter" | "pro";
  status: SubscriptionStatus;
  trialEndsAt?: number;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  seatLimit: number;
  aiCreditLimitCents: number;
  emailLimit: number;
  hardCaps?: {
    ai?: boolean;
    emails?: boolean;
    seats?: boolean;
  };
  currency: "usd" | "gbp";
  createdAt: number;
  updatedAt: number;
}
