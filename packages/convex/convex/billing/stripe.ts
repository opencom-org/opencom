/**
 * Stripe Checkout and Customer Portal session creation.
 *
 * In self-hosted deployments: re-exports stubs that throw "billing not configured".
 * In hosted deployments: this file is REPLACED by the opencom-billing overlay
 * with real Stripe API calls.
 *
 * IMPORTANT: Do not add business logic to this file. It must remain a thin
 * re-export so the overlay can replace it cleanly.
 */
export { createCheckoutSession, createPortalSession } from "./stubs";
