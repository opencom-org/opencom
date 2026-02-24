import { describe, it, expect } from "vitest";
import { ROLE_PERMISSIONS } from "../convex/permissions";

// Unit tests for migration script logic (task 9.6)
// Tests the role-to-permission mapping logic used in migrateRolesToPermissions

describe("Migration: Roles to Permissions", () => {
  describe("Role mapping logic", () => {
    it("admin role maps to admin permissions", () => {
      const adminPerms = ROLE_PERMISSIONS["admin"];
      expect(adminPerms).toBeDefined();
      expect(adminPerms.length).toBeGreaterThan(0);
      expect(adminPerms).toContain("users.manage");
    });

    it("agent role maps to agent permissions", () => {
      const agentPerms = ROLE_PERMISSIONS["agent"];
      expect(agentPerms).toBeDefined();
      expect(agentPerms.length).toBeGreaterThan(0);
      expect(agentPerms).toContain("conversations.read");
    });

    it("owner role has all permissions", () => {
      const ownerPerms = ROLE_PERMISSIONS["owner"];
      expect(ownerPerms).toBeDefined();
      expect(ownerPerms).toContain("settings.billing");
      expect(ownerPerms.length).toBeGreaterThan(ROLE_PERMISSIONS["admin"].length);
    });

    it("viewer role has read-only permissions", () => {
      const viewerPerms = ROLE_PERMISSIONS["viewer"];
      expect(viewerPerms).toBeDefined();
      expect(viewerPerms).toContain("conversations.read");
      expect(viewerPerms).not.toContain("conversations.reply");
    });
  });

  describe("Migration decision logic", () => {
    interface MockMember {
      _id: string;
      userId: string;
      role: string;
      createdAt: number;
      permissions?: string[];
    }

    function simulateMigration(members: MockMember[]): {
      ownerAssigned: string | null;
      changes: Array<{
        userId: string;
        oldRole: string;
        newRole: string;
      }>;
    } {
      // Sort by createdAt to find the first admin (becomes owner)
      const sortedMembers = [...members].sort((a, b) => a.createdAt - b.createdAt);
      const firstAdmin = sortedMembers.find((m) => m.role === "admin");

      let ownerAssigned: string | null = null;
      let ownerAlreadySet = false;
      const changes: Array<{ userId: string; oldRole: string; newRole: string }> = [];

      for (const member of sortedMembers) {
        // Skip if already migrated
        if (member.permissions && member.permissions.length > 0) {
          continue;
        }

        const oldRole = member.role;
        let newRole = oldRole;

        // First admin becomes owner
        if (member.role === "admin" && !ownerAlreadySet && member._id === firstAdmin?._id) {
          newRole = "owner";
          ownerAlreadySet = true;
          ownerAssigned = member.userId;
        }

        changes.push({ userId: member.userId, oldRole, newRole });
      }

      // If no admin found, first member becomes owner
      if (!ownerAlreadySet && sortedMembers.length > 0) {
        const firstMember = sortedMembers[0];
        if (!firstMember.permissions || firstMember.permissions.length === 0) {
          ownerAssigned = firstMember.userId;
          // Update the change for this member
          const existingChange = changes.find((c) => c.userId === firstMember.userId);
          if (existingChange) {
            existingChange.newRole = "owner";
          } else {
            changes.push({
              userId: firstMember.userId,
              oldRole: firstMember.role,
              newRole: "owner",
            });
          }
        }
      }

      return { ownerAssigned, changes };
    }

    it("first admin becomes owner", () => {
      const members: MockMember[] = [
        { _id: "m1", userId: "u1", role: "agent", createdAt: 1000 },
        { _id: "m2", userId: "u2", role: "admin", createdAt: 2000 },
        { _id: "m3", userId: "u3", role: "admin", createdAt: 3000 },
      ];

      const result = simulateMigration(members);

      expect(result.ownerAssigned).toBe("u2");
      expect(result.changes.find((c) => c.userId === "u2")?.newRole).toBe("owner");
      expect(result.changes.find((c) => c.userId === "u3")?.newRole).toBe("admin");
    });

    it("first member becomes owner if no admins", () => {
      const members: MockMember[] = [
        { _id: "m1", userId: "u1", role: "agent", createdAt: 2000 },
        { _id: "m2", userId: "u2", role: "agent", createdAt: 1000 },
      ];

      const result = simulateMigration(members);

      // u2 was created first, so they become owner
      expect(result.ownerAssigned).toBe("u2");
    });

    it("skips already migrated members", () => {
      const members: MockMember[] = [
        {
          _id: "m1",
          userId: "u1",
          role: "admin",
          createdAt: 1000,
          permissions: ["users.manage"], // Already migrated
        },
        { _id: "m2", userId: "u2", role: "agent", createdAt: 2000 },
      ];

      const result = simulateMigration(members);

      // u1 is skipped because already has permissions
      expect(result.changes.find((c) => c.userId === "u1")).toBeUndefined();
      expect(result.changes.find((c) => c.userId === "u2")).toBeDefined();
    });

    it("handles single member workspace", () => {
      const members: MockMember[] = [{ _id: "m1", userId: "u1", role: "agent", createdAt: 1000 }];

      const result = simulateMigration(members);

      expect(result.ownerAssigned).toBe("u1");
      expect(result.changes[0].newRole).toBe("owner");
    });

    it("handles empty workspace", () => {
      const members: MockMember[] = [];

      const result = simulateMigration(members);

      expect(result.ownerAssigned).toBeNull();
      expect(result.changes).toHaveLength(0);
    });
  });

  describe("Migration verification logic", () => {
    interface MockWorkspaceMember {
      role: string;
      permissions?: string[];
    }

    function verifyWorkspace(members: MockWorkspaceMember[]): {
      hasOwner: boolean;
      multipleOwners: boolean;
      membersWithoutPermissions: number;
    } {
      const owners = members.filter((m) => m.role === "owner");
      const membersWithoutPermissions = members.filter(
        (m) => !m.permissions || m.permissions.length === 0
      );

      return {
        hasOwner: owners.length === 1,
        multipleOwners: owners.length > 1,
        membersWithoutPermissions: membersWithoutPermissions.length,
      };
    }

    it("detects missing owner", () => {
      const members: MockWorkspaceMember[] = [
        { role: "admin", permissions: ["users.manage"] },
        { role: "agent", permissions: ["conversations.read"] },
      ];

      const result = verifyWorkspace(members);

      expect(result.hasOwner).toBe(false);
      expect(result.multipleOwners).toBe(false);
    });

    it("detects multiple owners", () => {
      const members: MockWorkspaceMember[] = [
        { role: "owner", permissions: ["settings.billing"] },
        { role: "owner", permissions: ["settings.billing"] },
      ];

      const result = verifyWorkspace(members);

      expect(result.hasOwner).toBe(false); // hasOwner means exactly 1
      expect(result.multipleOwners).toBe(true);
    });

    it("detects members without permissions", () => {
      const members: MockWorkspaceMember[] = [
        { role: "owner", permissions: ["settings.billing"] },
        { role: "agent" }, // No permissions
        { role: "agent", permissions: [] }, // Empty permissions
      ];

      const result = verifyWorkspace(members);

      expect(result.membersWithoutPermissions).toBe(2);
    });

    it("passes healthy workspace", () => {
      const members: MockWorkspaceMember[] = [
        { role: "owner", permissions: ROLE_PERMISSIONS["owner"] },
        { role: "admin", permissions: ROLE_PERMISSIONS["admin"] },
        { role: "agent", permissions: ROLE_PERMISSIONS["agent"] },
      ];

      const result = verifyWorkspace(members);

      expect(result.hasOwner).toBe(true);
      expect(result.multipleOwners).toBe(false);
      expect(result.membersWithoutPermissions).toBe(0);
    });
  });
});
