import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("invitation flow - invite → signup → membership", () => {
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

  it("should create invitation for new user", async () => {
    const inviteEmail = `new-user-${Date.now()}@test.opencom.dev`;

    const result = await client.mutation(api.testing.helpers.createTestInvitation, {
      workspaceId: testWorkspaceId,
      email: inviteEmail,
      role: "agent",
      invitedBy: adminUserId,
    });

    expect(result.invitationId).toBeDefined();
  });

  it("should list pending invitations", async () => {
    const inviteEmail = `pending-${Date.now()}@test.opencom.dev`;

    await client.mutation(api.testing.helpers.createTestInvitation, {
      workspaceId: testWorkspaceId,
      email: inviteEmail,
      role: "agent",
      invitedBy: adminUserId,
    });

    const invitations = await client.mutation(api.testing.helpers.listTestPendingInvitations, {
      workspaceId: testWorkspaceId,
    });

    expect(invitations.length).toBeGreaterThan(0);
    const found = invitations.find((i: { email: string }) => i.email === inviteEmail);
    expect(found).toBeDefined();
    expect(found?.status).toBe("pending");
  });

  it("should create invitation and accept it", async () => {
    const inviteEmail = `auto-accept-${Date.now()}@test.opencom.dev`;

    // Create invitation first
    const inviteResult = await client.mutation(api.testing.helpers.createTestInvitation, {
      workspaceId: testWorkspaceId,
      email: inviteEmail,
      role: "agent",
      invitedBy: adminUserId,
    });

    expect(inviteResult.invitationId).toBeDefined();

    // Accept the invitation via test helper
    await client.mutation(api.testing.helpers.acceptTestInvitation, {
      invitationId: inviteResult.invitationId,
    });

    // Verify invitation is no longer pending
    const invitations = await client.mutation(api.testing.helpers.listTestPendingInvitations, {
      workspaceId: testWorkspaceId,
    });
    const found = invitations.find((i: { email: string }) => i.email === inviteEmail);
    expect(found).toBeUndefined();
  });

  it("should cancel pending invitation", async () => {
    const inviteEmail = `cancel-${Date.now()}@test.opencom.dev`;

    const inviteResult = await client.mutation(api.testing.helpers.createTestInvitation, {
      workspaceId: testWorkspaceId,
      email: inviteEmail,
      role: "agent",
      invitedBy: adminUserId,
    });

    await client.mutation(api.testing.helpers.cancelTestInvitation, {
      invitationId: inviteResult.invitationId,
    });

    const invitations = await client.mutation(api.testing.helpers.listTestPendingInvitations, {
      workspaceId: testWorkspaceId,
    });

    const cancelled = invitations.find((i: { email: string }) => i.email === inviteEmail);
    expect(cancelled).toBeUndefined();
  });
});

describe("role changes and member removal", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let adminToken: string;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    const workspace = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    testWorkspaceId = workspace.workspaceId;
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

  it("should change member role from agent to admin", async () => {
    const memberEmail = `agent-to-admin-${Date.now()}@test.opencom.dev`;

    const member = await client.mutation(api.testing.helpers.createTestUser, {
      workspaceId: testWorkspaceId,
      email: memberEmail,
      role: "agent",
    });

    const members = await client.mutation(api.testing.helpers.listTestWorkspaceMembers, {
      workspaceId: testWorkspaceId,
    });

    const membership = members.find((m: { userId: string }) => m.userId === member.userId);
    expect(membership).toBeDefined();
    expect(membership?.role).toBe("agent");

    await client.mutation(api.testing.helpers.updateTestMemberRole, {
      membershipId: membership!._id,
      role: "admin",
    });

    const updatedMembers = await client.mutation(api.testing.helpers.listTestWorkspaceMembers, {
      workspaceId: testWorkspaceId,
    });

    const updatedMembership = updatedMembers.find(
      (m: { userId: string }) => m.userId === member.userId
    );
    expect(updatedMembership?.role).toBe("admin");
  });

  it("should change member role from admin to agent", async () => {
    const memberEmail = `admin-to-agent-${Date.now()}@test.opencom.dev`;

    // Create as admin first
    const member = await client.mutation(api.testing.helpers.createTestUser, {
      workspaceId: testWorkspaceId,
      email: memberEmail,
      role: "admin",
    });

    const members = await client.mutation(api.testing.helpers.listTestWorkspaceMembers, {
      workspaceId: testWorkspaceId,
    });

    const membership = members.find((m: { userId: string }) => m.userId === member.userId);

    // Should succeed because there's still the original admin
    await client.mutation(api.testing.helpers.updateTestMemberRole, {
      membershipId: membership!._id,
      role: "agent",
    });

    const updatedMembers = await client.mutation(api.testing.helpers.listTestWorkspaceMembers, {
      workspaceId: testWorkspaceId,
    });

    const updatedMembership = updatedMembers.find(
      (m: { userId: string }) => m.userId === member.userId
    );
    expect(updatedMembership?.role).toBe("agent");
  });

  it("should remove member from workspace", async () => {
    const memberEmail = `remove-member-${Date.now()}@test.opencom.dev`;

    const member = await client.mutation(api.testing.helpers.createTestUser, {
      workspaceId: testWorkspaceId,
      email: memberEmail,
      role: "agent",
    });

    const members = await client.mutation(api.testing.helpers.listTestWorkspaceMembers, {
      workspaceId: testWorkspaceId,
    });

    const membership = members.find((m: { userId: string }) => m.userId === member.userId);

    await client.mutation(api.testing.helpers.removeTestMember, {
      membershipId: membership!._id,
    });

    const updatedMembers = await client.mutation(api.testing.helpers.listTestWorkspaceMembers, {
      workspaceId: testWorkspaceId,
    });

    const removed = updatedMembers.find((m: { userId: string }) => m.userId === member.userId);
    expect(removed).toBeUndefined();
  });
});

describe("admin-only restrictions on team management", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let adminUserId: Id<"users">;
  let adminToken: string;
  let agentToken: string;
  let agentUserId: Id<"users">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    // Create admin workspace
    const workspace = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    testWorkspaceId = workspace.workspaceId;
    adminUserId = workspace.userId;

    // Create agent in the same workspace
    const agentEmail = `agent-restrict-${Date.now()}@test.opencom.dev`;
    const agent = await client.mutation(api.testing.helpers.createTestUser, {
      workspaceId: testWorkspaceId,
      email: agentEmail,
      role: "agent",
    });
    agentUserId = agent.userId;
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

    await expect(
      client.mutation(api.testing.helpers.removeTestMember, {
        membershipId: adminMembership!._id,
      })
    ).rejects.toThrow(/at least one admin/i);
  });

  it("should prevent demoting last admin", async () => {
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

  it("should allow admin to cancel invitations", async () => {
    const inviteEmail = `admin-cancel-${Date.now()}@test.opencom.dev`;

    const inviteResult = await client.mutation(api.testing.helpers.createTestInvitation, {
      workspaceId: testWorkspaceId,
      email: inviteEmail,
      role: "agent",
      invitedBy: adminUserId,
    });

    // Cancel the invitation
    await client.mutation(api.testing.helpers.cancelTestInvitation, {
      invitationId: inviteResult.invitationId,
    });

    const invitations = await client.mutation(api.testing.helpers.listTestPendingInvitations, {
      workspaceId: testWorkspaceId,
    });

    const cancelled = invitations.find((i: { email: string }) => i.email === inviteEmail);
    expect(cancelled).toBeUndefined();
  });
});
