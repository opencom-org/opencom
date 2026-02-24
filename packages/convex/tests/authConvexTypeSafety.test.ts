import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("authConvex type safety - typed query helpers", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testUserId: Id<"users">;
  const testEmail = `auth-type-test-${Date.now()}@test.opencom.dev`;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    const result = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    testWorkspaceId = result.workspaceId;
    testUserId = result.userId;
  });

  afterAll(async () => {
    if (testWorkspaceId) {
      try {
        await client.mutation(api.testing.helpers.cleanupTestData, {
          workspaceId: testWorkspaceId,
        });
      } catch (e) {
        console.warn("Cleanup failed:", e);
      }
    }
    await client.close();
  });

  describe("typed user lookup by email index", () => {
    it("should find an existing user by email", async () => {
      const user = await client.mutation(api.testing.helpers.createTestUser, {
        workspaceId: testWorkspaceId,
        email: testEmail,
        role: "agent",
      });

      const found = await client.mutation(api.testing.helpers.lookupUserByEmail, {
        email: testEmail,
      });

      expect(found).not.toBeNull();
      expect(found!._id).toBe(user.userId);
      expect(found!.email).toBe(testEmail);
      expect(found!.workspaceId).toBe(testWorkspaceId);
    });

    it("should return null for non-existent email", async () => {
      const found = await client.mutation(api.testing.helpers.lookupUserByEmail, {
        email: `nonexistent-${Date.now()}@test.opencom.dev`,
      });

      expect(found).toBeNull();
    });

    it("should be case-insensitive", async () => {
      const found = await client.mutation(api.testing.helpers.lookupUserByEmail, {
        email: testEmail.toUpperCase(),
      });

      expect(found).not.toBeNull();
      expect(found!.email).toBe(testEmail);
    });
  });

  describe("typed invitation lookup by email index", () => {
    it("should find pending invitations by email", async () => {
      const inviteEmail = `invite-type-test-${Date.now()}@test.opencom.dev`;

      await client.mutation(api.testing.helpers.createTestInvitation, {
        workspaceId: testWorkspaceId,
        email: inviteEmail,
        role: "agent",
        invitedBy: testUserId,
      });

      const invitations = await client.mutation(
        api.testing.helpers.lookupPendingInvitationsByEmail,
        { email: inviteEmail }
      );

      expect(invitations.length).toBe(1);
      expect(invitations[0].email).toBe(inviteEmail.toLowerCase());
      expect(invitations[0].status).toBe("pending");
      expect(invitations[0].workspaceId).toBe(testWorkspaceId);
      expect(invitations[0].role).toBe("agent");
    });

    it("should return empty array when no pending invitations exist", async () => {
      const invitations = await client.mutation(
        api.testing.helpers.lookupPendingInvitationsByEmail,
        { email: `no-invites-${Date.now()}@test.opencom.dev` }
      );

      expect(invitations).toEqual([]);
    });
  });

  describe("workspace and user creation path", () => {
    it("should create workspace with correct schema shape", async () => {
      const result = await client.mutation(api.testing.helpers.createTestWorkspace, {});
      const workspace = await client.mutation(api.testing.helpers.getTestWorkspaceFull, {
        id: result.workspaceId,
      });

      expect(workspace).toBeDefined();
      expect(workspace!._id).toBe(result.workspaceId);
      expect(typeof workspace!.name).toBe("string");
      expect(typeof workspace!.createdAt).toBe("number");

      // Cleanup extra workspace
      await client.mutation(api.testing.helpers.cleanupTestData, {
        workspaceId: result.workspaceId,
      });
    });

    it("should create user with typed workspace reference", async () => {
      const email = `typed-user-${Date.now()}@test.opencom.dev`;
      const user = await client.mutation(api.testing.helpers.createTestUser, {
        workspaceId: testWorkspaceId,
        email,
        name: "Typed User",
        role: "admin",
      });

      const found = await client.mutation(api.testing.helpers.lookupUserByEmail, {
        email,
      });

      expect(found).not.toBeNull();
      expect(found!._id).toBe(user.userId);
      expect(found!.workspaceId).toBe(testWorkspaceId);
      expect(found!.role).toBe("admin");
      expect(found!.name).toBe("Typed User");
    });

    it("should create workspace membership alongside user", async () => {
      const members = await client.mutation(api.testing.helpers.listTestWorkspaceMembers, {
        workspaceId: testWorkspaceId,
      });

      expect(members.length).toBeGreaterThanOrEqual(1);
      const admin = members.find((m: { userId: string }) => m.userId === testUserId);
      expect(admin).toBeDefined();
      expect(admin!.role).toBe("admin");
    });
  });
});
