/**
 * onWorkspaceCreated — billing hook (self-hosted no-op stub)
 *
 * Called from authConvex.ts after a new workspace and its first member are created.
 * The private overlay replaces this file with a real implementation that creates a
 * Pro trial subscription and initialises usage records.
 *
 * Self-hosted: no-op — no subscription record is created.
 */
import type { Id } from "../_generated/dataModel";
import type { DatabaseWriter } from "../_generated/server";

export async function onWorkspaceCreated(
  _db: DatabaseWriter,
  _workspaceId: Id<"workspaces">,
  _now: number
): Promise<void> {
  // Self-hosted no-op
}
