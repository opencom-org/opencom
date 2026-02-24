import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("workspaces", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);
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

  it("should create a workspace", async () => {
    const result = await client.mutation(api.testing.helpers.createTestWorkspace, {
      name: `test-workspace-${Date.now()}`,
    });

    expect(result.workspaceId).toBeDefined();
    expect(result.name).toContain("test-workspace");
    testWorkspaceId = result.workspaceId;
  });

  it("should get a workspace by id", async () => {
    const workspace = await client.mutation(api.testing.helpers.getTestWorkspaceFull, {
      id: testWorkspaceId,
    });

    expect(workspace).toBeDefined();
    expect(workspace?._id).toBe(testWorkspaceId);
  });

  it("should not return a workspace by name for unauthenticated callers", async () => {
    const workspace = await client.mutation(api.testing.helpers.getTestWorkspaceFull, {
      id: testWorkspaceId,
    });

    const foundWorkspace = await client.query(api.workspaces.getByName, {
      name: workspace!.name,
    });

    expect(foundWorkspace).toBeNull();
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

  it("should validate origin correctly", async () => {
    // First ensure origins are set
    await client.mutation(api.testing.helpers.updateTestAllowedOrigins, {
      workspaceId: testWorkspaceId,
      allowedOrigins: ["https://example.com", "https://app.example.com"],
    });

    const validResult = await client.query(api.workspaces.validateOrigin, {
      workspaceId: testWorkspaceId,
      origin: "https://example.com",
    });

    expect(validResult.valid).toBe(true);

    const invalidResult = await client.query(api.workspaces.validateOrigin, {
      workspaceId: testWorkspaceId,
      origin: "https://malicious.com",
    });

    expect(invalidResult.valid).toBe(false);
  });

  it("should update signup settings", async () => {
    await client.mutation(api.testing.helpers.updateTestSignupSettings, {
      workspaceId: testWorkspaceId,
      signupMode: "domain-allowlist",
      allowedDomains: ["example.com"],
      authMethods: ["password"],
    });

    const workspace = await client.mutation(api.testing.helpers.getTestWorkspaceFull, {
      id: testWorkspaceId,
    });

    expect(workspace?.signupMode).toBe("domain-allowlist");
    expect(workspace?.allowedDomains).toEqual(["example.com"]);
    expect(workspace?.authMethods).toEqual(["password"]);
  });
});
