import type { ActionCtx } from "../_generated/server";

/**
 * Stub billing functions used when billing is not configured (self-hosted).
 * The private `opencom-billing` overlay replaces webhooks.ts, stripe.ts, and
 * usageReporter.ts with real implementations at deploy time for the hosted service.
 *
 * All stubs have the same signatures as the real implementations.
 */

// ============================================================
// Webhook handler stub
// Returns 200 OK with no processing. The overlay replaces this
// with real Stripe event handling.
// ============================================================

export async function handleStripeWebhook(_ctx: ActionCtx, _request: Request): Promise<Response> {
  return new Response("OK", { status: 200 });
}

// ============================================================
// Checkout session stub
// Throws a descriptive error since Stripe is not configured.
// ============================================================

export async function createCheckoutSession(
  _ctx: ActionCtx,
  _args: {
    workspaceId: string;
    plan: "starter" | "pro";
    currency: "usd" | "gbp";
    successUrl: string;
    cancelUrl: string;
  }
): Promise<{ url: string }> {
  throw new Error(
    "Billing is not configured. To enable billing, deploy with Stripe credentials. " +
      "Self-hosted users can use all features without a subscription."
  );
}

// ============================================================
// Customer Portal session stub
// ============================================================

export async function createPortalSession(
  _ctx: ActionCtx,
  _args: {
    workspaceId: string;
    returnUrl: string;
  }
): Promise<{ url: string }> {
  throw new Error(
    "Billing is not configured. To enable billing, deploy with Stripe credentials. " +
      "Self-hosted users can use all features without a subscription."
  );
}

// ============================================================
// Usage reporter stub — no-op when billing is not configured
// ============================================================

export async function reportUsageToStripe(_ctx: ActionCtx): Promise<void> {
  // No-op in self-hosted mode. The overlay replaces this with real Stripe
  // metered usage reporting for email and seat overages.
}
