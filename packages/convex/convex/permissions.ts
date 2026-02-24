import { v } from "convex/values";
import { QueryCtx, MutationCtx, internalQuery } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";

// Permission type definitions (task 2.1)
export type Permission =
  // Conversations
  | "conversations.read"
  | "conversations.reply"
  | "conversations.assign"
  | "conversations.close"
  | "conversations.delete"
  // Users & Team
  | "users.read"
  | "users.invite"
  | "users.manage"
  | "users.remove"
  // Content
  | "articles.read"
  | "articles.create"
  | "articles.publish"
  | "articles.delete"
  | "snippets.manage"
  | "tours.manage"
  | "checklists.manage"
  // Settings
  | "settings.workspace"
  | "settings.security"
  | "settings.integrations"
  | "settings.billing"
  // Data
  | "data.export"
  | "data.delete"
  // Audit
  | "audit.read";

export type Role = "owner" | "admin" | "agent" | "viewer";

// Role-to-permission mappings (task 2.1)
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: [
    // All permissions
    "conversations.read",
    "conversations.reply",
    "conversations.assign",
    "conversations.close",
    "conversations.delete",
    "users.read",
    "users.invite",
    "users.manage",
    "users.remove",
    "articles.read",
    "articles.create",
    "articles.publish",
    "articles.delete",
    "snippets.manage",
    "tours.manage",
    "checklists.manage",
    "settings.workspace",
    "settings.security",
    "settings.integrations",
    "settings.billing",
    "data.export",
    "data.delete",
    "audit.read",
  ],
  admin: [
    // All except billing transfer (owner-only)
    "conversations.read",
    "conversations.reply",
    "conversations.assign",
    "conversations.close",
    "conversations.delete",
    "users.read",
    "users.invite",
    "users.manage",
    "users.remove",
    "articles.read",
    "articles.create",
    "articles.publish",
    "articles.delete",
    "snippets.manage",
    "tours.manage",
    "checklists.manage",
    "settings.workspace",
    "settings.security",
    "settings.integrations",
    "data.export",
    "data.delete",
    "audit.read",
  ],
  agent: [
    // Day-to-day support work
    "conversations.read",
    "conversations.reply",
    "conversations.assign",
    "conversations.close",
    "users.read",
    "articles.read",
    "snippets.manage",
    "checklists.manage",
  ],
  viewer: [
    // Read-only access
    "conversations.read",
    "users.read",
    "articles.read",
    "audit.read",
  ],
};

// Get all permissions for a role
export function getPermissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

// Check if a role has a specific permission
export function roleHasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? permissions.includes(permission) : false;
}

// Check if a member has a specific permission (considers custom permissions override)
export function memberHasPermission(
  member: { role: Role; permissions?: string[] | null },
  permission: Permission
): boolean {
  // If custom permissions are set, use those
  if (member.permissions && member.permissions.length > 0) {
    return member.permissions.includes(permission);
  }
  // Otherwise, use role-based permissions
  return roleHasPermission(member.role as Role, permission);
}

// Helper to get workspace membership for a user (task 2.2)
export async function getWorkspaceMembership(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  workspaceId: Id<"workspaces">
): Promise<Doc<"workspaceMembers"> | null> {
  return await ctx.db
    .query("workspaceMembers")
    .withIndex("by_user_workspace", (q) => q.eq("userId", userId).eq("workspaceId", workspaceId))
    .first();
}

// Check if user has permission in a workspace (task 2.2)
export async function hasPermission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  workspaceId: Id<"workspaces">,
  permission: Permission
): Promise<boolean> {
  const membership = await getWorkspaceMembership(ctx, userId, workspaceId);
  if (!membership) {
    return false;
  }
  return memberHasPermission(
    { role: membership.role as Role, permissions: membership.permissions },
    permission
  );
}

// Require permission or throw (task 2.3)
export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  workspaceId: Id<"workspaces">,
  permission: Permission
): Promise<Doc<"workspaceMembers">> {
  const membership = await getWorkspaceMembership(ctx, userId, workspaceId);
  if (!membership) {
    throw new Error("Not a member of this workspace");
  }

  const hasAccess = memberHasPermission(
    { role: membership.role as Role, permissions: membership.permissions },
    permission
  );

  if (!hasAccess) {
    throw new Error(`Permission denied: ${permission}`);
  }

  return membership;
}

// Check if user has any of the specified permissions
export async function hasAnyPermission(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  workspaceId: Id<"workspaces">,
  permissions: Permission[]
): Promise<boolean> {
  const membership = await getWorkspaceMembership(ctx, userId, workspaceId);
  if (!membership) {
    return false;
  }

  return permissions.some((permission) =>
    memberHasPermission(
      { role: membership.role as Role, permissions: membership.permissions },
      permission
    )
  );
}

// Check if user is owner of the workspace
export async function isWorkspaceOwner(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  workspaceId: Id<"workspaces">
): Promise<boolean> {
  const membership = await getWorkspaceMembership(ctx, userId, workspaceId);
  return membership?.role === "owner";
}

// Validator for permission strings (for use in mutation/query args)
export const permissionValidator = v.union(
  v.literal("conversations.read"),
  v.literal("conversations.reply"),
  v.literal("conversations.assign"),
  v.literal("conversations.close"),
  v.literal("conversations.delete"),
  v.literal("users.read"),
  v.literal("users.invite"),
  v.literal("users.manage"),
  v.literal("users.remove"),
  v.literal("articles.read"),
  v.literal("articles.create"),
  v.literal("articles.publish"),
  v.literal("articles.delete"),
  v.literal("snippets.manage"),
  v.literal("tours.manage"),
  v.literal("checklists.manage"),
  v.literal("settings.workspace"),
  v.literal("settings.security"),
  v.literal("settings.integrations"),
  v.literal("settings.billing"),
  v.literal("data.export"),
  v.literal("data.delete"),
  v.literal("audit.read")
);

// Internal helper used by auth wrappers in action context.
export const requirePermissionForAction = internalQuery({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    permission: permissionValidator,
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, args.userId, args.workspaceId, args.permission);
    return { ok: true };
  },
});

// Validator for roles (for use in mutation/query args)
export const roleValidator = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("agent"),
  v.literal("viewer")
);

// Validator for roles that can be assigned (excludes owner)
export const assignableRoleValidator = v.union(
  v.literal("admin"),
  v.literal("agent"),
  v.literal("viewer")
);
