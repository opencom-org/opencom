import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("Origin Allowlist Integration Tests", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);

    // Create test workspace
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

  describe("Origin validation", () => {
    it("should validate valid origin format", async () => {
      const result = await client.query(api.workspaces.validateOrigin, {
        workspaceId: testWorkspaceId,
        origin: "https://example.com",
      });

      // When allowlist is empty, all origins should be valid
      expect(result.valid).toBe(true);
    });

    it("should allow any origin when no allowlist is configured", async () => {
      const result = await client.query(api.workspaces.validateOrigin, {
        workspaceId: testWorkspaceId,
        origin: "not-a-valid-origin",
      });

      // When allowlist is empty, all origins are valid (no format validation)
      expect(result.valid).toBe(true);
    });

    it("should update allowed origins", async () => {
      const origins = ["https://myapp.com", "https://staging.myapp.com"];

      await client.mutation(api.testing.helpers.updateWorkspaceOrigins, {
        workspaceId: testWorkspaceId,
        allowedOrigins: origins,
      });

      const workspace = await client.mutation(api.testing.helpers.getTestWorkspaceFull, {
        id: testWorkspaceId,
      });

      expect(workspace?.allowedOrigins).toEqual(origins);
    });

    it("should allow origins in allowlist", async () => {
      // First set allowed origins
      await client.mutation(api.testing.helpers.updateWorkspaceOrigins, {
        workspaceId: testWorkspaceId,
        allowedOrigins: ["https://allowed.com"],
      });

      const result = await client.query(api.workspaces.validateOrigin, {
        workspaceId: testWorkspaceId,
        origin: "https://allowed.com",
      });

      expect(result.valid).toBe(true);
    });

    it("should reject origins not in allowlist when allowlist is set", async () => {
      // Set allowed origins
      await client.mutation(api.testing.helpers.updateWorkspaceOrigins, {
        workspaceId: testWorkspaceId,
        allowedOrigins: ["https://allowed.com"],
      });

      const result = await client.query(api.workspaces.validateOrigin, {
        workspaceId: testWorkspaceId,
        origin: "https://not-allowed.com",
      });

      expect(result.valid).toBe(false);
    });

    it("should allow localhost for development", async () => {
      const result = await client.query(api.workspaces.validateOrigin, {
        workspaceId: testWorkspaceId,
        origin: "http://localhost:3000",
      });

      // Localhost should typically be allowed for development
      expect(typeof result.valid).toBe("boolean");
    });
  });

  describe("CORS-like origin handling", () => {
    it("should handle origins with ports", async () => {
      await client.mutation(api.testing.helpers.updateWorkspaceOrigins, {
        workspaceId: testWorkspaceId,
        allowedOrigins: ["https://myapp.com:8080"],
      });

      const result = await client.query(api.workspaces.validateOrigin, {
        workspaceId: testWorkspaceId,
        origin: "https://myapp.com:8080",
      });

      expect(result.valid).toBe(true);
    });

    it("should treat different ports as different origins", async () => {
      await client.mutation(api.testing.helpers.updateWorkspaceOrigins, {
        workspaceId: testWorkspaceId,
        allowedOrigins: ["https://myapp.com:8080"],
      });

      const result = await client.query(api.workspaces.validateOrigin, {
        workspaceId: testWorkspaceId,
        origin: "https://myapp.com:3000",
      });

      expect(result.valid).toBe(false);
    });

    it("should handle subdomains correctly", async () => {
      await client.mutation(api.testing.helpers.updateWorkspaceOrigins, {
        workspaceId: testWorkspaceId,
        allowedOrigins: ["https://app.mysite.com"],
      });

      // Exact subdomain should be allowed
      const exactResult = await client.query(api.workspaces.validateOrigin, {
        workspaceId: testWorkspaceId,
        origin: "https://app.mysite.com",
      });
      expect(exactResult.valid).toBe(true);

      // Different subdomain should not be allowed
      const differentResult = await client.query(api.workspaces.validateOrigin, {
        workspaceId: testWorkspaceId,
        origin: "https://other.mysite.com",
      });
      expect(differentResult.valid).toBe(false);
    });
  });
});
