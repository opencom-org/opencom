import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx, internalMutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

// Re-export Convex Auth functions so they're available as api.auth.signIn, api.auth.signOut
export { signIn, signOut, store, isAuthenticated } from "./authConvex";

// Admin mutation to fix user email (run from Convex dashboard)
export const fixUserEmail = internalMutation({
  args: {
    userId: v.id("users"),
    newEmail: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { email: args.newEmail });
    return { success: true };
  },
});

function getEmailDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

// Helper function for domain validation (used for workspace join validation)
export function isEmailDomainAllowed(email: string, allowedDomains: string[]): boolean {
  const domain = getEmailDomain(email);
  return allowedDomains.some(
    (allowed) => domain === allowed.toLowerCase() || domain.endsWith(`.${allowed.toLowerCase()}`)
  );
}

// Get authenticated user from Convex Auth session
export async function getAuthenticatedUserFromSession(ctx: QueryCtx | MutationCtx): Promise<{
  _id: Id<"users">;
  email: string;
  name?: string;
  workspaceId: Id<"workspaces">;
  role: "admin" | "agent";
} | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    return null;
  }

  const user = await ctx.db.get(userId);
  if (!user || !user.email || !user.workspaceId || !user.role) {
    return null;
  }

  return {
    _id: user._id,
    email: user.email,
    name: user.name,
    workspaceId: user.workspaceId,
    role: user.role,
  };
}

// Query to get current user from Convex Auth session (for frontend use)
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    // Get user's workspaces
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const workspaces = await Promise.all(
      memberships.map(async (m) => {
        const workspace = (await ctx.db.get(m.workspaceId)) as Doc<"workspaces"> | null;
        return workspace ? { ...workspace, role: m.role } : null;
      })
    );

    return {
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        workspaceId: user.workspaceId,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
      workspaces: workspaces.filter((w) => w !== null),
    };
  },
});

// Switch workspace for authenticated user
export const switchWorkspace = mutation({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", args.workspaceId)
      )
      .first();

    if (!membership) {
      throw new Error("You are not a member of this workspace");
    }

    await ctx.db.patch(user._id, { workspaceId: args.workspaceId });

    return {
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        workspaceId: args.workspaceId,
        role: membership.role,
        avatarUrl: user.avatarUrl,
      },
    };
  },
});

export const completeSignupProfile = mutation({
  args: {
    name: v.optional(v.string()),
    workspaceName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);
    if (!user || !user.email || !user.workspaceId) {
      throw new Error("User not found");
    }
    const workspaceId = user.workspaceId as Id<"workspaces">;

    const trimmedName = args.name?.trim();
    const trimmedWorkspaceName = args.workspaceName?.trim();
    let userNameUpdated = false;
    let workspaceNameUpdated = false;

    if (trimmedName && !user.name) {
      await ctx.db.patch(user._id, { name: trimmedName });
      userNameUpdated = true;
    }

    if (trimmedWorkspaceName && trimmedWorkspaceName.length > 0) {
      const membership = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_user_workspace", (q) =>
          q.eq("userId", user._id).eq("workspaceId", workspaceId)
        )
        .first();

      const canRenameWorkspace = membership?.role === "owner" || membership?.role === "admin";
      if (canRenameWorkspace) {
        const workspace = (await ctx.db.get(workspaceId)) as Doc<"workspaces"> | null;
        if (workspace) {
          const emailPrefix = user.email.split("@")[0];
          const fallbackName = user.name?.trim() || trimmedName;
          const defaultWorkspaceNames = new Set(
            [
              `${emailPrefix}'s Workspace`,
              fallbackName ? `${fallbackName}'s Workspace` : "",
            ].filter((candidate) => candidate.length > 0)
          );
          const currentName = workspace.name.trim();
          const isDefaultWorkspaceName =
            currentName.length === 0 || defaultWorkspaceNames.has(currentName);

          if (isDefaultWorkspaceName && currentName !== trimmedWorkspaceName) {
            await ctx.db.patch(workspace._id, { name: trimmedWorkspaceName });
            workspaceNameUpdated = true;
          }
        }
      }
    }

    return { success: true, userNameUpdated, workspaceNameUpdated };
  },
});

// Get workspaces for authenticated user
export const getUserWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const workspaces = await Promise.all(
      memberships.map(async (m) => {
        const workspace = await ctx.db.get(m.workspaceId);
        return workspace ? { ...workspace, role: m.role } : null;
      })
    );

    return workspaces.filter((w) => w !== null);
  },
});
