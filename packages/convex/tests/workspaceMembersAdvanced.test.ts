import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("workspaceMembers - advanced", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let adminUserId: Id<"users">;
  let adminToken: string;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    const workspace = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    testWorkspaceId = workspace.workspaceId;
    adminUserId = workspace.userId;
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

  it("should prevent removing last admin", async () => {
    const members = await client.mutation(api.testing.helpers.listTestWorkspaceMembers, {
      workspaceId: testWorkspaceId,
    });

    const adminMembership = members.find((m: { userId: string }) => m.userId === adminUserId);
    expect(adminMembership).toBeDefined();

    await expect(
      client.mutation(api.testing.helpers.removeTestMember, {
        membershipId: adminMembership!._id,
      })
    ).rejects.toThrow(/at least one admin/i);
  });

  it("should prevent demoting last admin to agent", async () => {
    const members = await client.mutation(api.testing.helpers.listTestWorkspaceMembers, {
      workspaceId: testWorkspaceId,
    });

    const adminMembership = members.find((m: { userId: string }) => m.userId === adminUserId);

    await expect(
      client.mutation(api.testing.helpers.updateTestMemberRole, {
        membershipId: adminMembership!._id,
        role: "agent",
      })
    ).rejects.toThrow(/at least one admin/i);
  });

  it("should allow demoting admin when another admin exists", async () => {
    // Create second admin
    const secondAdmin = await client.mutation(api.testing.helpers.createTestUser, {
      workspaceId: testWorkspaceId,
      email: `second-admin-${Date.now()}@test.opencom.dev`,
      role: "admin",
    });

    // Get first admin's membership
    const members = await client.mutation(api.testing.helpers.listTestWorkspaceMembers, {
      workspaceId: testWorkspaceId,
    });

    const secondAdminMembership = members.find(
      (m: { userId: string }) => m.userId === secondAdmin.userId
    );

    // Should be able to demote second admin since first admin still exists
    await client.mutation(api.testing.helpers.updateTestMemberRole, {
      membershipId: secondAdminMembership!._id,
      role: "agent",
    });

    const updatedMembers = await client.mutation(api.testing.helpers.listTestWorkspaceMembers, {
      workspaceId: testWorkspaceId,
    });

    const demotedMember = updatedMembers.find(
      (m: { userId: string }) => m.userId === secondAdmin.userId
    );
    expect(demotedMember?.role).toBe("agent");
  });

  it("should create agent member in workspace", async () => {
    // Create an agent user via test helper
    const agentEmail = `agent-${Date.now()}@test.opencom.dev`;
    const agent = await client.mutation(api.testing.helpers.createTestUser, {
      workspaceId: testWorkspaceId,
      email: agentEmail,
      role: "agent",
    });

    const members = await client.mutation(api.testing.helpers.listTestWorkspaceMembers, {
      workspaceId: testWorkspaceId,
    });

    const agentMember = members.find((m: { userId: string }) => m.userId === agent.userId);
    expect(agentMember).toBeDefined();
    expect(agentMember?.role).toBe("agent");
  });

  it("should remove a member from workspace", async () => {
    const targetUser = await client.mutation(api.testing.helpers.createTestUser, {
      workspaceId: testWorkspaceId,
      email: `target-${Date.now()}@test.opencom.dev`,
      role: "agent",
    });

    const members = await client.mutation(api.testing.helpers.listTestWorkspaceMembers, {
      workspaceId: testWorkspaceId,
    });

    const targetMembership = members.find(
      (m: { userId: string }) => m.userId === targetUser.userId
    );
    expect(targetMembership).toBeDefined();

    await client.mutation(api.testing.helpers.removeTestMember, {
      membershipId: targetMembership!._id,
    });

    const updatedMembers = await client.mutation(api.testing.helpers.listTestWorkspaceMembers, {
      workspaceId: testWorkspaceId,
    });

    const removed = updatedMembers.find((m: { userId: string }) => m.userId === targetUser.userId);
    expect(removed).toBeUndefined();
  });

  it("should list workspace members after changes", async () => {
    const members = await client.mutation(api.testing.helpers.listTestWorkspaceMembers, {
      workspaceId: testWorkspaceId,
    });

    expect(members.length).toBeGreaterThan(0);
  });

  it("should add existing user directly to workspace", async () => {
    const existingUserEmail = `existing-${Date.now()}@test.opencom.dev`;
    const existingUser = await client.mutation(api.testing.helpers.createTestUser, {
      workspaceId: testWorkspaceId,
      email: existingUserEmail,
      role: "agent",
    });

    expect(existingUser.userId).toBeDefined();

    // Verify they appear in the workspace members
    const members = await client.mutation(api.testing.helpers.listTestWorkspaceMembers, {
      workspaceId: testWorkspaceId,
    });

    expect(members.some((m: { userId: string }) => m.userId === existingUser.userId)).toBe(true);
  });

  it("should have correct member count", async () => {
    const members = await client.mutation(api.testing.helpers.listTestWorkspaceMembers, {
      workspaceId: testWorkspaceId,
    });

    // Should have at least the admin
    expect(members.length).toBeGreaterThanOrEqual(1);
    const adminMember = members.find((m: { userId: string }) => m.userId === adminUserId);
    expect(adminMember).toBeDefined();
    expect(adminMember?.role).toBe("admin");
  });
});
