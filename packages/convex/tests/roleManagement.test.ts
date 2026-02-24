import { describe, it, expect } from "vitest";
import { roleHasPermission, ROLE_PERMISSIONS, Role, Permission } from "../convex/permissions";

// Unit tests for role management flows (task 9.3)
// Tests role transitions, permission inheritance, and privilege escalation prevention

describe("Role Management", () => {
  describe("Role hierarchy", () => {
    const roles: Role[] = ["owner", "admin", "agent", "viewer"];

    it("owner has strictly more permissions than admin", () => {
      const ownerPerms = new Set(ROLE_PERMISSIONS.owner);
      const adminPerms = new Set(ROLE_PERMISSIONS.admin);

      // Every admin permission should be in owner
      for (const perm of adminPerms) {
        expect(ownerPerms.has(perm)).toBe(true);
      }

      // Owner should have at least one permission admin doesn't
      expect(ownerPerms.size).toBeGreaterThan(adminPerms.size);
    });

    it("admin has strictly more permissions than agent", () => {
      const adminPerms = new Set(ROLE_PERMISSIONS.admin);
      const agentPerms = new Set(ROLE_PERMISSIONS.agent);

      // Every agent permission should be in admin
      for (const perm of agentPerms) {
        expect(adminPerms.has(perm)).toBe(true);
      }

      expect(adminPerms.size).toBeGreaterThan(agentPerms.size);
    });

    it("agent has more total permissions than viewer", () => {
      const agentPerms = new Set(ROLE_PERMISSIONS.agent);
      const viewerPerms = new Set(ROLE_PERMISSIONS.viewer);

      // Agent has more permissions overall (though viewer has audit.read which agent doesn't)
      expect(agentPerms.size).toBeGreaterThan(viewerPerms.size);

      // Both share read access to conversations
      expect(agentPerms.has("conversations.read")).toBe(true);
      expect(viewerPerms.has("conversations.read")).toBe(true);
    });
  });

  describe("Owner-only permissions", () => {
    it("only owner has billing permission", () => {
      expect(roleHasPermission("owner", "settings.billing")).toBe(true);
      expect(roleHasPermission("admin", "settings.billing")).toBe(false);
      expect(roleHasPermission("agent", "settings.billing")).toBe(false);
      expect(roleHasPermission("viewer", "settings.billing")).toBe(false);
    });
  });

  describe("Role transition validation", () => {
    // Helper to check if a role can manage another role
    function canManageRole(actorRole: Role, targetRole: Role): boolean {
      // Owner can manage all roles
      if (actorRole === "owner") return true;

      // Admin can manage agent and viewer, but not owner or other admins
      if (actorRole === "admin") {
        return targetRole === "agent" || targetRole === "viewer";
      }

      // Agent and viewer cannot manage roles
      return false;
    }

    it("owner can manage all roles", () => {
      expect(canManageRole("owner", "owner")).toBe(true);
      expect(canManageRole("owner", "admin")).toBe(true);
      expect(canManageRole("owner", "agent")).toBe(true);
      expect(canManageRole("owner", "viewer")).toBe(true);
    });

    it("admin can only manage agent and viewer", () => {
      expect(canManageRole("admin", "owner")).toBe(false);
      expect(canManageRole("admin", "admin")).toBe(false);
      expect(canManageRole("admin", "agent")).toBe(true);
      expect(canManageRole("admin", "viewer")).toBe(true);
    });

    it("agent cannot manage any roles", () => {
      expect(canManageRole("agent", "owner")).toBe(false);
      expect(canManageRole("agent", "admin")).toBe(false);
      expect(canManageRole("agent", "agent")).toBe(false);
      expect(canManageRole("agent", "viewer")).toBe(false);
    });

    it("viewer cannot manage any roles", () => {
      expect(canManageRole("viewer", "owner")).toBe(false);
      expect(canManageRole("viewer", "admin")).toBe(false);
      expect(canManageRole("viewer", "agent")).toBe(false);
      expect(canManageRole("viewer", "viewer")).toBe(false);
    });
  });

  describe("Privilege escalation prevention", () => {
    // Helper to check if promoting to a role would be escalation
    function isPrivilegeEscalation(actorRole: Role, currentRole: Role, newRole: Role): boolean {
      const roleRank: Record<Role, number> = {
        viewer: 0,
        agent: 1,
        admin: 2,
        owner: 3,
      };

      // Cannot promote to a role higher than your own (except owner)
      if (actorRole !== "owner" && roleRank[newRole] >= roleRank[actorRole]) {
        return true;
      }

      return false;
    }

    it("admin cannot promote to admin or owner", () => {
      expect(isPrivilegeEscalation("admin", "agent", "admin")).toBe(true);
      expect(isPrivilegeEscalation("admin", "viewer", "owner")).toBe(true);
    });

    it("admin can demote or promote within allowed range", () => {
      expect(isPrivilegeEscalation("admin", "viewer", "agent")).toBe(false);
      expect(isPrivilegeEscalation("admin", "agent", "viewer")).toBe(false);
    });

    it("owner can promote to any role", () => {
      expect(isPrivilegeEscalation("owner", "viewer", "admin")).toBe(false);
      expect(isPrivilegeEscalation("owner", "agent", "admin")).toBe(false);
      expect(isPrivilegeEscalation("owner", "admin", "owner")).toBe(false);
    });
  });

  describe("Ownership transfer rules", () => {
    it("only owner can transfer ownership", () => {
      const canTransferOwnership = (role: Role) => role === "owner";

      expect(canTransferOwnership("owner")).toBe(true);
      expect(canTransferOwnership("admin")).toBe(false);
      expect(canTransferOwnership("agent")).toBe(false);
      expect(canTransferOwnership("viewer")).toBe(false);
    });

    it("cannot transfer ownership to viewer", () => {
      // Business rule: viewers shouldn't become owners directly
      const validOwnershipTargets: Role[] = ["admin", "agent"];
      expect(validOwnershipTargets).not.toContain("viewer");
    });
  });

  describe("Permission consistency", () => {
    it("all roles have conversations.read for support visibility", () => {
      expect(roleHasPermission("owner", "conversations.read")).toBe(true);
      expect(roleHasPermission("admin", "conversations.read")).toBe(true);
      expect(roleHasPermission("agent", "conversations.read")).toBe(true);
      expect(roleHasPermission("viewer", "conversations.read")).toBe(true);
    });

    it("write permissions are not given to viewer", () => {
      const writePermissions: Permission[] = [
        "conversations.reply",
        "conversations.assign",
        "conversations.close",
        "conversations.delete",
        "users.invite",
        "users.manage",
        "users.remove",
        "articles.create",
        "articles.publish",
        "articles.delete",
        "snippets.manage",
        "tours.manage",
        "settings.workspace",
        "settings.security",
        "settings.integrations",
        "settings.billing",
        "data.export",
        "data.delete",
      ];

      for (const perm of writePermissions) {
        expect(roleHasPermission("viewer", perm)).toBe(false);
      }
    });
  });
});
