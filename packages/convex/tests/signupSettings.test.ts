import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("signup settings - invite-only mode", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testUserId: Id<"users">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    const workspace = await client.mutation(api.testing.helpers.createTestWorkspace, {});
    testWorkspaceId = workspace.workspaceId;
    testUserId = workspace.userId;

    // Set workspace to invite-only mode
    await client.mutation(api.testing.helpers.updateTestSignupSettings, {
      workspaceId: testWorkspaceId,
      signupMode: "invite-only",
      authMethods: ["password", "otp"],
    });
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

  it("should set workspace to invite-only mode", async () => {
    const workspace = await client.mutation(api.testing.helpers.getTestWorkspaceFull, {
      id: testWorkspaceId,
    });

    expect(workspace?.signupMode).toBe("invite-only");
  });

  it("should allow invited users to join workspace", async () => {
    const inviteEmail = `invited-${Date.now()}@test.opencom.dev`;

    // Create invitation via test helper (bypasses email sending)
    const inviteResult = await client.mutation(api.testing.helpers.createTestInvitation, {
      workspaceId: testWorkspaceId,
      email: inviteEmail,
      role: "agent",
      invitedBy: testUserId,
    });

    expect(inviteResult.invitationId).toBeDefined();
  });
});

describe("signup settings - domain allowlist mode", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;

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

  it("should set workspace to domain-allowlist mode", async () => {
    const allowedDomains = ["company.com", "partner.org"];

    await client.mutation(api.testing.helpers.updateTestSignupSettings, {
      workspaceId: testWorkspaceId,
      signupMode: "domain-allowlist",
      allowedDomains,
      authMethods: ["otp"],
    });

    const ws = await client.mutation(api.testing.helpers.getTestWorkspaceFull, {
      id: testWorkspaceId,
    });

    expect(ws?.signupMode).toBe("domain-allowlist");
    expect(ws?.allowedDomains).toEqual(allowedDomains);
  });

  it("should store allowed domains correctly", async () => {
    const allowedDomains = ["acme.com", "widgets.io"];

    await client.mutation(api.testing.helpers.updateTestSignupSettings, {
      workspaceId: testWorkspaceId,
      signupMode: "domain-allowlist",
      allowedDomains,
    });

    const ws = await client.mutation(api.testing.helpers.getTestWorkspaceFull, {
      id: testWorkspaceId,
    });

    expect(ws?.allowedDomains).toContain("acme.com");
    expect(ws?.allowedDomains).toContain("widgets.io");
  });

  it("should clear allowed domains when switching to invite-only", async () => {
    // First set domain-allowlist with domains
    await client.mutation(api.testing.helpers.updateTestSignupSettings, {
      workspaceId: testWorkspaceId,
      signupMode: "domain-allowlist",
      allowedDomains: ["test.com"],
    });

    // Then switch to invite-only
    await client.mutation(api.testing.helpers.updateTestSignupSettings, {
      workspaceId: testWorkspaceId,
      signupMode: "invite-only",
    });

    const ws = await client.mutation(api.testing.helpers.getTestWorkspaceFull, {
      id: testWorkspaceId,
    });

    expect(ws?.signupMode).toBe("invite-only");
    expect(ws?.allowedDomains).toEqual([]);
  });
});

describe("auth method visibility", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;

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

  it("should set auth methods to password only", async () => {
    await client.mutation(api.testing.helpers.updateTestSignupSettings, {
      workspaceId: testWorkspaceId,
      signupMode: "invite-only",
      authMethods: ["password"],
    });

    const workspace = await client.mutation(api.testing.helpers.getTestWorkspaceFull, {
      id: testWorkspaceId,
    });

    expect(workspace?.authMethods).toEqual(["password"]);
  });

  it("should set auth methods to OTP only", async () => {
    await client.mutation(api.testing.helpers.updateTestSignupSettings, {
      workspaceId: testWorkspaceId,
      signupMode: "invite-only",
      authMethods: ["otp"],
    });

    const workspace = await client.mutation(api.testing.helpers.getTestWorkspaceFull, {
      id: testWorkspaceId,
    });

    expect(workspace?.authMethods).toEqual(["otp"]);
  });

  it("should set auth methods to both password and OTP", async () => {
    await client.mutation(api.testing.helpers.updateTestSignupSettings, {
      workspaceId: testWorkspaceId,
      signupMode: "invite-only",
      authMethods: ["password", "otp"],
    });

    const workspace = await client.mutation(api.testing.helpers.getTestWorkspaceFull, {
      id: testWorkspaceId,
    });

    expect(workspace?.authMethods).toContain("password");
    expect(workspace?.authMethods).toContain("otp");
  });

  it("should redact auth methods in unauthenticated discovery metadata", async () => {
    await client.mutation(api.testing.helpers.updateTestSignupSettings, {
      workspaceId: testWorkspaceId,
      signupMode: "domain-allowlist",
      allowedDomains: ["test.com"],
      authMethods: ["otp"],
    });

    // Discovery endpoint returns metadata from the first workspace
    const metadata = await client.query(api.discovery.getMetadata, {});

    expect(metadata).not.toHaveProperty("authMethods");
    expect(metadata).not.toHaveProperty("signupMode");
  });
});
