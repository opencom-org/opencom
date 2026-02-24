import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

describe("Visitor origin enforcement", () => {
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

  describe("identify with allowlist configured", () => {
    let visitorId: Id<"visitors">;

    beforeAll(async () => {
      // Create a visitor via test helper, then enable allowlist
      const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
        workspaceId: testWorkspaceId,
      });
      visitorId = visitor.visitorId;

      await client.mutation(api.testing.helpers.updateWorkspaceOrigins, {
        workspaceId: testWorkspaceId,
        allowedOrigins: ["https://allowed.com"],
      });
    });

    afterAll(async () => {
      await client.mutation(api.testing.helpers.updateWorkspaceOrigins, {
        workspaceId: testWorkspaceId,
        allowedOrigins: [],
      });
    });

    it("should allow identify from an allowed origin", async () => {
      const result = await client.mutation(api.visitors.identify, {
        visitorId,
        name: "Test User",
        origin: "https://allowed.com",
      });
      expect(result).not.toBeNull();
    });

    it("should reject identify from a disallowed origin", async () => {
      await expect(
        client.mutation(api.visitors.identify, {
          visitorId,
          name: "Evil User",
          origin: "https://evil.com",
        })
      ).rejects.toThrow(/Origin validation failed/);
    });
  });

  describe("heartbeat with allowlist configured", () => {
    let visitorId: Id<"visitors">;

    beforeAll(async () => {
      const visitor = await client.mutation(api.testing.helpers.createTestVisitor, {
        workspaceId: testWorkspaceId,
      });
      visitorId = visitor.visitorId;

      await client.mutation(api.testing.helpers.updateWorkspaceOrigins, {
        workspaceId: testWorkspaceId,
        allowedOrigins: ["https://allowed.com"],
      });
    });

    afterAll(async () => {
      await client.mutation(api.testing.helpers.updateWorkspaceOrigins, {
        workspaceId: testWorkspaceId,
        allowedOrigins: [],
      });
    });

    it("should allow heartbeat from an allowed origin", async () => {
      await client.mutation(api.visitors.heartbeat, {
        visitorId,
        origin: "https://allowed.com",
      });
      // No error means success
    });

    it("should reject heartbeat from a disallowed origin", async () => {
      await expect(
        client.mutation(api.visitors.heartbeat, {
          visitorId,
          origin: "https://evil.com",
        })
      ).rejects.toThrow(/Origin validation failed/);
    });
  });
});
