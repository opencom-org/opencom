import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { ROLE_PERMISSIONS, Role } from "../permissions";

// Migration script to convert existing admin/agent roles to new permission model (task 3.5)
// Phase 2 of the migration plan:
// 1. Map existing `admin` → new `admin` role with full permissions
// 2. Map existing `agent` → new `agent` role with limited permissions
// 3. First admin of each workspace becomes `owner`

export const migrateWorkspaceRoles = internalMutation({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    const results: {
      workspaceId: string;
      membersProcessed: number;
      ownerAssigned: string | null;
      changes: Array<{
        userId: string;
        oldRole: string;
        newRole: string;
        permissionsAdded: boolean;
      }>;
    }[] = [];

    // Get workspaces to migrate
    let workspaces;
    if (args.workspaceId) {
      const workspace = await ctx.db.get(args.workspaceId);
      workspaces = workspace ? [workspace] : [];
    } else {
      workspaces = await ctx.db.query("workspaces").collect();
    }

    for (const workspace of workspaces) {
      const workspaceResult = {
        workspaceId: workspace._id,
        membersProcessed: 0,
        ownerAssigned: null as string | null,
        changes: [] as Array<{
          userId: string;
          oldRole: string;
          newRole: string;
          permissionsAdded: boolean;
        }>,
      };

      // Get all members of this workspace
      const members = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
        .collect();

      // Sort by createdAt to find the first admin (becomes owner)
      const sortedMembers = [...members].sort((a, b) => a.createdAt - b.createdAt);

      // Find the first admin to make owner
      const firstAdmin = sortedMembers.find((m) => m.role === "admin");
      let ownerAssigned = false;

      for (const member of sortedMembers) {
        workspaceResult.membersProcessed++;
        const oldRole = member.role;
        let newRole = oldRole;
        let permissionsAdded = false;

        // Check if this member already has permissions set
        if (member.permissions && member.permissions.length > 0) {
          // Already migrated, skip
          continue;
        }

        // Determine new role
        if (member.role === "admin" && !ownerAssigned && member._id === firstAdmin?._id) {
          // First admin becomes owner
          newRole = "owner";
          ownerAssigned = true;
          workspaceResult.ownerAssigned = member.userId;
        }
        // admin stays admin, agent stays agent (role field unchanged unless becoming owner)

        // Get permissions for the role
        const permissions = ROLE_PERMISSIONS[newRole as Role] || [];

        if (!dryRun) {
          await ctx.db.patch(member._id, {
            role: newRole as "owner" | "admin" | "agent" | "viewer",
            permissions: permissions,
          });
        }

        permissionsAdded = permissions.length > 0;

        workspaceResult.changes.push({
          userId: member.userId,
          oldRole,
          newRole,
          permissionsAdded,
        });
      }

      // If no admin found, make the first member (by createdAt) the owner
      if (!ownerAssigned && sortedMembers.length > 0) {
        const firstMember = sortedMembers[0];
        const permissions = ROLE_PERMISSIONS["owner"];

        if (!dryRun) {
          await ctx.db.patch(firstMember._id, {
            role: "owner",
            permissions: permissions,
          });
        }

        workspaceResult.ownerAssigned = firstMember.userId;
        workspaceResult.changes.push({
          userId: firstMember.userId,
          oldRole: firstMember.role,
          newRole: "owner",
          permissionsAdded: true,
        });
      }

      results.push(workspaceResult);
    }

    return {
      dryRun,
      workspacesProcessed: results.length,
      results,
    };
  },
});

// Verify migration status
export const verifyMigration = internalMutation({
  args: {},
  handler: async (ctx) => {
    const workspaces = await ctx.db.query("workspaces").collect();
    const issues: Array<{
      workspaceId: string;
      issue: string;
    }> = [];

    for (const workspace of workspaces) {
      const members = await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
        .collect();

      // Check for owner
      const owners = members.filter((m) => m.role === "owner");
      if (owners.length === 0) {
        issues.push({
          workspaceId: workspace._id,
          issue: "No owner assigned",
        });
      } else if (owners.length > 1) {
        issues.push({
          workspaceId: workspace._id,
          issue: `Multiple owners found: ${owners.length}`,
        });
      }

      // Check for members without permissions
      const membersWithoutPermissions = members.filter(
        (m) => !m.permissions || m.permissions.length === 0
      );
      if (membersWithoutPermissions.length > 0) {
        issues.push({
          workspaceId: workspace._id,
          issue: `${membersWithoutPermissions.length} members without permissions`,
        });
      }
    }

    return {
      totalWorkspaces: workspaces.length,
      issuesFound: issues.length,
      issues,
      status: issues.length === 0 ? "healthy" : "needs_attention",
    };
  },
});
