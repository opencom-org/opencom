import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthenticatedUserFromSession } from "./auth";
import { sendEmail, emailTemplates } from "./email";
import { authAction } from "./lib/authWrappers";
import {
  hasPermission,
  requirePermission,
  isWorkspaceOwner,
  assignableRoleValidator,
  getPermissionsForRole,
  Role,
} from "./permissions";
import { logAudit } from "./auditLogs";

export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return [];
    }

    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
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

export const listByWorkspace = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return [];
    }

    // Check if user has permission to read team members
    const canReadUsers = await hasPermission(ctx, user._id, args.workspaceId, "users.read");

    if (!canReadUsers) {
      return [];
    }

    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const members = await Promise.all(
      memberships.map(async (m) => {
        const memberUser = await ctx.db.get(m.userId);
        return memberUser
          ? {
              _id: m._id,
              userId: m.userId,
              email: memberUser.email,
              name: memberUser.name,
              role: m.role,
              permissions: m.permissions,
              createdAt: m.createdAt,
            }
          : null;
      })
    );

    return members.filter((m) => m !== null);
  },
});

export const add = mutation({
  args: {
    userId: v.id("users"),
    workspaceId: v.id("workspaces"),
    role: assignableRoleValidator,
  },
  handler: async (ctx, args) => {
    const actor = await getAuthenticatedUserFromSession(ctx);
    if (!actor) {
      throw new Error("Unauthorized");
    }
    await requirePermission(ctx, actor._id, args.workspaceId, "users.invite");

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const existing = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", args.userId).eq("workspaceId", args.workspaceId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    const membershipId = await ctx.db.insert("workspaceMembers", {
      userId: args.userId,
      workspaceId: args.workspaceId,
      role: args.role,
      createdAt: Date.now(),
    });

    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorId: actor._id,
      actorType: "user",
      action: "user.invited",
      resourceType: "workspaceMember",
      resourceId: membershipId,
      metadata: {
        targetUserId: args.userId,
        role: args.role,
        method: "direct_add",
      },
    });

    return membershipId;
  },
});

export const updateRole = mutation({
  args: {
    membershipId: v.id("workspaceMembers"),
    role: assignableRoleValidator,
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const membership = await ctx.db.get(args.membershipId);
    if (!membership) {
      throw new Error("Membership not found");
    }

    // Check permission to manage users
    await requirePermission(ctx, user._id, membership.workspaceId, "users.manage");

    // Cannot change owner role (owner transfer is separate)
    if (membership.role === "owner") {
      throw new Error("Cannot change owner role. Use ownership transfer instead.");
    }

    // Prevent privilege escalation: non-owners cannot make someone admin
    const isOwner = await isWorkspaceOwner(ctx, user._id, membership.workspaceId);
    if (args.role === "admin" && !isOwner) {
      // Check if current user is admin - admins can promote to admin
      const userMembership = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_user_workspace", (q) =>
          q.eq("userId", user._id).eq("workspaceId", membership.workspaceId)
        )
        .first();
      if (userMembership?.role !== "admin" && userMembership?.role !== "owner") {
        throw new Error("Only owners and admins can promote users to admin");
      }
    }

    // Update role and set default permissions for the new role
    const newPermissions = getPermissionsForRole(args.role as Role);
    await ctx.db.patch(args.membershipId, {
      role: args.role,
      permissions: newPermissions,
    });

    await logAudit(ctx, {
      workspaceId: membership.workspaceId,
      actorId: user._id,
      actorType: "user",
      action: "user.role.changed",
      resourceType: "workspaceMember",
      resourceId: args.membershipId,
      metadata: {
        targetUserId: membership.userId,
        previousRole: membership.role,
        newRole: args.role,
      },
    });

    return { success: true };
  },
});

export const remove = mutation({
  args: {
    membershipId: v.id("workspaceMembers"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const membership = await ctx.db.get(args.membershipId);
    if (!membership) {
      throw new Error("Membership not found");
    }

    // Check permission to remove users
    await requirePermission(ctx, user._id, membership.workspaceId, "users.remove");

    // Cannot remove owner
    if (membership.role === "owner") {
      throw new Error("Cannot remove workspace owner. Transfer ownership first.");
    }

    await ctx.db.delete(args.membershipId);

    await logAudit(ctx, {
      workspaceId: membership.workspaceId,
      actorId: user._id,
      actorType: "user",
      action: "user.removed",
      resourceType: "workspaceMember",
      resourceId: args.membershipId,
      metadata: {
        removedUserId: membership.userId,
        removedRole: membership.role,
      },
    });

    return { success: true };
  },
});

export const createInvitation = internalMutation({
  args: {
    inviterId: v.id("users"),
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: assignableRoleValidator,
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.inviterId);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const normalizedEmail = args.email.toLowerCase();

    // Check permission to invite users
    await requirePermission(ctx, args.inviterId, args.workspaceId, "users.invite");

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first();

    if (existingUser) {
      const existingMembership = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_user_workspace", (q) =>
          q.eq("userId", existingUser._id).eq("workspaceId", args.workspaceId)
        )
        .first();

      if (existingMembership) {
        throw new Error("User is already a member of this workspace");
      }

      await ctx.db.insert("workspaceMembers", {
        userId: existingUser._id,
        workspaceId: args.workspaceId,
        role: args.role,
        createdAt: Date.now(),
      });

      await logAudit(ctx, {
        workspaceId: args.workspaceId,
        actorId: args.inviterId,
        actorType: "user",
        action: "user.invited",
        resourceType: "workspaceMember",
        resourceId: existingUser._id,
        metadata: {
          targetUserId: existingUser._id,
          targetEmail: normalizedEmail,
          role: args.role,
          method: "existing_user_add",
        },
      });

      return {
        status: "added" as const,
        workspaceName: workspace.name,
        inviterName: user.name || user.email,
        targetEmail: normalizedEmail,
      };
    }

    const existingInvitation = await ctx.db
      .query("workspaceInvitations")
      .withIndex("by_email_workspace", (q) =>
        q.eq("email", normalizedEmail).eq("workspaceId", args.workspaceId)
      )
      .first();

    if (existingInvitation && existingInvitation.status === "pending") {
      throw new Error("Invitation already sent to this email");
    }

    await ctx.db.insert("workspaceInvitations", {
      workspaceId: args.workspaceId,
      email: normalizedEmail,
      role: args.role,
      invitedBy: user._id,
      status: "pending",
      createdAt: Date.now(),
    });

    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorId: args.inviterId,
      actorType: "user",
      action: "user.invited",
      resourceType: "workspaceInvitation",
      metadata: {
        targetEmail: normalizedEmail,
        role: args.role,
        method: "email_invite",
      },
    });

    return {
      status: "invited" as const,
      workspaceName: workspace.name,
      inviterName: user.name || user.email,
      targetEmail: normalizedEmail,
    };
  },
});

export const inviteToWorkspace = authAction({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: assignableRoleValidator,
    baseUrl: v.string(),
  },
  permission: "users.invite",
  handler: async (ctx, args): Promise<{ status: "added" | "invited" }> => {
    const result = await ctx.runMutation(internal.workspaceMembers.createInvitation, {
      inviterId: ctx.user._id,
      workspaceId: args.workspaceId,
      email: args.email,
      role: args.role,
    });

    if (result.status === "added") {
      const template = emailTemplates.workspaceAdded(
        result.workspaceName,
        result.inviterName ?? "A team member"
      );
      await sendEmail(result.targetEmail, template.subject, template.html);
    } else {
      const acceptLink = `${args.baseUrl}/invite/accept?email=${encodeURIComponent(result.targetEmail)}`;
      const template = emailTemplates.invitation(
        result.workspaceName,
        result.inviterName ?? "A team member",
        acceptLink
      );
      await sendEmail(result.targetEmail, template.subject, template.html);
    }

    return { status: result.status };
  },
});

export const acceptInvitation = mutation({
  args: {
    invitationId: v.id("workspaceInvitations"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (invitation.email !== user.email) {
      throw new Error("This invitation is not for you");
    }

    if (invitation.status !== "pending") {
      throw new Error("Invitation is no longer valid");
    }

    await ctx.db.insert("workspaceMembers", {
      userId: user._id,
      workspaceId: invitation.workspaceId,
      role: invitation.role,
      createdAt: Date.now(),
    });

    await ctx.db.patch(args.invitationId, { status: "accepted" });

    await logAudit(ctx, {
      workspaceId: invitation.workspaceId,
      actorId: user._id,
      actorType: "user",
      action: "user.invited",
      resourceType: "workspaceInvitation",
      resourceId: args.invitationId,
      metadata: {
        invitationStatus: "accepted",
        role: invitation.role,
        invitedBy: invitation.invitedBy,
      },
    });

    return { success: true };
  },
});

export const getPendingInvitations = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return [];
    }

    const invitations = await ctx.db
      .query("workspaceInvitations")
      .withIndex("by_email", (q) => q.eq("email", user.email))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    const withWorkspaces = await Promise.all(
      invitations.map(async (inv) => {
        const workspace = await ctx.db.get(inv.workspaceId);
        const inviter = await ctx.db.get(inv.invitedBy);
        return {
          ...inv,
          workspaceName: workspace?.name,
          inviterName: inviter?.name || inviter?.email,
        };
      })
    );

    return withWorkspaces;
  },
});

export const getWorkspacePendingInvitations = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return [];
    }

    // Check permission to read users
    const canReadUsers = await hasPermission(ctx, user._id, args.workspaceId, "users.read");

    if (!canReadUsers) {
      return [];
    }

    const invitations = await ctx.db
      .query("workspaceInvitations")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    const withInviters = await Promise.all(
      invitations.map(async (inv) => {
        const inviter = await ctx.db.get(inv.invitedBy);
        return {
          ...inv,
          inviterName: inviter?.name || inviter?.email,
        };
      })
    );

    return withInviters;
  },
});

export const cancelInvitation = mutation({
  args: {
    invitationId: v.id("workspaceInvitations"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    // Check permission to manage users (cancel invitations)
    await requirePermission(ctx, user._id, invitation.workspaceId, "users.manage");

    await ctx.db.patch(args.invitationId, { status: "declined" });

    await logAudit(ctx, {
      workspaceId: invitation.workspaceId,
      actorId: user._id,
      actorType: "user",
      action: "user.removed",
      resourceType: "workspaceInvitation",
      resourceId: args.invitationId,
      metadata: {
        invitationStatus: "declined",
        targetEmail: invitation.email,
      },
    });

    return { success: true };
  },
});

// Transfer workspace ownership (task 3.2)
export const transferOwnership = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    newOwnerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      throw new Error("Unauthorized");
    }

    // Only current owner can transfer ownership
    const isOwner = await isWorkspaceOwner(ctx, user._id, args.workspaceId);
    if (!isOwner) {
      throw new Error("Only the workspace owner can transfer ownership");
    }

    // New owner must be an existing member
    const newOwnerMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", args.newOwnerId).eq("workspaceId", args.workspaceId)
      )
      .first();

    if (!newOwnerMembership) {
      throw new Error("New owner must be an existing workspace member");
    }

    // Get current owner's membership
    const currentOwnerMembership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", args.workspaceId)
      )
      .first();

    if (!currentOwnerMembership) {
      throw new Error("Current owner membership not found");
    }

    // Update new owner to owner role
    const ownerPermissions = getPermissionsForRole("owner");
    await ctx.db.patch(newOwnerMembership._id, {
      role: "owner",
      permissions: ownerPermissions,
    });

    // Demote current owner to admin
    const adminPermissions = getPermissionsForRole("admin");
    await ctx.db.patch(currentOwnerMembership._id, {
      role: "admin",
      permissions: adminPermissions,
    });

    await logAudit(ctx, {
      workspaceId: args.workspaceId,
      actorId: user._id,
      actorType: "user",
      action: "user.ownership.transferred",
      resourceType: "workspaceMember",
      resourceId: newOwnerMembership._id,
      metadata: {
        previousOwnerId: user._id,
        newOwnerId: args.newOwnerId,
      },
    });

    return { success: true };
  },
});

// Get user's role in a workspace
export const getMemberRole = query({
  args: {
    workspaceId: v.id("workspaces"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUserFromSession(ctx);
    if (!user) {
      return null;
    }

    const membership = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user_workspace", (q) =>
        q.eq("userId", user._id).eq("workspaceId", args.workspaceId)
      )
      .first();

    if (!membership) {
      return null;
    }

    return {
      role: membership.role,
      permissions: membership.permissions,
      isOwner: membership.role === "owner",
    };
  },
});
