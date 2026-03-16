/**
 * onMemberChanged — billing hook (self-hosted no-op stub)
 *
 * Called from workspaceMembers.ts when members are added or removed.
 * The private overlay replaces this file with real implementations that
 * enforce seat limits and track seat count toward billing limits.
 *
 * Self-hosted: all no-ops — no seat limits.
 */
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function checkSeatAllowed(
  _ctx: MutationCtx,
  _workspaceId: Id<"workspaces">
): Promise<void> {
  // Self-hosted no-op
}

export async function syncSeatCount(
  _ctx: MutationCtx,
  _workspaceId: Id<"workspaces">
): Promise<void> {
  // Self-hosted no-op
}
