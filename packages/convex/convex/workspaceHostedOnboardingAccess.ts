import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getAuthenticatedUserFromSession } from "./auth";
import { getWorkspaceMembership } from "./permissions";

export async function getHostedOnboardingWorkspaceForMember(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">
): Promise<Doc<"workspaces"> | null> {
  const user = await getAuthenticatedUserFromSession(ctx);
  if (!user) {
    return null;
  }

  const membership = await getWorkspaceMembership(ctx, user._id, workspaceId);
  if (!membership) {
    return null;
  }

  return (await ctx.db.get(workspaceId)) as Doc<"workspaces"> | null;
}

export async function requireHostedOnboardingWorkspace(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">
): Promise<Doc<"workspaces">> {
  const workspace = await ctx.db.get(workspaceId);
  if (!workspace) {
    throw new Error("Workspace not found");
  }

  return workspace;
}
