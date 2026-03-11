import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getAuthenticatedUserFromSession } from "./auth";
import { hasPermission, requirePermission } from "./permissions";

export async function canReadWorkspaceSettings(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">
): Promise<boolean> {
  const user = await getAuthenticatedUserFromSession(ctx);
  if (!user) {
    return false;
  }
  return await hasPermission(ctx, user._id, workspaceId, "settings.workspace");
}

export async function requireWorkspaceSettingsPermission(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">
): Promise<void> {
  const user = await getAuthenticatedUserFromSession(ctx);
  if (!user) {
    throw new Error("Not authenticated");
  }
  await requirePermission(ctx, user._id, workspaceId, "settings.workspace");
}

export async function getMessengerSettingsRecord(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">
): Promise<Doc<"messengerSettings"> | null> {
  return await ctx.db
    .query("messengerSettings")
    .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
    .first();
}

export async function ensureWorkspaceExists(ctx: MutationCtx, workspaceId: Id<"workspaces">) {
  const workspace = await ctx.db.get(workspaceId);
  if (!workspace) {
    throw new Error("Workspace not found");
  }
}

export async function resolveMessengerLogoUrl(
  ctx: QueryCtx | MutationCtx,
  settings: Pick<Doc<"messengerSettings">, "logo" | "logoStorageId"> | null
): Promise<string | null> {
  if (!settings) {
    return null;
  }

  if (settings.logoStorageId) {
    return (await ctx.storage.getUrl(settings.logoStorageId)) ?? null;
  }

  return settings.logo ?? null;
}
