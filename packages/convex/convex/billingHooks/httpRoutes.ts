/**
 * httpRoutes — billing hook (self-hosted no-op stub)
 *
 * Called from http.ts to register billing-specific HTTP routes.
 * The private overlay replaces this file with a real implementation that
 * registers POST /api/stripe/webhook and OPTIONS /api/stripe/webhook.
 *
 * Self-hosted: no-op — no billing routes are registered.
 */
import type { HttpRouter } from "convex/server";

export function registerBillingHttpRoutes(_http: HttpRouter): void {
  // Self-hosted no-op
}
