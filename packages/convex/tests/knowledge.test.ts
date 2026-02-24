import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { authenticateClientForWorkspace } from "./helpers/authSession";

describe("knowledge", () => {
  let client: ConvexClient;
  let testWorkspaceId: Id<"workspaces">;
  let testUserId: Id<"users">;
  let testArticleId: Id<"articles">;
  let testInternalArticleId: Id<"internalArticles">;
  let testSnippetId: Id<"snippets">;
  let testFolderId: Id<"contentFolders">;

  beforeAll(async () => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }
    client = new ConvexClient(convexUrl);
    const authContext = await authenticateClientForWorkspace(client);
    testWorkspaceId = authContext.workspaceId;
    testUserId = authContext.userId;

    // Create test folder
    testFolderId = await client.mutation(api.testing.helpers.createTestContentFolder, {
      workspaceId: testWorkspaceId,
      name: "Knowledge Test Folder",
    });

    // Create test article
    testArticleId = await client.mutation(api.testing.helpers.createTestArticle, {
      workspaceId: testWorkspaceId,
      title: "Test Public Article",
      content: "This is a public article about customer support.",
    });
    await client.mutation(api.testing.helpers.publishTestArticle, { id: testArticleId });

    // Create test internal article
    testInternalArticleId = await client.mutation(api.testing.helpers.createTestInternalArticle, {
      workspaceId: testWorkspaceId,
      title: "Test Internal Documentation",
      content: "This is internal documentation for agents only.",
      tags: ["internal", "docs"],
      folderId: testFolderId,
    });
    await client.mutation(api.testing.helpers.publishTestInternalArticle, {
      id: testInternalArticleId,
    });

    // Create test snippet
    testSnippetId = await client.mutation(api.testing.helpers.createTestSnippet, {
      workspaceId: testWorkspaceId,
      name: "Test Snippet",
      content: "Hello! How can I help you today?",
      shortcut: "hello",
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

  describe("unified search", () => {
    it("should search across all content types", async () => {
      const results = await client.query(api.knowledge.search, {
        workspaceId: testWorkspaceId,
        query: "test",
      });

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);

      // Should find content from different types
      const types = new Set(results.map((r: { type: string }) => r.type));
      expect(types.size).toBeGreaterThanOrEqual(1);
    });

    it("should search public articles", async () => {
      const results = await client.query(api.knowledge.search, {
        workspaceId: testWorkspaceId,
        query: "customer support",
        contentTypes: ["article"],
      });

      expect(results.some((r: { id: string }) => r.id === testArticleId)).toBe(true);
    });

    it("should search internal articles", async () => {
      const results = await client.query(api.knowledge.search, {
        workspaceId: testWorkspaceId,
        query: "internal documentation",
        contentTypes: ["internalArticle"],
      });

      expect(results.some((r: { id: string }) => r.id === testInternalArticleId)).toBe(true);
    });

    it("should search snippets", async () => {
      const results = await client.query(api.knowledge.search, {
        workspaceId: testWorkspaceId,
        query: "hello",
        contentTypes: ["snippet"],
      });

      expect(results.some((r: { id: string }) => r.id === testSnippetId)).toBe(true);
    });

    it("should filter by folder", async () => {
      const results = await client.query(api.knowledge.search, {
        workspaceId: testWorkspaceId,
        query: "internal",
        folderId: testFolderId,
      });

      expect(results.some((r: { id: string }) => r.id === testInternalArticleId)).toBe(true);
    });

    it("should filter by tags", async () => {
      const results = await client.query(api.knowledge.search, {
        workspaceId: testWorkspaceId,
        query: "documentation",
        tags: ["internal"],
      });

      expect(results.some((r: { id: string }) => r.id === testInternalArticleId)).toBe(true);
    });

    it("should respect limit parameter", async () => {
      const results = await client.query(api.knowledge.search, {
        workspaceId: testWorkspaceId,
        query: "test",
        limit: 1,
      });

      expect(results.length).toBeLessThanOrEqual(1);
    });

    it("should include relevance scores", async () => {
      const results = await client.query(api.knowledge.search, {
        workspaceId: testWorkspaceId,
        query: "test",
      });

      expect(
        results.every((r: { relevanceScore: number }) => typeof r.relevanceScore === "number")
      ).toBe(true);
    });

    it("should include content snippets", async () => {
      const results = await client.query(api.knowledge.search, {
        workspaceId: testWorkspaceId,
        query: "documentation",
      });

      expect(results.every((r: { snippet: string }) => typeof r.snippet === "string")).toBe(true);
    });
  });

  describe("content access tracking", () => {
    it("should track content access", async () => {
      const accessId = await client.mutation(api.knowledge.trackAccess, {
        userId: testUserId,
        workspaceId: testWorkspaceId,
        contentType: "article",
        contentId: testArticleId,
      });

      expect(accessId).toBeDefined();
    });

    it("should get recently used content", async () => {
      // Track some accesses
      await client.mutation(api.knowledge.trackAccess, {
        userId: testUserId,
        workspaceId: testWorkspaceId,
        contentType: "internalArticle",
        contentId: testInternalArticleId,
      });

      await client.mutation(api.knowledge.trackAccess, {
        userId: testUserId,
        workspaceId: testWorkspaceId,
        contentType: "snippet",
        contentId: testSnippetId,
      });

      const recent = await client.query(api.knowledge.getRecentlyUsed, {
        userId: testUserId,
        workspaceId: testWorkspaceId,
        limit: 10,
      });

      expect(recent).toBeDefined();
      expect(recent.length).toBeGreaterThan(0);
    });

    it("should update access time on repeated access", async () => {
      // First access
      await client.mutation(api.knowledge.trackAccess, {
        userId: testUserId,
        workspaceId: testWorkspaceId,
        contentType: "article",
        contentId: testArticleId,
      });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Second access
      await client.mutation(api.knowledge.trackAccess, {
        userId: testUserId,
        workspaceId: testWorkspaceId,
        contentType: "article",
        contentId: testArticleId,
      });

      const recent = await client.query(api.knowledge.getRecentlyUsed, {
        userId: testUserId,
        workspaceId: testWorkspaceId,
      });

      // Should only have one entry for the article (not duplicated)
      const articleEntries = recent.filter(
        (r: { type: string; id: string }) => r.type === "article" && r.id === testArticleId
      );
      expect(articleEntries.length).toBe(1);
    });

    it("should get frequently used content", async () => {
      // Track multiple accesses to the same content
      for (let i = 0; i < 3; i++) {
        await client.mutation(api.knowledge.trackAccess, {
          userId: testUserId,
          workspaceId: testWorkspaceId,
          contentType: "snippet",
          contentId: testSnippetId,
        });
      }

      const frequent = await client.query(api.knowledge.getFrequentlyUsed, {
        userId: testUserId,
        workspaceId: testWorkspaceId,
        limit: 10,
      });

      expect(frequent).toBeDefined();
      expect(frequent.length).toBeGreaterThan(0);
    });
  });
});
