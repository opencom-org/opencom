import { describe, it, expect } from "vitest";
import {
  roleHasPermission,
  memberHasPermission,
  getPermissionsForRole,
  ROLE_PERMISSIONS,
} from "../convex/permissions";

describe("Permission System", () => {
  describe("roleHasPermission", () => {
    it("owner has all permissions", () => {
      expect(roleHasPermission("owner", "conversations.read")).toBe(true);
      expect(roleHasPermission("owner", "settings.billing")).toBe(true);
      expect(roleHasPermission("owner", "data.delete")).toBe(true);
      expect(roleHasPermission("owner", "audit.read")).toBe(true);
    });

    it("admin has most permissions except billing", () => {
      expect(roleHasPermission("admin", "conversations.read")).toBe(true);
      expect(roleHasPermission("admin", "users.manage")).toBe(true);
      expect(roleHasPermission("admin", "settings.security")).toBe(true);
      // Admin should NOT have billing permission
      expect(roleHasPermission("admin", "settings.billing")).toBe(false);
    });

    it("agent has limited permissions", () => {
      expect(roleHasPermission("agent", "conversations.read")).toBe(true);
      expect(roleHasPermission("agent", "conversations.reply")).toBe(true);
      expect(roleHasPermission("agent", "snippets.manage")).toBe(true);
      // Agent should NOT have admin permissions
      expect(roleHasPermission("agent", "users.manage")).toBe(false);
      expect(roleHasPermission("agent", "settings.workspace")).toBe(false);
      expect(roleHasPermission("agent", "data.delete")).toBe(false);
    });

    it("viewer has read-only permissions", () => {
      expect(roleHasPermission("viewer", "conversations.read")).toBe(true);
      expect(roleHasPermission("viewer", "users.read")).toBe(true);
      expect(roleHasPermission("viewer", "articles.read")).toBe(true);
      expect(roleHasPermission("viewer", "audit.read")).toBe(true);
      // Viewer should NOT have write permissions
      expect(roleHasPermission("viewer", "conversations.reply")).toBe(false);
      expect(roleHasPermission("viewer", "articles.create")).toBe(false);
      expect(roleHasPermission("viewer", "users.invite")).toBe(false);
    });
  });

  describe("memberHasPermission", () => {
    it("uses role permissions when no custom permissions", () => {
      const member = { role: "admin" as const, permissions: null };
      expect(memberHasPermission(member, "users.manage")).toBe(true);
      expect(memberHasPermission(member, "settings.billing")).toBe(false);
    });

    it("uses custom permissions when provided", () => {
      const member = {
        role: "agent" as const,
        permissions: ["conversations.read", "data.export"],
      };
      expect(memberHasPermission(member, "conversations.read")).toBe(true);
      expect(memberHasPermission(member, "data.export")).toBe(true);
      // Should not have other agent permissions since custom overrides
      expect(memberHasPermission(member, "conversations.reply")).toBe(false);
    });

    it("empty permissions array falls back to role permissions", () => {
      const member = { role: "admin" as const, permissions: [] };
      // Empty array falls back to role-based permissions
      expect(memberHasPermission(member, "users.manage")).toBe(true);
    });
  });

  describe("getPermissionsForRole", () => {
    it("returns correct permissions for owner", () => {
      const perms = getPermissionsForRole("owner");
      expect(perms).toContain("settings.billing");
      expect(perms).toContain("data.delete");
      expect(perms.length).toBeGreaterThan(20);
    });

    it("returns correct permissions for agent", () => {
      const perms = getPermissionsForRole("agent");
      expect(perms).toContain("conversations.read");
      expect(perms).toContain("snippets.manage");
      expect(perms).not.toContain("users.manage");
    });
  });

  describe("ROLE_PERMISSIONS structure", () => {
    it("all roles have defined permissions", () => {
      expect(ROLE_PERMISSIONS.owner).toBeDefined();
      expect(ROLE_PERMISSIONS.admin).toBeDefined();
      expect(ROLE_PERMISSIONS.agent).toBeDefined();
      expect(ROLE_PERMISSIONS.viewer).toBeDefined();
    });

    it("owner has most permissions", () => {
      expect(ROLE_PERMISSIONS.owner.length).toBeGreaterThan(ROLE_PERMISSIONS.admin.length);
    });

    it("admin has more permissions than agent", () => {
      expect(ROLE_PERMISSIONS.admin.length).toBeGreaterThan(ROLE_PERMISSIONS.agent.length);
    });

    it("agent has more permissions than viewer", () => {
      expect(ROLE_PERMISSIONS.agent.length).toBeGreaterThan(ROLE_PERMISSIONS.viewer.length);
    });
  });
});
