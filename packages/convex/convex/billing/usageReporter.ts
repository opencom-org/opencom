/**
 * Stripe metered usage reporter for email and seat overages.
 *
 * In self-hosted deployments: re-exports the no-op stub from stubs.ts.
 * In hosted deployments: this file is REPLACED by the opencom-billing overlay
 * with a real implementation that reports overage to Stripe's metered billing API.
 *
 * NOTE: AI usage reporting is handled automatically by the Vercel AI Gateway via
 * Stripe billing headers — no manual reporting is needed for AI credits.
 *
 * IMPORTANT: Do not add business logic to this file. It must remain a thin
 * re-export so the overlay can replace it cleanly.
 */
export { reportUsageToStripe } from "./stubs";
