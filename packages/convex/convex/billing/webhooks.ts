/**
 * Stripe webhook handler entry point.
 *
 * In self-hosted deployments: re-exports the no-op stub from stubs.ts.
 * In hosted deployments: this file is REPLACED by the opencom-billing overlay
 * with a full Stripe webhook verification and event processing implementation.
 *
 * IMPORTANT: Do not add business logic to this file. It must remain a thin
 * re-export so the overlay can replace it cleanly.
 */
export { handleStripeWebhook } from "./stubs";
