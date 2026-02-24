import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("workspaceMembers", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testUserId: Id<"users">;
  let authToken: string;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    const workspace = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    testWorkspaceId = workspace.workspaceId;
    testUserId = workspace.userId;
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

  it("should list workspace members", async () => {
    const members = await client.mutation(api.testing.helpers.listTestWorkspaceMembers, {
      workspaceId: testWorkspaceId,
    });

    expect(members).toBeDefined();
    expect(members.length).toBe(1);
    expect(members[0].userId).toBe(testUserId);
    expect(members[0].role).toBe("admin");
  });

  it("should create an invitation via test helper", async () => {
    const inviteEmail = `invite-${Date.now()}@test.opencom.dev`;

    // Use test helper to create invitation directly (bypasses email sending)
    const result = await client.mutation(api.testing.helpers.createTestInvitation, {
      workspaceId: testWorkspaceId,
      email: inviteEmail,
      role: "agent",
      invitedBy: testUserId,
    });

    expect(result.invitationId).toBeDefined();
  });

  it("should list pending invitations", async () => {
    const invitations = await client.mutation(api.testing.helpers.listTestPendingInvitations, {
      workspaceId: testWorkspaceId,
    });

    expect(invitations).toBeDefined();
    expect(invitations.length).toBeGreaterThan(0);
    expect(invitations[0].status).toBe("pending");
  });

  it("should cancel an invitation", async () => {
    const inviteEmail = `cancel-${Date.now()}@test.opencom.dev`;

    // Create invitation via test helper
    const inviteResult = await client.mutation(api.testing.helpers.createTestInvitation, {
      workspaceId: testWorkspaceId,
      email: inviteEmail,
      role: "agent",
      invitedBy: testUserId,
    });

    await client.mutation(api.testing.helpers.cancelTestInvitation, {
      invitationId: inviteResult.invitationId,
    });

    const invitations = await client.mutation(api.testing.helpers.listTestPendingInvitations, {
      workspaceId: testWorkspaceId,
    });

    const cancelledInvite = invitations.find((i: { email: string }) => i.email === inviteEmail);
    expect(cancelledInvite).toBeUndefined();
  });

  it("should update member role", async () => {
    const newMemberEmail = `newmember-${Date.now()}@test.opencom.dev`;

    const newMember = await client.mutation(api.testing.helpers.createTestUser, {
      workspaceId: testWorkspaceId,
      email: newMemberEmail,
      role: "agent",
    });

    // First get the membership ID
    const members = await client.mutation(api.testing.helpers.listTestWorkspaceMembers, {
      workspaceId: testWorkspaceId,
    });
    const membership = members.find((m: { userId: string }) => m.userId === newMember.userId);
    expect(membership).toBeDefined();

    await client.mutation(api.testing.helpers.updateTestMemberRole, {
      membershipId: membership!._id,
      role: "admin",
    });

    const updatedMembers = await client.mutation(api.testing.helpers.listTestWorkspaceMembers, {
      workspaceId: testWorkspaceId,
    });

    const updatedMember = updatedMembers.find(
      (m: { userId: string }) => m.userId === newMember.userId
    );
    expect(updatedMember?.role).toBe("admin");
  });
});
