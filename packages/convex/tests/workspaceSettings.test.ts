import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("workspace settings", () => {
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

  it("should update allowed origins", async () => {
    const origins = ["https://example.com", "https://app.example.com"];

    await client.mutation(api.testing.helpers.updateTestAllowedOrigins, {
      workspaceId: testWorkspaceId,
      allowedOrigins: origins,
    });

    const workspace = await client.mutation(api.testing.helpers.getTestWorkspaceFull, {
      id: testWorkspaceId,
    });

    expect(workspace?.allowedOrigins).toEqual(origins);
  });

  it("should validate allowed origin", async () => {
    await client.mutation(api.testing.helpers.updateTestAllowedOrigins, {
      workspaceId: testWorkspaceId,
      allowedOrigins: ["https://allowed.com"],
    });

    const validResult = await client.query(api.workspaces.validateOrigin, {
      workspaceId: testWorkspaceId,
      origin: "https://allowed.com",
    });

    expect(validResult.valid).toBe(true);

    const invalidResult = await client.query(api.workspaces.validateOrigin, {
      workspaceId: testWorkspaceId,
      origin: "https://notallowed.com",
    });

    expect(invalidResult.valid).toBe(false);
  });

  it("should support wildcard subdomain origins", async () => {
    await client.mutation(api.testing.helpers.updateTestAllowedOrigins, {
      workspaceId: testWorkspaceId,
      allowedOrigins: ["*.example.com"],
    });

    const subdomainResult = await client.query(api.workspaces.validateOrigin, {
      workspaceId: testWorkspaceId,
      origin: "https://app.example.com",
    });

    expect(subdomainResult.valid).toBe(true);

    const otherDomainResult = await client.query(api.workspaces.validateOrigin, {
      workspaceId: testWorkspaceId,
      origin: "https://other.com",
    });

    expect(otherDomainResult.valid).toBe(false);
  });

  it("should allow all origins when none configured", async () => {
    await client.mutation(api.testing.helpers.updateTestAllowedOrigins, {
      workspaceId: testWorkspaceId,
      allowedOrigins: [],
    });

    const result = await client.query(api.workspaces.validateOrigin, {
      workspaceId: testWorkspaceId,
      origin: "https://any-origin.com",
    });

    expect(result.valid).toBe(true);
  });

  it("should update signup settings to invite-only", async () => {
    await client.mutation(api.testing.helpers.updateTestSignupSettings, {
      workspaceId: testWorkspaceId,
      signupMode: "invite-only",
      authMethods: ["password", "otp"],
    });

    const workspace = await client.mutation(api.testing.helpers.getTestWorkspaceFull, {
      id: testWorkspaceId,
    });

    expect(workspace?.signupMode).toBe("invite-only");
    expect(workspace?.authMethods).toContain("password");
    expect(workspace?.authMethods).toContain("otp");
  });

  it("should update signup settings to domain-allowlist", async () => {
    const allowedDomains = ["company.com", "partner.com"];

    await client.mutation(api.testing.helpers.updateTestSignupSettings, {
      workspaceId: testWorkspaceId,
      signupMode: "domain-allowlist",
      allowedDomains,
      authMethods: ["otp"],
    });

    const workspace = await client.mutation(api.testing.helpers.getTestWorkspaceFull, {
      id: testWorkspaceId,
    });

    expect(workspace?.signupMode).toBe("domain-allowlist");
    expect(workspace?.allowedDomains).toEqual(allowedDomains);
    expect(workspace?.authMethods).toEqual(["otp"]);
  });

  it("should clear allowed domains when switching to invite-only", async () => {
    // First set domain-allowlist
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

    const workspace = await client.mutation(api.testing.helpers.getTestWorkspaceFull, {
      id: testWorkspaceId,
    });

    expect(workspace?.signupMode).toBe("invite-only");
    expect(workspace?.allowedDomains).toEqual([]);
  });
});
