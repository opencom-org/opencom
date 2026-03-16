/**
 * onEmailSent — billing hook (self-hosted no-op stub)
 *
 * Called from emailCampaigns.ts, emailChannel.ts, and series/runtimeExecution.ts.
 * The private overlay replaces this file with real implementations that enforce
 * hard caps and track usage toward billing limits.
 *
 * Self-hosted: all no-ops.
 */
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function checkEmailAllowed(
  _ctx: MutationCtx,
  _workspaceId: Id<"workspaces">
): Promise<void> {
  // Self-hosted no-op
}

export async function trackEmailSent(
  _ctx: MutationCtx,
  _workspaceId: Id<"workspaces">,
  _count: number
): Promise<void> {
  // Self-hosted no-op
}

export async function requireFeatureAccess(
  _ctx: MutationCtx,
  _workspaceId: Id<"workspaces">,
  _feature: "emailCampaigns" | "series"
): Promise<void> {
  // Self-hosted no-op
}
