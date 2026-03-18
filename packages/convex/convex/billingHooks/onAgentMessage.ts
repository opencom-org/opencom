/**
 * onAgentMessage — billing hook (self-hosted no-op stub)
 *
 * Called from messages.ts before an agent sends a message.
 * The private overlay replaces this file with a real implementation that
 * throws if the workspace subscription is expired/canceled/unpaid/past_due.
 *
 * Self-hosted: no-op — agents can always send messages.
 */
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function requireWorkspaceActive(
  _ctx: MutationCtx,
  _workspaceId: Id<"workspaces">
): Promise<void> {
  // Self-hosted no-op
}
